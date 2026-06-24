import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { DecisionTheme, SailingStage } from '../types';
import { generateVoiceBriefingText } from '../utils/marineHelper';

type JudgementCardProps = {
  riskScore: number;
  decision: string;
  sailingStage: SailingStage;
  decisionTheme: DecisionTheme;
  locationName: string;
  temperature: number;
  weatherLabelStr: string;
  windSpeed: number;
  waveAlertLevel: string;
  windAlertLevel: string;
};

export const JudgementCard: React.FC<JudgementCardProps> = ({
  riskScore,
  decision,
  sailingStage,
  decisionTheme,
  locationName,
  temperature,
  weatherLabelStr,
  windSpeed,
  waveAlertLevel,
  windAlertLevel,
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const stageFloat = useRef(new Animated.Value(0)).current;

  // 하이브리드 미디어 재생 상태 추적 레퍼런스
  const soundRef = useRef<Audio.Sound | null>(null);
  const isSpeechFallbackActive = useRef(false);

  // 통통 튀는 아이콘 애니메이션
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(stageFloat, {
          toValue: 1,
          duration: 1850,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(stageFloat, {
          toValue: 0,
          duration: 1850,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [stageFloat]);

  // 컴포넌트 언마운트 시 사운드 리소스 및 스피치 클린업
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
      Speech.stop().catch(() => {});
    };
  }, []);

  const stageIconMotion = {
    transform: [
      {
        translateY: stageFloat.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -6],
        }),
      },
    ],
  };

  // 하이브리드 TTS 재생/정지 토글 제어기
  const handleSpeechToggle = async () => {
    if (isSpeaking) {
      // 1. 이미 재생 중인 경우 즉각 중지 및 자원 반환
      setIsSpeaking(false);
      
      if (soundRef.current) {
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        } catch (err) {
          // ignore stop errors
        }
      }

      if (isSpeechFallbackActive.current) {
        try {
          await Speech.stop();
          isSpeechFallbackActive.current = false;
        } catch (err) {
          // ignore speech stop errors
        }
      }
    } else {
      // 2. 신규 재생 요청
      const text = generateVoiceBriefingText(
        locationName,
        temperature,
        weatherLabelStr,
        windSpeed,
        waveAlertLevel,
        windAlertLevel,
        decision
      );

      setIsSpeaking(true);
      isSpeechFallbackActive.current = false;

      try {
        // [시도 1] 고품질 구글번역 TTS (서버) 스트리밍 시도
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ko&client=tw-ob&q=${encodeURIComponent(text)}`;
        
        if (soundRef.current) {
          await soundRef.current.unloadAsync().catch(() => {});
        }

        // 오디오 하드웨어 초기화 (스피커 모드 등 안정성 확보)
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: ttsUrl },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded && status.didJustFinish) {
              sound.unloadAsync().catch(() => {});
              soundRef.current = null;
              setIsSpeaking(false);
            }
          }
        );
        soundRef.current = sound;
      } catch (err) {
        // [시도 2] 오프라인(네트워크 에러) 시 로컬 폰 내장 엔진(expo-speech)으로 즉각 폴백 백업
        isSpeechFallbackActive.current = true;
        try {
          await Speech.speak(text, {
            language: 'ko',
            pitch: 1.0,
            rate: 0.92,
            onDone: () => {
              isSpeechFallbackActive.current = false;
              setIsSpeaking(false);
            },
            onError: () => {
              isSpeechFallbackActive.current = false;
              setIsSpeaking(false);
            },
          });
        } catch (speechErr) {
          setIsSpeaking(false);
          isSpeechFallbackActive.current = false;
        }
      }
    }
  };

  const getGaugeColor = (score: number) => {
    if (score < 25) return '#4ef09f'; // 안전 (그린)
    if (score < 45) return '#ffca62'; // 주의 (노랑)
    if (score < 70) return '#ff8649'; // 자제 (주황)
    return '#ff4b5c'; // 금지 (레드)
  };

  const gaugeColor = getGaugeColor(riskScore);

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: decisionTheme.cardBg,
          borderColor: decisionTheme.cardBorder,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.headerInfo}>
          <Text style={styles.titleLabel}>출항 판단</Text>
          <Text style={[styles.decisionValue, { color: decisionTheme.valueColor }]}>
            {decision}
          </Text>
        </View>
        
        {/* 오른쪽 미디어/스코어 제어 박스 */}
        <View style={styles.rightControls}>
          {/* 하이브리드 음성 제어 토글 버튼 */}
          <Pressable
            style={[styles.speechBtn, isSpeaking && styles.speechBtnActive]}
            onPress={handleSpeechToggle}
          >
            <Text style={[styles.speechBtnText, isSpeaking && styles.speechBtnTextActive]}>
              {isSpeaking ? '⏹️ 정지' : '🎙️ 음성 듣기'}
            </Text>
          </Pressable>

          <View style={styles.scoreBadge}>
            <Text style={styles.scoreLabel}>위험지수</Text>
            <Text style={[styles.scoreValue, { color: gaugeColor }]}>{riskScore}</Text>
          </View>
        </View>
      </View>

      {/* 비주얼 게이지 인디케이터 바 */}
      <View style={styles.gaugeContainer}>
        <View style={styles.gaugeBackground}>
          <View
            style={[
              styles.gaugeFill,
              {
                width: `${riskScore}%`,
                backgroundColor: gaugeColor,
                shadowColor: gaugeColor,
              },
            ]}
          />
        </View>
        <View style={styles.gaugeMarkerRow}>
          <Text style={styles.markerText}>안전</Text>
          <Text style={styles.markerText}>주의</Text>
          <Text style={styles.markerText}>자제</Text>
          <Text style={styles.markerText}>위험</Text>
        </View>
      </View>

      <View style={styles.stageBox}>
        <Animated.View style={[styles.iconWrapper, stageIconMotion]}>
          <Image source={sailingStage.image} style={styles.stageIcon} resizeMode="contain" />
        </Animated.View>
        <View style={styles.stageTextContainer}>
          <Text style={styles.stageTitle}>{sailingStage.title}</Text>
          <Text style={styles.stageSubtitle}>{sailingStage.subtitle}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginTop: 8,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerInfo: {
    flex: 1,
  },
  titleLabel: {
    color: 'rgba(235, 245, 255, 0.7)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  decisionValue: {
    fontSize: 32,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  speechBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speechBtnActive: {
    backgroundColor: '#7e2730',
    borderColor: '#ff5c5c',
    shadowColor: '#ff5c5c',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  speechBtnText: {
    color: '#e0f7fa',
    fontSize: 11,
    fontWeight: '800',
  },
  speechBtnTextActive: {
    color: '#ffe6e6',
  },
  scoreBadge: {
    backgroundColor: 'rgba(5, 18, 30, 0.45)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  scoreLabel: {
    color: '#90a4ae',
    fontSize: 8,
    fontWeight: '800',
  },
  scoreValue: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 1,
  },
  gaugeContainer: {
    marginTop: 18,
    marginBottom: 8,
  },
  gaugeBackground: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  gaugeMarkerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  markerText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 10,
    fontWeight: '700',
  },
  stageBox: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(5, 18, 30, 0.5)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(58, 104, 142, 0.3)',
    padding: 10,
  },
  iconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageIcon: {
    width: 52,
    height: 52,
    borderRadius: 8,
  },
  stageTextContainer: {
    flex: 1,
  },
  stageTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  stageSubtitle: {
    color: '#b0bec5',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
});
