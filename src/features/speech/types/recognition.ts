export interface RecognitionState {
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  interimTranscript: string;
  finalTranscript: string;
}

export interface MicrophoneState {
  deviceName: string;
  audioLevel: number;
  isActive: boolean;
  isSupported: boolean;
  error: string | null;
}

export interface IRecognitionService {
  start: () => void;
  stop: () => void;
  setLanguage: (language: string) => void;
  isSupported: () => boolean;
  onResult: (callback: (transcript: string, isFinal: boolean) => void) => void;
  onError: (callback: (error: string) => void) => void;
  onEnd: (callback: () => void) => void;
}

export interface LanguageOption {
  code: string;
  label: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'sr-RS', label: 'Serbian (Latin)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'fr-FR', label: 'French' },
  { code: 'de-DE', label: 'German' },
  { code: 'it-IT', label: 'Italian' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)' },
  { code: 'ru-RU', label: 'Russian' },
  { code: 'ja-JP', label: 'Japanese' },
  { code: 'zh-CN', label: 'Chinese (Mandarin)' },
  { code: 'ko-KR', label: 'Korean' },
  { code: 'ar-SA', label: 'Arabic' },
  { code: 'hi-IN', label: 'Hindi' },
];
