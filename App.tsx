import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  ImageBackground,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  TextInput,
  Modal,
} from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { antGravityQueue, TTSResult } from './utils/antGravityQueue';

// 커스텀 타입 임포트
import {
  GeocodeResult,
  ForecastResponse,
  HourlyItem,
  DailyItem,
  StoredContext,
} from './types';

// 커스텀 컴포넌트 임포트
import { SearchRow } from './components/SearchRow';
import { JudgementCard } from './components/JudgementCard';
import { MarineTideCard } from './components/MarineTideCard';
import { SafetyChecklist } from './components/SafetyChecklist';
import { DistrictSelectorModal } from './components/DistrictSelectorModal';

// 로컬 지오코딩 맵 데이터셋 임포트
import { KOREAN_DISTRICTS, DistrictItem } from './utils/koreanDistricts';

// 커스텀 유틸리티 임포트
import {
  weatherLabel,
  isClearCode,
  isRainOrStormCode,
  weatherIconSource,
  formatHour,
  formatDateTime,
  formatDay,
  getWaveAlert,
  getWindAlert,
  marineRiskScore,
  marineDecision,
  hourlyWaveLabelByWind,
  getSailingStage,
  getDecisionTheme,
  dailyQIconByWind,
  resolveAlarmDate,
  getTideForecast,
  getDynamicTheme,
} from './utils/marineHelper';

const defaultHeaderImage = require('./wave.png');
const appLogo = require('./logo.png');

