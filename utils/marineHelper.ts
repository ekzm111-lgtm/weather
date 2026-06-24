import { AlertInfo, AlertLevel, DecisionTheme, SailingStage, TideForecast, TideItem } from '../types';

const wave02 = require('../wave-02.png');
const wave03 = require('../wave-03.png');
const wave04 = require('../wave-04.png');
const wave05 = require('../wave-05.png');

const q01 = require('../icon/q-01.png');
const q02 = require('../icon/q-02.png');
const q03 = require('../icon/q-03.png');
const q04 = require('../icon/q-04.png');
const q05 = require('../icon/q-05.png');
const q06 = require('../icon/q-06.png');
const q07 = require('../icon/q-07.png');
const q08 = require('../icon/q-08.png');

const b01 = require('../icon/b-01.png');
const b02 = require('../icon/b-02.png');
const b03 = require('../icon/b-03.png');
const b04 = require('../icon/b-04.png');

export const weatherLabelByCode: Record<number, string> = {
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

export const levelWeight: Record<AlertLevel, number> = {
  안전: 0,
  주의: 1,
  경계: 2,
};

export function weatherLabel(code: number): string {
  return weatherLabelByCode[code] ?? '알 수 없음';
}

export function isClearCode(code: number): boolean {
  return code === 0 || code === 1;
}

export function isRainOrStormCode(code: number): boolean {
  return (code >= 51 && code <= 67) || [80, 81, 82, 95, 96, 99].includes(code);
}

export function weatherIconCode(code: number): string {
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

export function weatherIconUrl(code: number, size: 'small' | 'large' = 'small'): string {
  const icon = weatherIconCode(code);
  const scale = size === 'large' ? '@4x' : '@2x';
  return `https://openweathermap.org/img/wn/${icon}${scale}.png`;
}

export function weatherIconSource(code: number, size: 'small' | 'large' = 'small'): any {
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

export function formatHour(iso: string, timezone = 'UTC'): string {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, timezone = 'UTC'): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(new Date(iso));
}

export function formatDay(iso: string, timezone = 'UTC'): string {
  return new Intl.DateTimeFormat('ko-KR', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  }).format(new Date(iso));
}

export function getWaveAlert(windSpeedKmh: number, weatherCode: number): AlertInfo {
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

export function getWindAlert(windSpeedKmh: number): AlertInfo {
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

export function marineRiskScore(
  windSpeed: number,
  weatherCode: number,
  waveLevel: AlertLevel,
  windLevel: AlertLevel
): number {
  let score = 15;
  score += Math.min(55, Math.round(windSpeed * 1.2));
  if ([80, 81, 82].includes(weatherCode)) score += 12;
  if (weatherCode >= 95) score += 18;
  score += levelWeight[waveLevel] * 8;
  score += levelWeight[windLevel] * 8;
  return Math.max(0, Math.min(100, score));
}

export function marineDecision(score: number): string {
  if (score >= 75) return '출항 금지';
  if (score >= 45) return '출항 주의';
  return '출항 가능';
}

export function hourlyWaveLabelByWind(windSpeedKmh: number): string {
  if (windSpeedKmh >= 50) return '매우 거침';
  if (windSpeedKmh >= 35) return '거침';
  if (windSpeedKmh >= 20) return '약간 거침';
  return '비교적 잔잔';
}

export function getSailingStage(score: number): SailingStage {
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

export function getDecisionTheme(decision: string): DecisionTheme {
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

export function waveImageByWind(windSpeedKmh: number): any {
  if (windSpeedKmh < 20) return wave02;
  if (windSpeedKmh < 35) return wave03;
  if (windSpeedKmh < 50) return wave04;
  return wave05;
}

export function dailyQIconByWind(windSpeedKmh: number): any {
  if (windSpeedKmh < 5) return q01;
  if (windSpeedKmh < 10) return q02;
  if (windSpeedKmh < 15) return q03;
  if (windSpeedKmh < 20) return q04;
  if (windSpeedKmh < 25) return q05;
  if (windSpeedKmh < 30) return q06;
  if (windSpeedKmh < 35) return q07;
  return q08;
}

export function resolveAlarmDate(sunrises: string[], now: Date): Date {
  let candidate = new Date(new Date(sunrises[0]).getTime() - 30 * 60 * 1000);
  if (candidate <= now && sunrises.length > 1) {
    candidate = new Date(new Date(sunrises[1]).getTime() - 30 * 60 * 1000);
  }
  if (candidate <= now) {
    candidate = new Date(now.getTime() + 15 * 60 * 1000);
  }
  return candidate;
}

/**
 * 위도/경도 기반 해수온(Sea Temperature) 시뮬레이션
 */
export function simulateSeaTemperature(latitude: number): number {
  const month = new Date().getMonth() + 1;
  // 한국 평균 기점(위도 35도) 기준 수온 설정
  const baseTemp = 17.5 - (latitude - 35) * 1.6;
  // 계절 변화 사인 곡선 (8월 최대, 2월 최소)
  const tempSin = Math.sin(((month - 5) / 12) * 2 * Math.PI);
  const seaTemp = baseTemp + tempSin * 7.5;
  return Math.round(Math.max(3.0, Math.min(30.0, seaTemp)) * 10) / 10;
}

/**
 * 위도/경도 및 날짜 기반 만조/간조 타임라인 시뮬레이션
 */
export function getTideForecast(latitude: number, longitude: number): TideForecast {
  const now = new Date();
  const seaTemp = simulateSeaTemperature(latitude);

  // 위도/경도를 시드로 삼아 조석 시간대 오프셋을 줍니다. (단위: ms)
  const seedOffset = Math.abs(Math.sin(latitude) * Math.cos(longitude)) * 4 * 60 * 60 * 1000;
  
  // 첫 번째 간조 기준선 생성 (새벽 시각)
  const baseTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 2, 12, 0).getTime() + (seedOffset % (6 * 60 * 60 * 1000));
  
  const tides: TideItem[] = [];
  const cycle = 6 * 60 * 60 * 1000 + 12 * 60 * 1000; // 약 6시간 12분 간격

  // 하루 동안의 4대 물때 주기 생성
  for (let i = 0; i < 4; i++) {
    const itemTime = new Date(baseTime + i * cycle);
    const isHigh = i % 2 === 1; // 간조(0) -> 만조(1) -> 간조(2) -> 만조(3)
    
    // 물높이 (위도 경도에 따라 밀물/썰물 높이차 시뮬레이션)
    const baseLevel = isHigh ? 280 + Math.round(Math.sin(longitude) * 100) : 40 - Math.round(Math.cos(latitude) * 30);
    const levelStr = isHigh ? `+${baseLevel}cm` : `${baseLevel}cm`;

    tides.push({
      time: itemTime.toISOString(),
      type: isHigh ? '만조' : '간조',
      level: levelStr,
    });
  }

  return { tides, seaTemp };
}

/**
 * 기상 상황 및 바람에 맞춰 다이내믹 배경 그라데이션 컬러 반환
 */
export function getDynamicTheme(weatherCode: number, windSpeedKmh: number): [string, string, string] {
  // 1. 태풍/강풍 또는 뇌우 경보 (위험 수준)
  if (weatherCode >= 95 || windSpeedKmh >= 45) {
    return ['#20032e', '#360940', '#1a031e']; // 다크 퍼플/와인 (경계 상태)
  }
  // 2. 비/소나기 또는 강한 바람 (불안정 상태)
  if (isRainOrStormCode(weatherCode) || windSpeedKmh >= 28) {
    return ['#0f172a', '#1e293b', '#2d3748']; // 어두운 폭풍우빛 회청색
  }
  // 3. 흐림 / 안개 (가시거리 불량)
  if ([3, 45, 48].includes(weatherCode)) {
    return ['#14213d', '#283655', '#4d648d']; // 차분하고 어두운 네이비 그레이
  }
  // 4. 평온하고 맑음 (안전 상태)
  return ['#070f1b', '#0b1d33', '#112b4c']; // 깊고 시원한 바다 딥 블루
}

/**
 * 실시간 기상 데이터를 활용한 한국어 음성 브리핑 텍스트 자동 생성기
 */
export function generateVoiceBriefingText(
  locationName: string,
  temperature: number,
  weatherLabelStr: string,
  windSpeed: number,
  waveAlertLevel: string,
  windAlertLevel: string,
  decision: string
): string {
  const roundedTemp = Math.round(temperature);
  const roundedWind = Math.round(windSpeed);
  
  return `오늘 ${locationName}의 해상 안전 브리핑을 안내해 드립니다. 현재 기온은 ${roundedTemp}도 이며, 기상 상태는 ${weatherLabelStr}입니다. 풍속은 시속 ${roundedWind} 킬로미터이며, 파도 주의보는 ${waveAlertLevel}, 바람 주의보는 ${windAlertLevel} 단계입니다. 종합 분석 결과 오늘 해상 판단은 ${decision}입니다. 출항 전 안전 수칙을 준수하여 조업해 주세요.`;
}

