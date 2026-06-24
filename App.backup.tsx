import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  ImageBackground,
  type ImageSourcePropType,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const defaultHeaderImage = require('./wave.png');
const appLogo = require('./logo.png');
const wave02 = require('./wave-02.png');
const wave03 = require('./wave-03.png');
const wave04 = require('./wave-04.png');
const wave05 = require('./wave-05.png');
const q01 = require('./icon/q-01.png');
const q02 = require('./icon/q-02.png');
const q03 = require('./icon/q-03.png');
const q04 = require('./icon/q-04.png');
const q05 = require('./icon/q-05.png');
const q06 = require('./icon/q-06.png');
const q07 = require('./icon/q-07.png');
const q08 = require('./icon/q-08.png');
const b01 = require('./icon/b-01.png');
const b02 = require('./icon/b-02.png');
const b03 = require('./icon/b-03.png');
const b04 = require('./icon/b-04.png');

const MARINE_BG_TASK = 'marine-daily-auto-refresh';
const AUTO_UPDATE_KEY = 'marine_auto_update_enabled';
const LAST_CONTEXT_KEY = 'marine_last_context';
const NEXT_ALARM_KEY = 'marine_next_alarm_iso';

type GeocodeResult = {
  latitude: number;
  longitude: number;
  name: string;
  country?: string;
  admin1?: string;
  timezone?: string;
};

type ForecastResponse = {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    wind_speed_10m: number[];
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    wind_speed_10m_max: number[];
    sunrise: string[];
    sunset: string[];
  };
};

type HourlyItem = {
  time: string;
  temperature: number;
  weatherCode: number;
  windSpeed: number;
};

type DailyItem = {
  date: string;
  max: number;
  min: number;
  weatherCode: number;
  windSpeedMax: number;
};

type AlertLevel = '안전' | '주의' | '경계';

type AlertInfo = {
  level: AlertLevel;
  title: string;
  message: string;
  bgColor: string;
  borderColor: string;
};

type StoredContext = {
  latitude: number;
  longitude: number;
  name: string;
};

type SailingStage = {
  code: 'b-01' | 'b-02' | 'b-03' | 'b-04';
  title: string;
  subtitle: string;
  image: number;
};

type DecisionTheme = {
  cardBg: string;
  cardBorder: string;
  valueColor: string;
};

const weatherLabelByCode: Record<number, string> = {
  0: '맑음',
  1: '대체로 맑음',
  2: '부분 흐림',
  3: '흐림',
  45: '안개',
  48: '서리 안개',
  51: '약한 이슬비',
  53: '이슬비',
  55: '강한 이슬비',
  61: '약한 비',
  63: '비',
  65: '강한 비',
  71: '약한 눈',
  73: '눈',
  75: '강한 눈',
  80: '소나기',
  81: '강한 소나기',
  82: '매우 강한 소나기',
  95: '뇌우',
  96: '우박 동반 뇌우',
  99: '강한 우박',
};

const levelWeight: Record<AlertLevel, number> = {
  안전: 0,
  주의: 1,
  경계: 2,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function weatherLabel(code: number) {
  return weatherLabelByCode[code] ?? '알 수 없음';
}

function isClearCode(code: number) {
  return code === 0 || code === 1;
}

function isRainOrStormCode(code: number) {
  return (code >= 51 && code <= 67) || [80, 81, 82, 95, 96, 99].includes(code);
}

function weatherIconCode(code: number) {
  if (code === 0) return '01d';
  if (code === 1) return '02d';
  if (code === 2) return '03d';
  if (code === 3) return '04d';
  if ([45, 48].includes(code)) return '50d';
  if ([51, 53, 55].includes(code)) return '09d';
  if ([61, 63, 65, 80, 81, 82].includes(code)) return '10d';
  if ([71, 73, 75].includes(code)) return '13d';
  if ([95, 96, 99].includes(code)) return '11d';
  return '03d';
}

function weatherIconUrl(code: number, size: 'small' | 'large' = 'small') {
  const icon = weatherIconCode(code);
  const scale = size === 'large' ? '@4x' : '@2x';
  return `https://openweathermap.org/img/wn/${icon}${scale}.png`;
}

function weatherIconSource(code: number, size: 'small' | 'large' = 'small'): ImageSourcePropType {
  if ([0, 1].includes(code)) return q01;
  if (code === 2) return q02;
  if (code === 3) return q05;
  if ([45, 48].includes(code)) return q07;
  if ([51, 53].includes(code)) return q03;
  if ([55, 61].includes(code)) return q04;
  if ([63, 65, 80, 81, 82].includes(code)) return q06;
  if ([71, 73, 75].includes(code)) return q08;
  if ([95, 96, 99].includes(code)) return q08;
  return { uri: weatherIconUrl(code, size) };
}

function formatHour(iso: string, timezone = 'UTC') {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(new Date(iso));
}

function formatDateTime(iso: string, timezone = 'UTC') {
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(new Date(iso));
}

function formatDay(iso: string, timezone = 'UTC') {
  return new Intl.DateTimeFormat('ko-KR', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  }).format(new Date(iso));
}

