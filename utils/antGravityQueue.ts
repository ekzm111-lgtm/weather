import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';

// 캐시 디렉토리 설정
const CACHE_DIR = FileSystem.documentDirectory + 'antgravity_tts_cache/';
const CACHE_TTL_MS = 45 * 60 * 1000; // 45분 (밀리초)

export interface TTSResult {
  uri?: string;
  useNativeFallback: boolean;
  text: string;
}

export interface TTSTask {
  id: string;
  text: string;
  voiceGender: 'male' | 'female';
  locationName: string;
  apiKey: string;
  resolve: (result: TTSResult) => void;
  reject: (error: any) => void;
}

const DAILY_CHAR_KEY = 'antgravity_tts_daily_char';
const MONTHLY_CHAR_KEY = 'antgravity_tts_monthly_char';
const LAST_DATE_KEY = 'antgravity_tts_last_date';
const LAST_MONTH_KEY = 'antgravity_tts_last_month';

const DAILY_CHAR_LIMIT = 30000; // 하루 최대 30,000자
const MONTHLY_CHAR_LIMIT = 900000; // 한 달 최대 900,000자

class AntGravityQueue {
  private queue: TTSTask[] = [];
  private activeConnections = 0;
  private maxConcurrency = 1; // 429 에러 방지를 위해 동시 실행 1개로 제한

  constructor() {
    this.ensureCacheDirectory();
  }