const MARINE_BG_TASK = 'marine-daily-auto-refresh';
const AUTO_UPDATE_KEY = 'marine_auto_update_enabled';
const LAST_CONTEXT_KEY = 'marine_last_context';
const NEXT_ALARM_KEY = 'marine_next_alarm_iso';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// 백그라운드 태스크 등록
async function registerMarineBackgroundTask() {
  const status = await BackgroundFetch.getStatusAsync();
  if (status !== BackgroundFetch.BackgroundFetchStatus.Available) return;
  const isRegistered = await TaskManager.isTaskRegisteredAsync(MARINE_BG_TASK);
  if (isRegistered) return;
  await BackgroundFetch.registerTaskAsync(MARINE_BG_TASK, {
    minimumInterval: 60 * 60 * 6,
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

// 백그라운드 태스크 로직 정의
if (!TaskManager.isTaskDefined(MARINE_BG_TASK)) {
  TaskManager.defineTask(MARINE_BG_TASK, async () => {
    try {
      const enabled = await AsyncStorage.getItem(AUTO_UPDATE_KEY);
      if (enabled !== 'true') return BackgroundFetch.BackgroundFetchResult.NoData;

      const raw = await AsyncStorage.getItem(LAST_CONTEXT_KEY);
      if (!raw) return BackgroundFetch.BackgroundFetchResult.NoData;
      const context = JSON.parse(raw) as StoredContext;

      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${context.latitude}&longitude=${context.longitude}&current=weather_code,wind_speed_10m&daily=sunrise&forecast_days=2&timezone=auto`
      );
      if (!res.ok) return BackgroundFetch.BackgroundFetchResult.Failed;
      const data = await res.json();

      const sunrises = data?.daily?.sunrise as string[] | undefined;
      const windSpeed = data?.current?.wind_speed_10m as number | undefined;
      const weatherCode = data?.current?.weather_code as number | undefined;
      if (!sunrises?.length || windSpeed === undefined || weatherCode === undefined) {
        return BackgroundFetch.BackgroundFetchResult.NoData;
      }

      const wave = getWaveAlert(windSpeed, weatherCode);
      const wind = getWindAlert(windSpeed);
      const score = marineRiskScore(windSpeed, weatherCode, wave.level, wind.level);
      const stage = getSailingStage(score);
      const date = resolveAlarmDate(sunrises, new Date());

      await Notifications.setNotificationChannelAsync('marine-alerts', {
        name: '해상 주의 알림',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
      await Notifications.cancelAllScheduledNotificationsAsync();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '해뜨기 전 해상 브리핑',
          body: `${context.name} ${stage.title}, 파도 ${wave.level}, 바람 ${wind.level}, 풍속 ${Math.round(
            windSpeed
          )}km/h`,
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          channelId: 'marine-alerts',
        },
      });

      await AsyncStorage.setItem(NEXT_ALARM_KEY, date.toISOString());
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

export default function App() {
  const [inputValue, setInputValue] = useState('제주시');
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<GeocodeResult | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [headerImageUri, setHeaderImageUri] = useState<string | null>(null);
  const [nextAlarmText, setNextAlarmText] = useState<string>('알림 미설정');
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);
  const lastPopupLevel = useRef<string>('안전');

  // 안트그라비티 오디오 브리핑 관련 상태 및 Ref
  const [apiKey, setApiKey] = useState('');
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyTemp, setApiKeyTemp] = useState('');

  const introSoundRef = useRef<Audio.Sound | null>(null);
  const briefingSoundRef = useRef<Audio.Sound | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 초기 설정 로드
  useEffect(() => {
    const loadAudioSettings = async () => {
      try {
        const storedKey = await AsyncStorage.getItem('antgravity_google_api_key');
        if (storedKey) {
          setApiKey(storedKey);
          setApiKeyTemp(storedKey);
        }
        const storedGender = await AsyncStorage.getItem('antgravity_voice_gender');
        if (storedGender === 'male' || storedGender === 'female') {
          setVoiceGender(storedGender);
        }
      } catch (e) {
        console.warn('AntGravity: 오디오 브리핑 설정 로드 실패', e);
      }
    };
    loadAudioSettings();
  }, []);

  const saveApiKey = async (key: string) => {
    const trimmed = key.trim();
    setApiKey(trimmed);
    await AsyncStorage.setItem('antgravity_google_api_key', trimmed);
    setShowApiKeyModal(false);
    Alert.alert('설정 완료', 'Google Cloud API Key가 안전하게 저장되었습니다.');
  };

  const toggleVoiceGender = async () => {
    const nextGender = voiceGender === 'female' ? 'male' : 'female';
    setVoiceGender(nextGender);
    await AsyncStorage.setItem('antgravity_voice_gender', nextGender);
  };

  // 중복 지역 선택 관련 상태
  const [selectorModalVisible, setSelectorModalVisible] = useState(false);
  const [matchedDistricts, setMatchedDistricts] = useState<DistrictItem[]>([]);

  // 자동 스크롤 및 4초 조작 복귀 관련 refs/변수
  const hourlyScrollViewRef = useRef<ScrollView>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUserScrolling = useRef(false);

  const currentWeatherCode = forecast?.current.weather_code ?? 0;
  const currentWindSpeed = forecast?.current.wind_speed_10m ?? 0;
  const canUseNativeDriver = Platform.OS !== 'web';

  // 기상 및 강풍에 따른 다이내믹 배경 테마 색상 획득
  const dynamicThemeColors = useMemo(() => {
    return getDynamicTheme(currentWeatherCode, currentWindSpeed);
  }, [currentWeatherCode, currentWindSpeed]);

  // 물때 예측 데이터 연동
  const tideForecastData = useMemo(() => {
    if (!location) return null;
    return getTideForecast(location.latitude, location.longitude);
  }, [location]);

  // 애니메이션 Values
  const mainFloat = useRef(new Animated.Value(0)).current;
  const dailyFloat = useRef(new Animated.Value(0)).current;
  const hourlyFloat = useRef(new Animated.Value(0)).current;
  const mainPulse = useRef(new Animated.Value(0)).current;
  const hourlyPulse = useRef(new Animated.Value(0)).current;

  // 애니메이션 Loop Refs
  const mainLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const dailyLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const hourlyLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const mainPulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const hourlyPulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const restartIconAnimations = useCallback(() => {
    mainLoopRef.current?.stop();
    dailyLoopRef.current?.stop();
    hourlyLoopRef.current?.stop();
    mainPulseLoopRef.current?.stop();
    hourlyPulseLoopRef.current?.stop();

    mainFloat.setValue(0);
    dailyFloat.setValue(0);
    hourlyFloat.setValue(0);
    mainPulse.setValue(0);
    hourlyPulse.setValue(0);

    mainLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.delay(150),
        Animated.timing(mainFloat, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(mainFloat, {
          toValue: 0,
          duration: 1700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: canUseNativeDriver,
        }),
      ])
    );
    dailyLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.delay(650),
        Animated.timing(dailyFloat, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(dailyFloat, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: canUseNativeDriver,
        }),
      ])
    );
    hourlyLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(hourlyFloat, {
          toValue: 1,
          duration: 1850,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(hourlyFloat, {
          toValue: 0,
          duration: 1850,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: canUseNativeDriver,
        }),
      ])
    );
    mainPulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.delay(220),
        Animated.timing(mainPulse, {
          toValue: 1,
          duration: 1250,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(mainPulse, {
          toValue: 0,
          duration: 1250,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: canUseNativeDriver,
        }),
      ])
    );
    hourlyPulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(hourlyPulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(hourlyPulse, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: canUseNativeDriver,
        }),
      ])
    );

    mainLoopRef.current.start();
    dailyLoopRef.current.start();
    hourlyLoopRef.current.start();
    mainPulseLoopRef.current.start();
    hourlyPulseLoopRef.current.start();
  }, [canUseNativeDriver, mainFloat, dailyFloat, hourlyFloat, mainPulse, hourlyPulse]);

  const stopBriefing = useCallback(async () => {
    setIsSpeaking(false);
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    try {
      if (introSoundRef.current) {
        await introSoundRef.current.stopAsync();
        await introSoundRef.current.unloadAsync();
        introSoundRef.current = null;
      }
    } catch (e) {}
    try {
      if (briefingSoundRef.current) {
        await briefingSoundRef.current.stopAsync();
        await briefingSoundRef.current.unloadAsync();
        briefingSoundRef.current = null;
      }
    } catch (e) {}
    await Speech.stop();
  }, []);

  const startBriefing = useCallback(async () => {
    if (!forecast || !location) return;

    await stopBriefing();
    setIsSpeaking(true);

    const currentWaveAlert = getWaveAlert(forecast.current.wind_speed_10m, forecast.current.weather_code);
    const currentWindAlert = getWindAlert(forecast.current.wind_speed_10m);
    const waveLvl = currentWaveAlert?.level ?? '보통';
    const windLvl = currentWindAlert?.level ?? '보통';

    const briefingText = `안녕하십니까. 해상 안전 브리핑입니다. 현재 ${
      location.name
    }의 날씨는 ${weatherLabel(
      forecast.current.weather_code
    )} 상태이며, 기온은 영상 ${Math.round(
      forecast.current.temperature_2m
    )}도입니다. 바람은 초속 약 ${Math.round(
      forecast.current.wind_speed_10m / 3.6
    )}미터로 불고 있습니다. ${
      waveLvl === '경계' || windLvl === '경계'
        ? '현재 풍량과 파고로 인한 경계 단계 경보가 발효 중입니다. 선박 운항을 즉시 중단하시고 대피해 주시기 바랍니다. '
        : waveLvl === '주의' || windLvl === '주의'
        ? '현재 파도 또는 바람 상태가 주의 수준입니다. 출항 전 안전 진단을 꼭 실시하시고 주의하여 운항해 주시기 바랍니다. '
        : '현재 해상 상태는 비교적 잔잔하고 안전한 편입니다. 다만 항시 안전 규정을 준수해 주십시오. '
    }오늘 하루도 안전하게 운항하시기 바랍니다. 감사합니다.`;

    const taskId = `briefing_${Date.now()}`;

    new Promise<TTSResult>((resolve, reject) => {
      antGravityQueue.enqueue({
        id: taskId,
        text: briefingText,
        voiceGender,
        locationName: location.name,
        apiKey,
        resolve,
        reject,
      });
    })
      .then(async (result) => {
        if (result.useNativeFallback) {
          console.log('AntGravity: Falling back to Native Speech');
          await Speech.speak(result.text, {
            language: 'ko-KR',
            rate: 0.95,
            onDone: () => setIsSpeaking(false),
            onError: () => setIsSpeaking(false),
          });
        } else if (result.uri) {
          try {
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: false,
              playsInSilentModeIOS: true,
              playThroughEarpieceAndroid: false,
              staysActiveInBackground: true,
            });

            const introUri = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav';

            const { sound: introSound } = await Audio.Sound.createAsync(
              { uri: introUri },
              { shouldPlay: false, volume: 1.0 }
            );
            introSoundRef.current = introSound;

            const { sound: briefingSound } = await Audio.Sound.createAsync(
              { uri: result.uri },
              { shouldPlay: false, volume: 0.0 }
            );
            briefingSoundRef.current = briefingSound;

            let crossfadeTriggered = false;

            const triggerCrossfade = async () => {
              if (crossfadeTriggered) return;
              crossfadeTriggered = true;

              try {
                await briefingSound.playAsync();

                const steps = 10;
                const fadeDuration = 200; // 0.2초
                const fadeInterval = fadeDuration / steps;
                let step = 0;

                fadeIntervalRef.current = setInterval(async () => {
                  step++;
                  const progress = step / steps;
                  try {
                    if (introSoundRef.current) {
                      await introSoundRef.current.setVolumeAsync(Math.max(0, 1.0 - progress));
                    }
                    if (briefingSoundRef.current) {
                      await briefingSoundRef.current.setVolumeAsync(Math.min(1.0, progress));
                    }
                  } catch (e) {}

                  if (step >= steps) {
                    if (fadeIntervalRef.current) {
                      clearInterval(fadeIntervalRef.current);
                      fadeIntervalRef.current = null;
                    }
                    try {
                      if (introSoundRef.current) {
                        await introSoundRef.current.stopAsync();
                        await introSoundRef.current.unloadAsync();
                        introSoundRef.current = null;
                      }
                    } catch (e) {}
                  }
                }, fadeInterval);
              } catch (err) {
                console.error('AntGravity Crossfade failed:', err);
                await briefingSound.setVolumeAsync(1.0);
                await briefingSound.playAsync();
              }
            };

            introSound.setOnPlaybackStatusUpdate(async (status) => {
              if (!status.isLoaded) return;
              if (status.didJustFinish) {
                await triggerCrossfade();
              } else if (status.durationMillis && status.positionMillis) {
                if (status.durationMillis - status.positionMillis <= 200) {
                  await triggerCrossfade();
                }
              }
            });

            briefingSound.setOnPlaybackStatusUpdate(async (status) => {
              if (!status.isLoaded) return;
              if (status.didJustFinish) {
                setIsSpeaking(false);
                await stopBriefing();
              }
            });

            await introSound.playAsync();
          } catch (audioErr) {
            console.error('AntGravity: Audio playback error, falling back to Native Speech', audioErr);
            await Speech.speak(result.text, {
              language: 'ko-KR',
              rate: 0.95,
              onDone: () => setIsSpeaking(false),
              onError: () => setIsSpeaking(false),
            });
          }
        }
      })
      .catch((err) => {
        console.error('AntGravity Queue Error:', err);
        setIsSpeaking(false);
      });
  }, [forecast, location, voiceGender, apiKey, stopBriefing]);

  useEffect(() => {
    restartIconAnimations();
    return () => {
      mainLoopRef.current?.stop();
      dailyLoopRef.current?.stop();
      hourlyLoopRef.current?.stop();
      mainPulseLoopRef.current?.stop();
      hourlyPulseLoopRef.current?.stop();
      stopBriefing();
    };
  }, [restartIconAnimations, stopBriefing]);

  useEffect(() => {
    if (!forecast || !location || loading || locationLoading) return;
    restartIconAnimations();
  }, [forecast, location, loading, locationLoading, restartIconAnimations]);

  const mainIconMotion = useMemo(() => {
    const transforms: any[] = [
      {
        translateY: mainFloat.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -10],
        }),
      },
    ];

    if (isClearCode(currentWeatherCode)) {
      transforms.push({
        scale: mainPulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.08],
        }),
      });
    } else if (isRainOrStormCode(currentWeatherCode)) {
      transforms.push({
        translateX: mainPulse.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [-5, 5, -5],
        }),
      });
    } else {
      transforms.push({
        translateX: mainFloat.interpolate({
          inputRange: [0, 1],
          outputRange: [-3, 3],
        }),
      });
    }

    return { transform: transforms };
  }, [currentWeatherCode, mainFloat, mainPulse]);

  const smallIconMotion = useMemo(
    () => ({
      transform: [
        {
          translateY: dailyFloat.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -4],
          }),
        },
      ],
    }),
    [dailyFloat]
  );

  const hourlyIconMotionByWind = useCallback(
    (windSpeed: number) => {
      const shakePower = Math.max(1, Math.min(5, windSpeed / 14));
      const liftPower = Math.max(1, Math.min(3, windSpeed / 30));
      return {
        transform: [
          {
            translateY: hourlyFloat.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -liftPower],
            }),
          },
          {
            translateX: hourlyPulse.interpolate({
              inputRange: [0, 1],
              outputRange: [-shakePower, shakePower],
            }),
          },
        ],
      };
    },
    [hourlyFloat, hourlyPulse]
  );

  const fetchForecastByCoords = useCallback(
    async (latitude: number, longitude: number, nextLocation?: Partial<GeocodeResult>) => {
      setLoading(true);
      setError(null);
      try {
        const forecastRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,sunrise,sunset&forecast_days=7&timezone=auto`
        );
        if (!forecastRes.ok) throw new Error('날씨 정보를 불러오지 못했습니다.');

        const forecastData = (await forecastRes.json()) as ForecastResponse;
        setForecast(forecastData);
        const finalLocation: GeocodeResult = {
          latitude,
          longitude,
          name: nextLocation?.name ?? '현재 위치',
          admin1: nextLocation?.admin1,
          country: nextLocation?.country,
          timezone: nextLocation?.timezone ?? 'Asia/Seoul',
        };
        setLocation(finalLocation);
        await AsyncStorage.setItem(
          LAST_CONTEXT_KEY,
          JSON.stringify({
            latitude,
            longitude,
            name: finalLocation.name,
          } as StoredContext)
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const onSelectDistrict = useCallback((item: DistrictItem) => {
    setSelectorModalVisible(false);
    fetchForecastByCoords(item.latitude, item.longitude, {
      name: item.name,
      admin1: item.fullName.split(' ').slice(0, 2).join(' '),
      latitude: item.latitude,
      longitude: item.longitude,
    });
    setInputValue(item.name);
  }, [fetchForecastByCoords]);

  const fetchWeatherByCity = useCallback(
    async (city: string) => {
      setLoading(true);
      setError(null);
      try {
        const trimmed = city.trim();
        if (!trimmed) throw new Error('검색어를 입력해 주세요.');

        // 1. 로컬 데이터셋에서 1차 검색
        const matchedLocal = KOREAN_DISTRICTS.filter(item => 
          item.name.toLowerCase() === trimmed.toLowerCase() ||
          item.name.includes(trimmed) || 
          item.fullName.includes(trimmed) || 
          trimmed.includes(item.name)
        );

        if (matchedLocal.length === 1) {
          await fetchForecastByCoords(matchedLocal[0].latitude, matchedLocal[0].longitude, {
            name: matchedLocal[0].name,
            admin1: matchedLocal[0].fullName.split(' ').slice(0, 2).join(' '),
            latitude: matchedLocal[0].latitude,
            longitude: matchedLocal[0].longitude,
          });
          setInputValue(matchedLocal[0].name);
          return;
        } else if (matchedLocal.length > 1) {
          setMatchedDistricts(matchedLocal);
          setSelectorModalVisible(true);
          return;
        }

        // 2. 로컬 매칭 실패 시 온라인 API 검색 (count=10으로 충분히 수집)
        const geocodeRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            trimmed
          )}&count=10&language=ko&format=json`
        );
        if (!geocodeRes.ok) throw new Error('도시 검색에 실패했습니다.');
        const geocodeData = await geocodeRes.json();
        const results = geocodeData?.results as GeocodeResult[] | undefined;

        if (!results || results.length === 0) {
          throw new Error('검색된 지역이 없습니다. 정확한 읍, 면, 동 이름을 확인해 주세요.');
        }

        if (results.length === 1) {
          await fetchForecastByCoords(results[0].latitude, results[0].longitude, results[0]);
          setInputValue(results[0].name);
        } else {
          // 다중 결과 선택 처리
          const mapped: DistrictItem[] = results.map(r => ({
            name: r.name,
            fullName: [r.country, r.admin1, r.name].filter(Boolean).join(' '),
            latitude: r.latitude,
            longitude: r.longitude,
          }));
          setMatchedDistricts(mapped);
          setSelectorModalVisible(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [fetchForecastByCoords]
  );

  const fetchWeatherByCurrentLocation = useCallback(async () => {
    setLocationLoading(true);
    setError(null);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) throw new Error('휴대폰 위치 서비스가 꺼져 있습니다.');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('위치 권한이 거부되었습니다.');

      let coords: { latitude: number; longitude: number } | null = null;
      try {
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        coords = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };
      } catch {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown) {
          coords = {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          };
        }
      }
      if (!coords) throw new Error('현재 위치를 찾지 못했습니다.');

      // 1순위: Expo 정밀 로컬 reverseGeocode 사용 (한글 '시,도,동' 파싱을 위해 우선순위 상향)
      let reverseLocation: Partial<GeocodeResult> = {};
      try {
        const fallbackGeo = await Location.reverseGeocodeAsync({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        const top = fallbackGeo[0];
        if (top) {
          // '도 시 동/읍/면'을 정갈하게 나열 (예: 제주특별자치도 제주시 조천읍 / 서울특별시 강남구 역삼동)
          const formattedName = [top.region, top.city, top.district]
            .filter(Boolean)
            .join(' ');
          
          reverseLocation = {
            name: formattedName || '현재 위치',
            admin1: top.region || undefined,
            country: top.country || undefined,
          };
        }
      } catch {
        // Expo 지오코딩 실패 시 fallback
      }

      // 2순위: Open-Meteo 온라인 리버스 지오코딩 폴백
      if (!reverseLocation.name || reverseLocation.name === '현재 위치') {
        try {
          const reverseRes = await fetch(
            `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${coords.latitude}&longitude=${coords.longitude}&language=ko&format=json`
          );
          if (reverseRes.ok) {
            const reverseData = await reverseRes.json();
            const reverseTop = reverseData?.results?.[0] as GeocodeResult | undefined;
            if (reverseTop) {
              reverseLocation = {
                name: reverseTop.name,
                admin1: reverseTop.admin1,
                country: reverseTop.country,
              };
            }
          }
        } catch {
          // ignore fallback errors
        }
      }

      // 3순위: 최종 정보가 여전히 없을 때 위경도 표출
      if (!reverseLocation.name) {
        reverseLocation.name = `현재 위치 (${coords.latitude.toFixed(2)}, ${coords.longitude.toFixed(2)})`;
      }

      await fetchForecastByCoords(coords.latitude, coords.longitude, reverseLocation);
      setInputValue(reverseLocation.name ?? '현재 위치');
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLocationLoading(false);
    }
  }, [fetchForecastByCoords]);

  const pickHeaderImage = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('사진 접근 권한이 필요합니다.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
        aspect: [16, 9],
      });
      if (!result.canceled && result.assets.length > 0) {
        setHeaderImageUri(result.assets[0].uri);
      }
    } catch {
      setError('이미지를 불러오지 못했습니다.');
    }
  }, []);

  const dialCoastGuard = useCallback(async () => {
    const url = 'tel:122';
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
    else Alert.alert('긴급 연락', '해양경찰 122로 직접 전화해 주세요.');
  }, []);

  // 위도/경도가 포함된 긴급 SOS 문자 자동 작성 발송 기능
  const sendSOS = useCallback(async () => {
    if (!location) {
      Alert.alert('위치 미확인', '현재 위치 좌표 정보가 없습니다. GPS 위치 수신 후 전송하세요.');
      return;
    }
    
    const sosPhone = '119'; // 119 구조대 타깃
    const message = `[해상 긴급구조요청]\n- 위치: ${location.name}\n- 좌표: 위도 ${location.latitude.toFixed(5)}, 경도 ${location.longitude.toFixed(5)}\n- 풍속: ${Math.round(currentWindSpeed)}km/h\n기상 악화로 구조 지원을 요청합니다.`;
    
    // 플랫폼에 적합한 SMS URL 획득
    const url = Platform.OS === 'android' 
      ? `sms:${sosPhone}?body=${encodeURIComponent(message)}` 
      : `sms:${sosPhone}&body=${encodeURIComponent(message)}`;

    const can = await Linking.canOpenURL(url);
    if (can) {
      await Linking.openURL(url);
    } else {
      Alert.alert('전송 불가', '문자 메시지 앱을 열 수 없습니다. 직접 119로 신고해 주세요.');
    }
  }, [location, currentWindSpeed]);

  useEffect(() => {
    fetchWeatherByCity('제주시');
  }, [fetchWeatherByCity]);

  useEffect(() => {
    const loadSettings = async () => {
      const enabled = (await AsyncStorage.getItem(AUTO_UPDATE_KEY)) === 'true';
      setAutoUpdateEnabled(enabled);
      const nextAlarm = await AsyncStorage.getItem(NEXT_ALARM_KEY);
      if (nextAlarm) setNextAlarmText(formatDateTime(nextAlarm));
      else if (!enabled) setNextAlarmText('자동 갱신 꺼짐');
    };
    loadSettings();
  }, []);

  const hourlyData = useMemo<HourlyItem[]>(() => {
    const hourly = forecast?.hourly;
    if (!hourly?.time || !hourly?.temperature_2m || !hourly?.weather_code || !hourly?.wind_speed_10m) {
      return [];
    }
    return hourly.time
      .map((time, index) => ({
        time,
        temperature: hourly.temperature_2m[index] ?? 0,
        weatherCode: hourly.weather_code[index] ?? 0,
        windSpeed: hourly.wind_speed_10m[index] ?? 0,
      }))
      .filter((item) => item.time);
  }, [forecast]);

  // [NEW] 현재 시각에 가장 가까운 시간대 카드 인덱스 탐색
  const currentHourIndex = useMemo(() => {
    if (!hourlyData.length) return -1;
    const now = new Date();
    let minDiff = Infinity;
    let activeIdx = -1;
    for (let i = 0; i < hourlyData.length; i++) {
      const itemTime = new Date(hourlyData[i].time).getTime();
      const diff = Math.abs(itemTime - now.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        activeIdx = i;
      }
    }
    return activeIdx;
  }, [hourlyData]);

  // [NEW] 날씨 변경되거나 currentHourIndex 확정되면 자동 포커싱 스크롤
  useEffect(() => {
    if (currentHourIndex >= 0 && hourlyScrollViewRef.current) {
      const timer = setTimeout(() => {
        if (!isUserScrolling.current) {
          const cardWidth = 100;
          const gap = 9;
          const scrollTargetX = Math.max(0, currentHourIndex * (cardWidth + gap) - 100);
          hourlyScrollViewRef.current?.scrollTo({ x: scrollTargetX, animated: true });
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [currentHourIndex]);

  // [NEW] 4초 동안 추가 스크롤 액션이 없으면 원래 현재 시간 카드로 복귀시키는 타이머
  const setupScrollBackTimer = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      if (currentHourIndex >= 0 && hourlyScrollViewRef.current) {
        const cardWidth = 100;
        const gap = 9;
        const scrollTargetX = Math.max(0, currentHourIndex * (cardWidth + gap) - 100);
        hourlyScrollViewRef.current?.scrollTo({ x: scrollTargetX, animated: true });
      }
      isUserScrolling.current = false;
    }, 4000);
  }, [currentHourIndex]);

  const onScrollBeginDrag = useCallback(() => {
    isUserScrolling.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  }, []);

  const onScrollEndDrag = useCallback(() => {
    setupScrollBackTimer();
  }, [setupScrollBackTimer]);

  const onMomentumScrollEnd = useCallback(() => {
    setupScrollBackTimer();
  }, [setupScrollBackTimer]);

  const dailyData = useMemo<DailyItem[]>(() => {
    const daily = forecast?.daily;
    if (
      !daily?.time ||
      !daily?.temperature_2m_max ||
      !daily?.temperature_2m_min ||
      !daily?.weather_code ||
      !daily?.wind_speed_10m_max
    ) {
      return [];
    }
    return daily.time
      .map((date, index) => ({
        date,
        max: daily.temperature_2m_max[index] ?? 0,
        min: daily.temperature_2m_min[index] ?? 0,
        weatherCode: daily.weather_code[index] ?? 0,
        windSpeedMax: daily.wind_speed_10m_max[index] ?? 0,
      }))
      .filter((item) => item.date);
  }, [forecast]);

  const waveAlert = useMemo(() => {
    if (!forecast?.current) return null;
    return getWaveAlert(forecast.current.wind_speed_10m, forecast.current.weather_code);
  }, [forecast]);

  const windAlert = useMemo(() => {
    if (!forecast?.current) return null;
    return getWindAlert(forecast.current.wind_speed_10m);
  }, [forecast]);

  const topAlert = useMemo(() => {
    if (!waveAlert || !windAlert) return null;
    const wLevel = waveAlert.level === '경계' ? 2 : waveAlert.level === '주의' ? 1 : 0;
    const wiLevel = windAlert.level === '경계' ? 2 : windAlert.level === '주의' ? 1 : 0;
    return wLevel >= wiLevel ? waveAlert : windAlert;
  }, [waveAlert, windAlert]);

  useEffect(() => {
    if (!topAlert) return;
    const topVal = topAlert.level === '경계' ? 2 : topAlert.level === '주의' ? 1 : 0;

    if (topVal >= 1 && topAlert.level !== lastPopupLevel.current) {
      Alert.alert(`${topAlert.title} ${topAlert.level}`, topAlert.message, [{ text: '확인' }]);
    }
    lastPopupLevel.current = topAlert.level;
  }, [topAlert]);

  const scheduleMorningBriefing = useCallback(async () => {
    if (!forecast?.daily?.sunrise?.length || !location || !waveAlert || !windAlert) return;
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      setNextAlarmText('알림 권한 거부됨');
      return;
    }
    await Notifications.setNotificationChannelAsync('marine-alerts', {
      name: '해상 주의 알림',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });

    const currentWaveAlert = getWaveAlert(forecast.current.wind_speed_10m, forecast.current.weather_code);
    const currentWindAlert = getWindAlert(forecast.current.wind_speed_10m);
    const riskScore = marineRiskScore(
      forecast.current.wind_speed_10m,
      forecast.current.weather_code,
      currentWaveAlert.level,
      currentWindAlert.level
    );

    const date = resolveAlarmDate(forecast.daily.sunrise, new Date());
    const stage = getSailingStage(riskScore);
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '해뜨기 전 해상 브리핑',
        body: `${location.name} ${stage.title}, 파도 ${waveAlert.level}, 바람 ${windAlert.level}, 풍속 ${Math.round(
          forecast.current.wind_speed_10m
        )}km/h`,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: 'marine-alerts',
      },
    });
    await AsyncStorage.setItem(NEXT_ALARM_KEY, date.toISOString());
    setNextAlarmText(formatDateTime(date.toISOString(), location.timezone));
  }, [forecast, location, waveAlert, windAlert]);

  useEffect(() => {
    if (!autoUpdateEnabled) return;
    registerMarineBackgroundTask();
    scheduleMorningBriefing();
  }, [autoUpdateEnabled, scheduleMorningBriefing]);

  const toggleAutoUpdate = async (next: boolean) => {
    setAutoUpdateEnabled(next);
    await AsyncStorage.setItem(AUTO_UPDATE_KEY, String(next));
    if (next) {
      await registerMarineBackgroundTask();
      await scheduleMorningBriefing();
      return;
    }

    const registered = await TaskManager.isTaskRegisteredAsync(MARINE_BG_TASK);
    if (registered) {
      await BackgroundFetch.unregisterTaskAsync(MARINE_BG_TASK);
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem(NEXT_ALARM_KEY);
    setNextAlarmText('자동 갱신 꺼짐');
  };

  const onSearch = () => {
    const next = inputValue.trim();
    if (!next) {
      setError('도시 이름을 입력해 주세요.');
      return;
    }
    fetchWeatherByCity(next);
  };

  // 🔔 5초 뒤 강제 푸시 알림 발동기 (알림 수신 테스트용)
  const triggerTestNotification = useCallback(async () => {
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('권한 거부', '알림 권한이 허용되지 않았습니다. 폰 설정에서 알림 권한을 켜주세요.');
      return;
    }

    const currentWaveAlert = getWaveAlert(currentWindSpeed, currentWeatherCode);
    const currentWindAlert = getWindAlert(currentWindSpeed);
    const score = marineRiskScore(
      currentWindSpeed,
      currentWeatherCode,
      currentWaveAlert.level,
      currentWindAlert.level
    );
    
    const stage = getSailingStage(score);
    const wave = currentWaveAlert.level;
    const wind = currentWindAlert.level;
    
    Alert.alert('알림 테스트 개시', '정확히 5초 뒤에 폰 상단에 푸시 알림이 나타납니다. 확인을 누르신 뒤 홈 화면으로 나가셔도 됩니다.');

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '해뜨기 전 해상 브리핑 (테스트)',
        body: `${location?.name ?? '제주시'} ${stage.title}, 파도 ${wave}, 바람 ${wind}, 풍속 ${Math.round(currentWindSpeed)}km/h`,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
        channelId: 'marine-alerts',
      },
    });
  }, [location, currentWeatherCode, currentWindSpeed]);

  const riskScore = useMemo(() => {
    if (!forecast?.current || !waveAlert || !windAlert) return 0;
    return marineRiskScore(
      forecast.current.wind_speed_10m,
      forecast.current.weather_code,
      waveAlert.level,
      windAlert.level
    );
  }, [forecast, waveAlert, windAlert]);

  const decision = marineDecision(riskScore);
  const sailingStage = getSailingStage(riskScore);
  const decisionTheme = getDecisionTheme(decision);

  return (
    <LinearGradient colors={dynamicThemeColors} style={styles.bg}>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.container}>
          <ImageBackground
            source={headerImageUri ? { uri: headerImageUri } : defaultHeaderImage}
            style={styles.heroImage}
            imageStyle={styles.heroImageStyle}
          >
            <View style={styles.heroOverlay}>
              <Image source={appLogo} style={styles.heroLogo} resizeMode="contain" />
              <Text style={styles.heroTitle}>해상 안전 브리핑</Text>
              <Text style={styles.heroSub}>풍량/파도 자동 알림 지원</Text>
            </View>
          </ImageBackground>

          {/* 비상 대응 버튼 셋 */}
          <View style={styles.imageButtons}>
            <Pressable style={styles.imageBtn} onPress={pickHeaderImage}>
              <Text style={styles.imageBtnText}>배경 변경</Text>
            </Pressable>
            <Pressable style={styles.imageBtnGhost} onPress={() => setHeaderImageUri(null)}>
              <Text style={styles.imageBtnGhostText}>기본화면</Text>
            </Pressable>
            <Pressable style={styles.sosMsgBtn} onPress={sendSOS}>
              <Text style={styles.sosMsgText}>🚨 긴급 SOS 문자</Text>
            </Pressable>
            <Pressable style={styles.emergencyBtn} onPress={dialCoastGuard}>
              <Text style={styles.emergencyBtnText}>해경122</Text>
            </Pressable>
          </View>

          {/* 리팩토링된 글래스모피즘 검색창 */}
          <SearchRow value={inputValue} onChangeText={setInputValue} onSearch={onSearch} />

          <Pressable style={styles.locationBtn} onPress={fetchWeatherByCurrentLocation}>
            <Text style={styles.locationBtnText}>
              {locationLoading ? '위치 확인 중...' : '내 위치 해상 정보'}
            </Text>
          </Pressable>

          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingTitle}>풍량 주의보 자동 알림</Text>
              <Text style={styles.settingSub}>앱을 안 열어도 일출 전 자동 안내</Text>
            </View>
            <Switch value={autoUpdateEnabled} onValueChange={toggleAutoUpdate} />
          </View>

          <View style={styles.alarmCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.alarmTitle}>해뜨기 30분 전 알림</Text>
                <Text style={styles.alarmText}>{nextAlarmText}</Text>
              </View>
              <Pressable style={styles.testAlarmBtn} onPress={triggerTestNotification}>
                <Text style={styles.testAlarmText}>🔔 즉시 테스트</Text>
              </Pressable>
            </View>
          </View>

          {/* 🎧 안트그라비티 날씨 브리핑 컨트롤 카드 */}
          <View style={styles.briefingCard}>
            <Text style={styles.briefingTitle}>🎧 안트그라비티 날씨 음성 브리핑</Text>
            
            <View style={styles.briefingBtnRow}>
              <Pressable 
                style={[styles.playBtn, isSpeaking && styles.stopBtn]} 
                onPress={isSpeaking ? stopBriefing : startBriefing}
              >
                <Text style={styles.playBtnText}>
                  {isSpeaking ? '⏹️ 브리핑 정지' : '▶️ 브리핑 듣기'}
                </Text>
              </Pressable>
              
              <Pressable style={styles.genderBtn} onPress={toggleVoiceGender}>
                <Text style={styles.genderBtnText}>
                  {voiceGender === 'female' ? '👩 여성 아나운서' : '👨 남성 아나운서'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.briefingSubRow}>
              <Text style={styles.apiKeyStatusText}>
                {apiKey ? '구글 Cloud TTS: Neural2 사용 중' : '구글 TTS: 키 미설정 (내장 TTS 폴백)'}
              </Text>
              <Pressable style={styles.apiKeySettingBtn} onPress={() => setShowApiKeyModal(true)}>
                <Text style={styles.apiKeySettingText}>⚙️ 키 설정</Text>
              </Pressable>
            </View>
          </View>

          {(loading || locationLoading) && (
            <View style={styles.centerBlock}>
              <ActivityIndicator size="large" color="#b8e7ff" />
              <Text style={styles.loadingText}>해상 데이터 불러오는 중...</Text>
            </View>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          {!loading && !locationLoading && forecast && location && waveAlert && windAlert && (
            <>
              {/* 리팩토링된 입체적 게이지의 출항판단 카드 (음성 브리핑 인자 포함) */}
              <JudgementCard
                riskScore={riskScore}
                decision={decision}
                sailingStage={sailingStage}
                decisionTheme={decisionTheme}
                locationName={location.name}
                temperature={forecast.current.temperature_2m}
                weatherLabelStr={weatherLabel(forecast.current.weather_code)}
                windSpeed={forecast.current.wind_speed_10m}
                waveAlertLevel={waveAlert.level}
                windAlertLevel={windAlert.level}
              />

              {/* [NEW] 물때 및 해수온 정보 예측 카드 */}
              <MarineTideCard tideData={tideForecastData} timezone={location.timezone} />

              <View style={styles.card}>
                <View style={styles.heroRow}>
                  <View style={styles.heroLeft}>
                    <Text style={styles.cityText}>
                      {location.name}
                      {location.admin1 ? `, ${location.admin1}` : ''}
                      {location.country ? ` (${location.country})` : ''}
                    </Text>
                    <Text style={styles.tempText}>{Math.round(forecast.current.temperature_2m)}°</Text>
                    <Text style={styles.stateText}>{weatherLabel(forecast.current.weather_code)}</Text>
                  </View>
                  <Animated.View style={mainIconMotion}>
                    <Image source={weatherIconSource(forecast.current.weather_code, 'large')} style={styles.mainIcon} />
                  </Animated.View>
                </View>
              </View>

              <View style={[styles.alertBanner, { backgroundColor: waveAlert.bgColor, borderColor: waveAlert.borderColor }]}>
                <Text style={styles.alertTitle}>{waveAlert.title}: {waveAlert.level}</Text>
                <Text style={styles.alertText}>{waveAlert.message}</Text>
              </View>

              <View style={[styles.alertBanner, { backgroundColor: windAlert.bgColor, borderColor: windAlert.borderColor }]}>
                <Text style={styles.alertTitle}>{windAlert.title}: {windAlert.level}</Text>
                <Text style={styles.alertText}>{windAlert.message}</Text>
              </View>

              <Text style={styles.sectionTitle}>시간대별 파도/풍량</Text>
              <ScrollView
                ref={hourlyScrollViewRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                onScrollBeginDrag={onScrollBeginDrag}
                onScrollEndDrag={onScrollEndDrag}
                onMomentumScrollEnd={onMomentumScrollEnd}
                scrollEventThrottle={16}
              >
                <View style={styles.hourlyRow}>
                  {hourlyData.map((hour, idx) => {
                    const isActive = idx === currentHourIndex;
                    const cardScale = isActive
                      ? hourlyPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1.02, 1.08],
                        })
                      : 1.0;

                    return (
                      <Animated.View
                        key={hour.time}
                        style={[
                          styles.hourCard,
                          { transform: [{ scale: cardScale }] },
                          isActive && styles.activeHourCard,
                        ]}
                      >
                        <Text style={[styles.hourTime, isActive && styles.activeHourText]}>
                          {formatHour(hour.time, location.timezone)}
                          {isActive ? ' (현재)' : ''}
                        </Text>
                        <Animated.View style={hourlyIconMotionByWind(hour.windSpeed)}>
                          <Image source={dailyQIconByWind(hour.windSpeed)} style={styles.hourIcon} resizeMode="contain" />
                        </Animated.View>
                        <Text style={[styles.hourTemp, isActive && styles.activeHourText]}>{Math.round(hour.windSpeed)} km/h</Text>
                        <Text style={[styles.hourState, isActive && styles.activeHourSubText]}>{hourlyWaveLabelByWind(hour.windSpeed)}</Text>
                      </Animated.View>
                    );
                  })}
                </View>
              </ScrollView>

              <Text style={styles.sectionTitle}>7일 풍량 예보</Text>
              <View style={styles.dailyList}>
                {dailyData.map((day) => (
                  <View key={day.date} style={styles.dailyRow}>
                    <View style={styles.dailyLeft}>
                      <Animated.View style={smallIconMotion}>
                        <Image source={dailyQIconByWind(day.windSpeedMax)} style={styles.dailyIcon} resizeMode="contain" />
                      </Animated.View>
                      <View>
                        <Text style={styles.dailyDate}>{formatDay(day.date, location.timezone)}</Text>
                        <Text style={styles.dailyState}>{hourlyWaveLabelByWind(day.windSpeedMax)}</Text>
                      </View>
                    </View>
                    <Text style={styles.dailyTemp}>
                      최대 {Math.round(day.windSpeedMax)} km/h
                    </Text>
                  </View>
                ))}
              </View>

              {/* [NEW] 안전 점검 체크리스트 대치 탑재 */}
              <Text style={styles.sectionTitle}>자가 안전 진단</Text>
              <SafetyChecklist />
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* 중복 지역 선택 모달 */}
      <DistrictSelectorModal
        visible={selectorModalVisible}
        districts={matchedDistricts}
        onSelect={onSelectDistrict}
        onClose={() => setSelectorModalVisible(false)}
      />

      {/* ⚙️ Google Cloud API Key 설정 모달 */}
      <Modal
        visible={showApiKeyModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowApiKeyModal(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Google Cloud API Key 설정</Text>
            <Text style={styles.modalSub}>
              OAuth Client Secret 대신 M2M 호출을 위해 Google Cloud API Key를 사용합니다. 
              API Key가 없거나 입력하지 않으면 기기 내장 TTS로 자동 대체됩니다.
            </Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Google Cloud API Key 입력"
              placeholderTextColor="#88aacc"
              value={apiKeyTemp}
              onChangeText={setApiKeyTemp}
              secureTextEntry={true}
            />

            <View style={styles.modalBtnRow}>
              <Pressable 
                style={styles.modalCancelBtn} 
                onPress={() => {
                  setApiKeyTemp(apiKey);
                  setShowApiKeyModal(false);
                }}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </Pressable>
              
              <Pressable 
                style={styles.modalSaveBtn} 
                onPress={() => saveApiKey(apiKeyTemp)}
              >
                <Text style={styles.modalSaveText}>저장</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  safe: { flex: 1 },
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  heroImage: {
    height: 170,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroImageStyle: { borderRadius: 20 },
  heroOverlay: {
    backgroundColor: 'rgba(3, 9, 16, 0.44)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  heroLogo: {
    width: 156,
    height: 47,
    marginBottom: 8,
    alignSelf: 'flex-start',
    marginLeft: -18,
  },
  heroTitle: { color: '#f4fbff', fontSize: 28, fontWeight: '900' },
  heroSub: { color: '#d5edff', fontSize: 13, marginTop: 3 },
  imageButtons: { marginTop: 10, marginBottom: 12, flexDirection: 'row', gap: 6 },
  imageBtn: {
    flex: 1.1,
    backgroundColor: '#1e496b',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  imageBtnText: { color: '#dff1ff', fontWeight: '700', fontSize: 11 },
  imageBtnGhost: {
    flex: 1.1,
    backgroundColor: '#0d253d',
    borderColor: '#3e6f97',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  imageBtnGhostText: { color: '#a7d0ee', fontWeight: '700', fontSize: 11 },
  sosMsgBtn: {
    flex: 1.8,
    backgroundColor: '#7e2730',
    borderColor: '#e53935',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e53935',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  sosMsgText: { color: '#fff5f5', fontWeight: '800', fontSize: 11 },
  emergencyBtn: {
    flex: 1.1,
    backgroundColor: '#37474f',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyBtnText: { color: '#eceff1', fontWeight: '800', fontSize: 11 },
  settingRow: {
    borderRadius: 12,
    borderColor: '#3a6790',
    borderWidth: 1,
    backgroundColor: '#102c46',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  settingTitle: { color: '#d8efff', fontSize: 13, fontWeight: '700' },
  settingSub: { color: '#9dc5df', fontSize: 11, marginTop: 2 },
  locationBtn: {
    marginTop: 6,
    marginBottom: 12,
    backgroundColor: '#102c46',
    borderColor: '#3f7098',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
  },
  locationBtnText: { color: '#cce8ff', fontWeight: '700', fontSize: 14 },
  alarmCard: {
    borderRadius: 12,
    backgroundColor: '#0f2b44',
    borderColor: '#355f86',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  testAlarmBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    marginLeft: 10,
  },
  testAlarmText: {
    color: '#b8e7ff',
    fontSize: 11,
    fontWeight: '800',
  },
  alarmTitle: { color: '#a8d3f2', fontSize: 12 },
  alarmText: { color: '#e6f5ff', fontSize: 14, fontWeight: '700', marginTop: 4 },
  centerBlock: { marginTop: 24, alignItems: 'center' },
  loadingText: { marginTop: 8, color: '#d7ebfa' },
  errorText: {
    color: '#ffe2e2',
    backgroundColor: 'rgba(109, 23, 39, 0.82)',
    borderColor: '#ff7190',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  card: {
    marginTop: 8,
    borderRadius: 20,
    padding: 16,
    backgroundColor: 'rgba(13, 33, 52, 0.75)',
    borderColor: '#325c85',
    borderWidth: 1,
  },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLeft: { flex: 1 },
  cityText: { color: '#d3ecff', fontSize: 16, fontWeight: '600' },
  tempText: { color: '#ffffff', fontSize: 60, lineHeight: 66, fontWeight: '900', marginTop: 8 },
  stateText: { color: '#98c5e4', marginTop: 2, fontSize: 16, fontWeight: '700' },
  mainIcon: { width: 120, height: 120, marginLeft: 8 },
  alertBanner: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  alertTitle: { color: '#fff8de', fontSize: 13, fontWeight: '800' },
  alertText: { color: '#fefaf0', fontSize: 12, marginTop: 4 },
  sectionTitle: { color: '#e7f5ff', fontSize: 17, fontWeight: '800', marginTop: 18, marginBottom: 10 },
  hourlyRow: { flexDirection: 'row', gap: 9, paddingBottom: 2 },
  hourCard: {
    width: 100,
    backgroundColor: 'rgba(13, 35, 57, 0.82)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#315a82',
    padding: 10,
    alignItems: 'center',
  },
  hourTime: { color: '#d2e9f9', fontSize: 12 },
  hourIcon: { width: 48, height: 48, marginTop: 6 },
  hourTemp: { color: '#ffffff', marginTop: 2, fontSize: 16, fontWeight: '800' },
  hourState: { color: '#a9c9de', fontSize: 11, marginTop: 2 },
  dailyList: { gap: 8 },
  dailyRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#315a82',
    backgroundColor: 'rgba(13, 35, 57, 0.82)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dailyLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dailyIcon: { width: 62, height: 24 },
  dailyDate: { color: '#e5f3ff', fontSize: 13, fontWeight: '700' },
  dailyState: { color: '#a9c9de', fontSize: 12, marginTop: 1 },
  dailyTemp: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  activeHourCard: {
    borderColor: '#3a95d2',
    shadowColor: '#3a95d2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 6,
    backgroundColor: 'rgba(28, 54, 82, 0.95)',
  },
  activeHourText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  activeHourSubText: {
    color: '#3a95d2',
    fontWeight: '700',
  },
  briefingCard: {
    borderRadius: 14,
    backgroundColor: '#0c243a',
    borderColor: '#2e587e',
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  briefingTitle: {
    color: '#e2f3ff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  briefingBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  playBtn: {
    flex: 1,
    backgroundColor: '#1b8ed7',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBtn: {
    backgroundColor: '#b71c1c',
  },
  playBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  genderBtn: {
    flex: 1.1,
    backgroundColor: '#143857',
    borderColor: '#315f8a',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderBtnText: {
    color: '#d0ebff',
    fontSize: 13,
    fontWeight: '700',
  },
  briefingSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  apiKeyStatusText: {
    color: '#8abce0',
    fontSize: 11,
    flex: 1,
  },
  apiKeySettingBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
  },
  apiKeySettingText: {
    color: '#a8d5f5',
    fontSize: 11,
    fontWeight: '700',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#0d273f',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2e5b85',
    padding: 20,
    alignItems: 'stretch',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSub: {
    color: '#9cc7e6',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#051627',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#21496d',
    color: '#ffffff',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#1b3246',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#aed6f5',
    fontSize: 14,
    fontWeight: '700',
  },
  modalSaveBtn: {
    flex: 1.2,
    backgroundColor: '#1b8ed7',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  modalSaveText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