function getWaveAlert(windSpeedKmh: number, weatherCode: number): AlertInfo {
  if (weatherCode >= 95 || windSpeedKmh >= 40) {
    return {
      level: '경계',
      title: '파도 주의보',
      message: '높은 파도가 예상됩니다. 해안 접근과 해양 활동을 피하세요.',
      bgColor: 'rgba(178, 41, 41, 0.35)',
      borderColor: '#ff7474',
    };
  }
  if ([80, 81, 82].includes(weatherCode) || windSpeedKmh >= 25) {
    return {
      level: '주의',
      title: '파도 주의보',
      message: '파도 상태가 불안정할 수 있습니다. 해안가에서 주의하세요.',
      bgColor: 'rgba(170, 108, 21, 0.35)',
      borderColor: '#ffc16f',
    };
  }
  return {
    level: '안전',
    title: '파도 주의보',
    message: '현재 강한 파도 위험은 낮습니다.',
    bgColor: 'rgba(22, 116, 83, 0.34)',
    borderColor: '#73e2b8',
  };
}

function getWindAlert(windSpeedKmh: number): AlertInfo {
  if (windSpeedKmh >= 50) {
    return {
      level: '경계',
      title: '바람 주의보',
      message: '강풍 위험이 큽니다. 출항과 작업을 중지하고 안전지대로 이동하세요.',
      bgColor: 'rgba(110, 57, 180, 0.35)',
      borderColor: '#c090ff',
    };
  }
  if (windSpeedKmh >= 30) {
    return {
      level: '주의',
      title: '바람 주의보',
      message: '강한 바람이 예상됩니다. 갑판 작업과 이동 시 고정 상태를 확인하세요.',
      bgColor: 'rgba(170, 108, 21, 0.35)',
      borderColor: '#ffc16f',
    };
  }
  return {
    level: '안전',
    title: '바람 주의보',
    message: '현재 강풍 위험은 낮습니다.',
    bgColor: 'rgba(22, 116, 83, 0.34)',
    borderColor: '#73e2b8',
  };
}

function marineRiskScore(
  windSpeed: number,
  weatherCode: number,
  waveLevel: AlertLevel,
  windLevel: AlertLevel
) {
  let score = 15;
  score += Math.min(55, Math.round(windSpeed * 1.2));
  if ([80, 81, 82].includes(weatherCode)) score += 12;
  if (weatherCode >= 95) score += 18;
  score += levelWeight[waveLevel] * 8;
  score += levelWeight[windLevel] * 8;
  return Math.max(0, Math.min(100, score));
}

function marineDecision(score: number) {
  if (score >= 75) return '출항 금지';
  if (score >= 45) return '출항 주의';
  return '출항 가능';
}

function hourlyWaveLabelByWind(windSpeedKmh: number) {
  if (windSpeedKmh >= 50) return '매우 거침';
  if (windSpeedKmh >= 35) return '거침';
  if (windSpeedKmh >= 20) return '약간 거침';
  return '비교적 잔잔';
}

function getSailingStage(score: number): SailingStage {
  if (score < 25) {
    return {
      code: 'b-01',
      title: '출항 가능',
      subtitle: '잔잔한 편입니다. 기본 안전수칙을 지키며 운항하세요.',
      image: b01,
    };
  }
  if (score < 45) {
    return {
      code: 'b-02',
      title: '출항 가능(주의)',
      subtitle: '작업 시간과 이동 경로를 짧게 운영하세요.',
      image: b02,
    };
  }
  if (score < 70) {
    return {
      code: 'b-03',
      title: '출항 자제',
      subtitle: '반드시 동행 출항하고 비상연락 상태를 유지하세요.',
      image: b03,
    };
  }
  return {
    code: 'b-04',
    title: '출항 금지',
    subtitle: '기상 안정 시까지 출항 및 해상 작업을 중지하세요.',
    image: b04,
  };
}