  // 캐시 디렉토리 생성 보장
  private async ensureCacheDirectory() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      }
    } catch (e) {
      console.warn('AntGravity: 캐시 디렉토리 생성 실패', e);
    }
  }

  // 큐에 태스크 추가
  public enqueue(task: TTSTask) {
    this.queue.push(task);
    this.processNext();
  }

  // 다음 태스크 처리
  private async processNext() {
    if (this.queue.length === 0 || this.activeConnections >= this.maxConcurrency) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.activeConnections++;
    try {
      const result = await this.executeTask(task);
      task.resolve(result);
    } catch (error) {
      console.error(`AntGravity Task [${task.id}] 실패:`, error);
      // 최종 실패 시 기기 내장 TTS 폴백으로 안내
      task.resolve({
        useNativeFallback: true,
        text: task.text,
      });
    } finally {
      this.activeConnections--;
      // 약간의 지연(500ms)을 두어 API 레이트 리밋 분산
      setTimeout(() => this.processNext(), 500);
    }
  }

  // 글자 수 기반 일일 및 월간 제한 검사 및 누적치 증가
  private async checkAndIncrementCharLimit(charLength: number): Promise<boolean> {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const thisMonth = today.substring(0, 7); // YYYY-MM

      const lastDate = await AsyncStorage.getItem(LAST_DATE_KEY);
      const lastMonth = await AsyncStorage.getItem(LAST_MONTH_KEY);

      let dailyCount = 0;
      let monthlyCount = 0;

      // 1. 월간 리셋 및 불러오기
      if (lastMonth === thisMonth) {
        const storedMonthly = await AsyncStorage.getItem(MONTHLY_CHAR_KEY);
        monthlyCount = storedMonthly ? parseInt(storedMonthly, 10) : 0;
      } else {
        await AsyncStorage.setItem(LAST_MONTH_KEY, thisMonth);
        await AsyncStorage.setItem(MONTHLY_CHAR_KEY, '0');
        monthlyCount = 0;
      }

      // 2. 일간 리셋 및 불러오기
      if (lastDate === today) {
        const storedDaily = await AsyncStorage.getItem(DAILY_CHAR_KEY);
        dailyCount = storedDaily ? parseInt(storedDaily, 10) : 0;
      } else {
        await AsyncStorage.setItem(LAST_DATE_KEY, today);
        await AsyncStorage.setItem(DAILY_CHAR_KEY, '0');
        dailyCount = 0;
      }

      // 3. 한도 초과 감사
      if (dailyCount + charLength > DAILY_CHAR_LIMIT) {
        console.warn(
          `AntGravity: 일일 안전 글자수 한도(${DAILY_CHAR_LIMIT}자)를 초과합니다. (요청: ${charLength}자, 오늘 누적: ${dailyCount}자)`
        );
        return false;
      }

      if (monthlyCount + charLength > MONTHLY_CHAR_LIMIT) {
        console.warn(
          `AntGravity: 월간 안전 글자수 한도(${MONTHLY_CHAR_LIMIT}자)를 초과합니다. (요청: ${charLength}자, 이번 달 누적: ${monthlyCount}자)`
        );
        return false;
      }

      // 4. 누적치 합산 저장
      await AsyncStorage.setItem(DAILY_CHAR_KEY, (dailyCount + charLength).toString());
      await AsyncStorage.setItem(MONTHLY_CHAR_KEY, (monthlyCount + charLength).toString());

      console.log(
        `AntGravity: 글자 수 한도 통과. [오늘 누적: ${dailyCount + charLength}/${DAILY_CHAR_LIMIT}자] [이번달 누적: ${monthlyCount + charLength}/${MONTHLY_CHAR_LIMIT}자]`
      );
      return true;
    } catch (e) {
      console.error('AntGravity: 글자 수 한도 체크 오류', e);
      return true; // 예외 상황에서는 서비스 정상 동작 보장을 위해 기본 허용
    }
  }

  // API 호출 실패 시 글자 수 차감 롤백
  private async decrementCharLimit(charLength: number) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const thisMonth = today.substring(0, 7);

      const lastDate = await AsyncStorage.getItem(LAST_DATE_KEY);
      const lastMonth = await AsyncStorage.getItem(LAST_MONTH_KEY);

      if (lastDate === today) {
        const storedDaily = await AsyncStorage.getItem(DAILY_CHAR_KEY);
        const dailyCount = storedDaily ? parseInt(storedDaily, 10) : 0;
        await AsyncStorage.setItem(DAILY_CHAR_KEY, Math.max(0, dailyCount - charLength).toString());
      }

      if (lastMonth === thisMonth) {
        const storedMonthly = await AsyncStorage.getItem(MONTHLY_CHAR_KEY);
        const monthlyCount = storedMonthly ? parseInt(storedMonthly, 10) : 0;
        await AsyncStorage.setItem(MONTHLY_CHAR_KEY, Math.max(0, monthlyCount - charLength).toString());
      }
    } catch (e) {
      console.error('AntGravity: 글자 수 롤백 실패', e);
    }
  }

  // 실제 태스크 실행 로직
  private async executeTask(task: TTSTask): Promise<TTSResult> {
    const safeLocation = task.locationName.replace(/[^a-zA-Z0-9가-힣]/g, '');
    const cacheFileName = `briefing_${safeLocation}_${task.voiceGender}.mp3`;
    const cacheFilePath = CACHE_DIR + cacheFileName;
    const textLength = task.text.length;

    // 1. 로컬 캐시 확인
    const isCached = await this.checkCacheValidity(cacheFilePath);
    if (isCached) {
      console.log(`AntGravity Cache Hit: ${cacheFileName}`);
      return {
        uri: cacheFilePath,
        useNativeFallback: false,
        text: task.text,
      };
    }

    // 2. Google Cloud TTS API 호출 전, 글자 수 기반 일일/월간 한도 체크
    const withinLimit = await this.checkAndIncrementCharLimit(textLength);
    if (!withinLimit) {
      console.warn('AntGravity: 안전 글자수 한도를 초과하여 구글 API 호출을 차단하고 기기 내장 TTS로 폴백합니다.');
      return {
        useNativeFallback: true,
        text: task.text,
      };
    }

    // 3. Google Cloud TTS API 호출 (지수 백오프 적용)
    if (!task.apiKey) {
      console.warn('AntGravity: 구글 API 키가 설정되지 않았습니다. 내장 TTS로 진행합니다.');
      await this.decrementCharLimit(textLength);
      return {
        useNativeFallback: true,
        text: task.text,
      };
    }

    console.log(`AntGravity API Request: ${task.locationName} (${task.voiceGender}) [${textLength}자]`);
    try {
      const audioBase64 = await this.synthesizeWithBackoff(task.text, task.voiceGender, task.apiKey);

      // 4. 파일 저장 및 캐싱
      await FileSystem.writeAsStringAsync(cacheFilePath, audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return {
        uri: cacheFilePath,
        useNativeFallback: false,
        text: task.text,
      };
    } catch (apiError) {
      console.error('AntGravity API 호출 에러, 내장 TTS로 폴백합니다:', apiError);
      await this.decrementCharLimit(textLength);
      return {
        useNativeFallback: true,
        text: task.text,
      };
    }
  }

  // 캐시 유효성 검사 (TTL 45분)
  private async checkCacheValidity(filePath: string): Promise<boolean> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) return false;

      // expo-file-system에서 modificationTime을 가져와서 TTL 비교
      const modificationTime = fileInfo.modificationTime;
      if (modificationTime) {
        const fileAge = Date.now() - modificationTime * 1000;
        if (fileAge < CACHE_TTL_MS) {
          return true; // 캐시 유효
        }
      }
      // 유효하지 않은 캐시 파일 삭제
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      return false;
    } catch {
      return false;
    }
  }

  // 지수 백오프 적용된 API 호출
  private async synthesizeWithBackoff(
    text: string,
    gender: 'male' | 'female',
    apiKey: string,
    retries = 3,
    delay = 1000
  ): Promise<string> {
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
    
    // 아나운서 스타일 한국어 Neural2 모델 설정
    const voiceName = gender === 'female' ? 'ko-KR-Neural2-A' : 'ko-KR-Neural2-C';

    const body = {
      input: { text },
      voice: {
        languageCode: 'ko-KR',
        name: voiceName,
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 0.95, // 자연스러운 아나운서 발화 속도
        pitch: 0.0,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429) {
        if (retries > 0) {
          console.warn(`AntGravity: 429 Too Many Requests. 백오프 대기: ${delay}ms`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.synthesizeWithBackoff(text, gender, apiKey, retries - 1, delay * 2);
        } else {
          throw new Error('Google TTS API 429 레이트 리밋 도달. 재시도 초과.');
        }
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google TTS API 에러: ${response.status} - ${errText}`);
      }

      const resData = await response.json();
      if (!resData.audioContent) {
        throw new Error('Google TTS 응답에 audioContent가 없습니다.');
      }

      return resData.audioContent;
    } catch (error) {
      if (retries > 0) {
        console.warn(`AntGravity: API 에러 발생. 재시도 대기: ${delay}ms`, error);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.synthesizeWithBackoff(text, gender, apiKey, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  // 캐시 폴더 내의 모든 캐시 파일 삭제
  public async clearCache() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
        await this.ensureCacheDirectory();
      }
    } catch (e) {
      console.error('AntGravity: 캐시 클리어 실패', e);
    }
  }
}

export const antGravityQueue = new AntGravityQueue();
