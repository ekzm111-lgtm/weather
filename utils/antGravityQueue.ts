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

  // 실제 태스크 실행 로직
  private async executeTask(task: TTSTask): Promise<TTSResult> {
    const safeLocation = task.locationName.replace(/[^a-zA-Z0-9가-힣]/g, '');
    const cacheFileName = `briefing_${safeLocation}_${task.voiceGender}.mp3`;
    const cacheFilePath = CACHE_DIR + cacheFileName;

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

    // 2. Google Cloud TTS API 호출 (지수 백오프 적용)
    if (!task.apiKey) {
      console.warn('AntGravity: 구글 API 키가 설정되지 않았습니다. 내장 TTS로 진행합니다.');
      return {
        useNativeFallback: true,
        text: task.text,
      };
    }

    console.log(`AntGravity API Request: ${task.locationName} (${task.voiceGender})`);
    const audioBase64 = await this.synthesizeWithBackoff(task.text, task.voiceGender, task.apiKey);

    // 3. 파일 저장 및 캐싱
    await FileSystem.writeAsStringAsync(cacheFilePath, audioBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return {
      uri: cacheFilePath,
      useNativeFallback: false,
      text: task.text,
    };
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
