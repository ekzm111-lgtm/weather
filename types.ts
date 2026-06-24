export type GeocodeResult = {
  latitude: number;
  longitude: number;
  name: string;
  country?: string;
  admin1?: string;
  timezone?: string;
};

export type ForecastResponse = {
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

export type HourlyItem = {
  time: string;
  temperature: number;
  weatherCode: number;
  windSpeed: number;
};

export type DailyItem = {
  date: string;
  max: number;
  min: number;
  weatherCode: number;
  windSpeedMax: number;
};

export type AlertLevel = '안전' | '주의' | '경계';

export type AlertInfo = {
  level: AlertLevel;
  title: string;
  message: string;
  bgColor: string;
  borderColor: string;
};

export type StoredContext = {
  latitude: number;
  longitude: number;
  name: string;
};

export type SailingStage = {
  code: 'b-01' | 'b-02' | 'b-03' | 'b-04';
  title: string;
  subtitle: string;
  image: any; // ImageSourcePropType 대체
};

export type DecisionTheme = {
  cardBg: string;
  cardBorder: string;
  valueColor: string;
};

export type TideItem = {
  time: string;
  type: '만조' | '간조';
  level: string; // 예: +240cm, -50cm
};

export type TideForecast = {
  tides: TideItem[];
  seaTemp: number;
};