function getDecisionTheme(decision: string): DecisionTheme {
  if (decision === '출항 가능') {
    return {
      cardBg: '#123926',
      cardBorder: '#2b8a5a',
      valueColor: '#8df0bc',
    };
  }
  return {
    cardBg: '#5d1010',
    cardBorder: '#ff5c5c',
    valueColor: '#ffd1d1',
  };
}

function waveImageByWind(windSpeedKmh: number) {
  if (windSpeedKmh < 20) return wave02;
  if (windSpeedKmh < 35) return wave03;
  if (windSpeedKmh < 50) return wave04;
  return wave05;
}

function dailyQIconByWind(windSpeedKmh: number) {
  if (windSpeedKmh < 5) return q01;
  if (windSpeedKmh < 10) return q02;
  if (windSpeedKmh < 15) return q03;
  if (windSpeedKmh < 20) return q04;
  if (windSpeedKmh < 25) return q05;
  if (windSpeedKmh < 30) return q06;
  if (windSpeedKmh < 35) return q07;
  return q08;
}

function resolveAlarmDate(sunrises: string[], now: Date) {
  let candidate = new Date(new Date(sunrises[0]).getTime() - 30 * 60 * 1000);
  if (candidate <= now && sunrises.length > 1) {
    candidate = new Date(new Date(sunrises[1]).getTime() - 30 * 60 * 1000);
  }
  if (candidate <= now) {
    candidate = new Date(now.getTime() + 15 * 60 * 1000);
  }
  return candidate;
}

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
  const lastPopupLevel = useRef<AlertLevel>('안전');
  const currentWeatherCode = forecast?.current.weather_code ?? 0;
  const canUseNativeDriver = Platform.OS !== 'web';
  const stageFloat = useRef(new Animated.Value(0)).current;
  const mainFloat = useRef(new Animated.Value(0)).current;
  const dailyFloat = useRef(new Animated.Value(0)).current;
  const hourlyFloat = useRef(new Animated.Value(0)).current;
  const mainPulse = useRef(new Animated.Value(0)).current;
  const hourlyPulse = useRef(new Animated.Value(0)).current;
  const stageLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const mainLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const dailyLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const hourlyLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const mainPulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const hourlyPulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const restartIconAnimations = useCallback(() => {
    stageLoopRef.current?.stop();
    mainLoopRef.current?.stop();
    dailyLoopRef.current?.stop();
    hourlyLoopRef.current?.stop();
    mainPulseLoopRef.current?.stop();
    hourlyPulseLoopRef.current?.stop();

    stageFloat.setValue(0);
    mainFloat.setValue(0);
    dailyFloat.setValue(0);
    hourlyFloat.setValue(0);
    mainPulse.setValue(0);
    hourlyPulse.setValue(0);

    stageLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(stageFloat, {
          toValue: 1,
          duration: 1850,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: canUseNativeDriver,
        }),
        Animated.timing(stageFloat, {
          toValue: 0,
          duration: 1850,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: canUseNativeDriver,
        }),
      ])
    );
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

    stageLoopRef.current.start();
    mainLoopRef.current.start();
    dailyLoopRef.current.start();
    hourlyLoopRef.current.start();
    mainPulseLoopRef.current.start();
    hourlyPulseLoopRef.current.start();
  }, [canUseNativeDriver, stageFloat, mainFloat, dailyFloat, hourlyFloat, mainPulse, hourlyPulse]);

  useEffect(() => {
    restartIconAnimations();
    return () => {
      stageLoopRef.current?.stop();
      mainLoopRef.current?.stop();
      dailyLoopRef.current?.stop();
      hourlyLoopRef.current?.stop();
      mainPulseLoopRef.current?.stop();
      hourlyPulseLoopRef.current?.stop();
    };
  }, [restartIconAnimations]);

  useEffect(() => {
    if (!forecast || !location || loading || locationLoading) return;
    restartIconAnimations();
  }, [forecast, location, loading, locationLoading, restartIconAnimations]);

  const stageIconMotion = useMemo(
    () => ({
      transform: [
        {
          translateY: stageFloat.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -5],
          }),
        },
      ],
    }),
    [stageFloat]
  );

  const mainIconMotion = useMemo(
    () => {
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
    },
    [currentWeatherCode, mainFloat, mainPulse]
  );

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
    async (
      latitude: number,
      longitude: number,
      nextLocation?: Partial<GeocodeResult>
    ) => {
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

  const fetchWeatherByCity = useCallback(
    async (city: string) => {
      setLoading(true);
      setError(null);
      try {
        const geocodeRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            city
          )}&count=1&language=ko&format=json`
        );
        if (!geocodeRes.ok) throw new Error('도시 검색에 실패했습니다.');
        const geocodeData = await geocodeRes.json();
        const topResult = geocodeData?.results?.[0] as GeocodeResult | undefined;
        if (!topResult) throw new Error('도시를 찾을 수 없습니다.');
        await fetchForecastByCoords(topResult.latitude, topResult.longitude, topResult);
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

      const reverseRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${coords.latitude}&longitude=${coords.longitude}&language=ko&format=json`
      );
      let reverseLocation: Partial<GeocodeResult> = { name: '현재 위치' };
      if (reverseRes.ok) {
        const reverseData = await reverseRes.json();
        const reverseTop = reverseData?.results?.[0] as GeocodeResult | undefined;
        if (reverseTop) reverseLocation = reverseTop;
      }
      if (reverseLocation.name === '현재 위치') {
        try {
          const fallbackGeo = await Location.reverseGeocodeAsync({
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
          const top = fallbackGeo[0];
          if (top) {
            reverseLocation = {
              name: top.city || top.subregion || top.district || '현재 위치',
              admin1: top.region || undefined,
              country: top.country || undefined,
            };
          }
        } catch {
          // ignore fallback errors
        }
      }
      if (reverseLocation.name === '현재 위치') {
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
    return hourly.time.map((time, index) => ({
      time,
      temperature: hourly.temperature_2m[index] ?? 0,
      weatherCode: hourly.weather_code[index] ?? 0,
      windSpeed: hourly.wind_speed_10m[index] ?? 0,
    })).filter((item) => item.time);
  }, [forecast]);

  const dailyData = useMemo<DailyItem[]>(() => {
    const daily = forecast?.daily;
    if (!daily?.time || !daily?.temperature_2m_max || !daily?.temperature_2m_min || !daily?.weather_code || !daily?.wind_speed_10m_max) {
      return [];
    }
    return daily.time.map((date, index) => ({
      date,
      max: daily.temperature_2m_max[index] ?? 0,
      min: daily.temperature_2m_min[index] ?? 0,
      weatherCode: daily.weather_code[index] ?? 0,
      windSpeedMax: daily.wind_speed_10m_max[index] ?? 0,
    })).filter((item) => item.date);
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
    return levelWeight[waveAlert.level] >= levelWeight[windAlert.level]
      ? waveAlert
      : windAlert;
  }, [waveAlert, windAlert]);

  const riskScore = useMemo(() => {
    if (!forecast?.current || !waveAlert || !windAlert) return 0;
    return marineRiskScore(
      forecast.current.wind_speed_10m,
      forecast.current.weather_code,
      waveAlert.level,
      windAlert.level
    );
  }, [forecast, waveAlert, windAlert]);

  useEffect(() => {
    if (!topAlert) return;
    if (levelWeight[topAlert.level] >= 1 && topAlert.level !== lastPopupLevel.current) {
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
  }, [forecast, location, waveAlert, windAlert, riskScore]);

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

  const decision = marineDecision(riskScore);
  const sailingStage = getSailingStage(riskScore);
  const decisionTheme = getDecisionTheme(decision);

  return (
    <LinearGradient colors={['#070f1b', '#0d1b2f', '#122842']} style={styles.bg}>
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

          <View style={styles.imageButtons}>
            <Pressable style={styles.imageBtn} onPress={pickHeaderImage}>
              <Text style={styles.imageBtnText}>상단 이미지 변경</Text>
            </Pressable>
            <Pressable style={styles.imageBtnGhost} onPress={() => setHeaderImageUri(null)}>
              <Text style={styles.imageBtnGhostText}>기본 이미지</Text>
            </Pressable>
            <Pressable style={styles.emergencyBtn} onPress={dialCoastGuard}>
              <Text style={styles.emergencyBtnText}>긴급 122</Text>
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <TextInput
              value={inputValue}
              onChangeText={setInputValue}
              placeholder="예: 부산, 울산, 포항"
              placeholderTextColor="#8fa8c1"
              style={styles.input}
              returnKeyType="search"
              onSubmitEditing={onSearch}
            />
            <Pressable style={styles.searchBtn} onPress={onSearch}>
              <Text style={styles.searchBtnText}>검색</Text>
            </Pressable>
          </View>

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
            <Text style={styles.alarmTitle}>해뜨기 30분 전 알림</Text>
            <Text style={styles.alarmText}>{nextAlarmText}</Text>
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
              <View style={[styles.judgementCard, { backgroundColor: decisionTheme.cardBg, borderColor: decisionTheme.cardBorder }]}>
                <Text style={styles.judgementTitle}>출항 판단</Text>
                <Text style={[styles.judgementValue, { color: decisionTheme.valueColor }]}>{decision}</Text>
                <Text style={styles.judgementSub}>해상 위험지수 {riskScore} / 100</Text>
                <View style={styles.stageRow}>
                  <Animated.View style={stageIconMotion}>
                    <Image source={sailingStage.image} style={styles.stageIcon} resizeMode="contain" />
                  </Animated.View>
                  <View style={styles.stageTextWrap}>
                    <Text style={styles.stageTitle}>{sailingStage.title}</Text>
                    <Text style={styles.stageSub}>{sailingStage.subtitle}</Text>
                  </View>
                </View>
              </View>

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
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.hourlyRow}>
                  {hourlyData.map((hour) => (
                    <View key={hour.time} style={styles.hourCard}>
                      <Text style={styles.hourTime}>{formatHour(hour.time, location.timezone)}</Text>
                      <Animated.View style={hourlyIconMotionByWind(hour.windSpeed)}>
                        <Image source={dailyQIconByWind(hour.windSpeed)} style={styles.hourIcon} resizeMode="contain" />
                      </Animated.View>
                      <Text style={styles.hourTemp}>{Math.round(hour.windSpeed)} km/h</Text>
                      <Text style={styles.hourState}>{hourlyWaveLabelByWind(hour.windSpeed)}</Text>
                    </View>
                  ))}
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

              <Text style={styles.sectionTitle}>해상 안전수칙</Text>
              <View style={styles.safetyCard}>
                <Text style={styles.safetyItem}>1. 출항 전 구명조끼, 무전기, 배터리 잔량을 반드시 확인하세요.</Text>
                <Text style={styles.safetyItem}>2. 풍속이 갑자기 오르면 즉시 가까운 안전 해역으로 이동하세요.</Text>
                <Text style={styles.safetyItem}>3. 단독 출항 시 위치 공유를 켜고 비상연락처를 미리 알려두세요.</Text>
                <Text style={styles.safetyItem}>4. 경보(주의/경계) 단계에서는 야간 운항과 무리한 작업을 피하세요.</Text>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
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
  imageButtons: { marginTop: 10, marginBottom: 12, flexDirection: 'row', gap: 8 },
  imageBtn: {
    flex: 1,
    backgroundColor: '#1e496b',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  imageBtnText: { color: '#dff1ff', fontWeight: '700', fontSize: 13 },
  imageBtnGhost: {
    backgroundColor: '#0d253d',
    borderColor: '#3e6f97',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  imageBtnGhostText: { color: '#a7d0ee', fontWeight: '700', fontSize: 13 },
  emergencyBtn: {
    backgroundColor: '#7e2730',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyBtnText: { color: '#ffe6e6', fontWeight: '800', fontSize: 13 },
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
  searchRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: 'rgba(13, 35, 57, 0.85)',
    color: '#e9f6ff',
    borderWidth: 1,
    borderColor: '#376088',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  searchBtn: {
    backgroundColor: '#2a7db2',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  searchBtnText: { color: '#e8f8ff', fontWeight: '800', fontSize: 14 },
  locationBtn: {
    marginTop: 10,
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
  judgementCard: {
    marginTop: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#477198',
    backgroundColor: '#0f2a42',
    padding: 12,
  },
  judgementTitle: { color: '#9ac4e2', fontSize: 12 },
  judgementValue: { color: '#ffffff', fontSize: 30, fontWeight: '900', marginTop: 3 },
  judgementSub: { color: '#bfddf2', fontSize: 12, marginTop: 3 },
  stageRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(5, 18, 30, 0.55)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3a688e',
    padding: 8,
  },
  stageIcon: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  stageTextWrap: {
    flex: 1,
  },
  stageTitle: {
    color: '#e8f7ff',
    fontSize: 13,
    fontWeight: '800',
  },
  stageSub: {
    color: '#b9d8ec',
    fontSize: 11,
    marginTop: 2,
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
  safetyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2f5f85',
    backgroundColor: 'rgba(12, 32, 50, 0.82)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  safetyItem: {
    color: '#d7ecfb',
    fontSize: 13,
    lineHeight: 20,
  },
});
