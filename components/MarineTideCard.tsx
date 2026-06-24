import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TideForecast } from '../types';

type MarineTideCardProps = {
  tideData: TideForecast | null;
  timezone?: string;
};

export const MarineTideCard: React.FC<MarineTideCardProps> = ({ tideData, timezone = 'Asia/Seoul' }) => {
  if (!tideData) return null;

  const { tides, seaTemp } = tideData;

  const formatTideTime = (isoString: string) => {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(new Date(isoString));
  };

  // 수온에 따른 텍스트 컬러 지정 (겨울철 저수온 위험 경고 등)
  const getTempColor = (temp: number) => {
    if (temp <= 10) return '#51a2ff'; // 저수온 (블루)
    if (temp >= 24) return '#ff5a5a'; // 고수온 (레드)
    return '#8df0bc'; // 적정 (그린)
  };

  return (
    <View style={styles.cardContainer}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.cardTitle}>물때 및 해수온 정보</Text>
          <Text style={styles.cardSub}>위도/경도 기반 예측 데이터</Text>
        </View>
        <View style={styles.tempBadge}>
          <Text style={styles.tempLabel}>현재 수온</Text>
          <Text style={[styles.tempValue, { color: getTempColor(seaTemp) }]}>
            {seaTemp}°C
          </Text>
        </View>
      </View>

      {/* 조석(물때) 타임라인 */}
      <View style={styles.tideTimeline}>
        {tides.map((tide, index) => {
          const isHigh = tide.type === '만조';
          return (
            <View key={index} style={styles.tideItem}>
              <View style={[styles.indicatorBall, { backgroundColor: isHigh ? '#2a82e6' : '#ff9800' }]}>
                <Text style={styles.indicatorText}>{isHigh ? '밀' : '썰'}</Text>
              </View>
              <Text style={styles.tideType}>{tide.type}</Text>
              <Text style={styles.tideTime}>{formatTideTime(tide.time)}</Text>
              <Text style={[styles.tideLevel, { color: isHigh ? '#a4ceff' : '#ffd384' }]}>
                {tide.level}
              </Text>
            </View>
          );
        })}
      </View>

      {/* 바다 상식 팁 */}
      <View style={styles.marineTip}>
        <Text style={styles.tipTitle}>💡 해양 지식</Text>
        <Text style={styles.tipText}>
          만조(밀물) 전후 2시간은 조류 소통이 가장 원활하여 어활동에 적합하나, 간출암 주변 항해 시에는 썰물 시간대의 저수위를 주의해야 합니다.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginTop: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#325c85',
    backgroundColor: 'rgba(13, 33, 52, 0.75)',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58, 103, 144, 0.25)',
    paddingBottom: 12,
    marginBottom: 14,
  },
  cardTitle: {
    color: '#e7f5ff',
    fontSize: 16,
    fontWeight: '800',
  },
  cardSub: {
    color: '#90a4ae',
    fontSize: 11,
    marginTop: 2,
  },
  tempBadge: {
    backgroundColor: 'rgba(5, 18, 30, 0.45)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  tempLabel: {
    color: '#90a4ae',
    fontSize: 9,
    fontWeight: '700',
  },
  tempValue: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 1,
  },
  tideTimeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(5, 18, 30, 0.3)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(58, 103, 144, 0.15)',
  },
  tideItem: {
    flex: 1,
    alignItems: 'center',
  },
  indicatorBall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  indicatorText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  tideType: {
    color: '#d2e9f9',
    fontSize: 12,
    fontWeight: '700',
  },
  tideTime: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  tideLevel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  marineTip: {
    marginTop: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.02)',
  },
  tipTitle: {
    color: '#ffe596',
    fontSize: 11,
    fontWeight: '800',
  },
  tipText: {
    color: '#b0bec5',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
  },
});
