import { IRecognitionService } from '../types/recognition';
import { createLogger } from '../../logging';

const logger = createLogger('speech');

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onstart: () => void;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item: (index: number) => SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

const getErrorMessage = (error: string): string => {
  switch (error) {
    case 'no-speech':
      return 'No speech detected. Please try again.';
    case 'audio-capture':
      return 'No microphone found. Please check your settings.';
    case 'not-allowed':
      return 'Microphone permission denied.';
    case 'network':
      return 'Network error occurred.';
    default:
      return `Error occurred: ${error}`;
  }
};

/**
 * Factory function that creates a Web Speech Recognition service instance
 * Wraps the browser's Web Speech API with a clean, callback-based interface
 *
 * @returns IRecognitionService object with methods to control speech recognition
 */
export const WebSpeechRecognitionService = (): IRecognitionService => {
  let recognition: SpeechRecognition | null = null;
  let resultCallback: ((transcript: string, isFinal: boolean) => void) | null =
    null;
  let errorCallback: ((error: string) => void) | null = null;
  let endCallback: (() => void) | null = null;
  let isRunning = false;

  const isSupported = (): boolean => {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  };

  if (isSupported()) {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognitionAPI();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript && resultCallback) {
        resultCallback(finalTranscript.trim(), true);
      } else if (interimTranscript && resultCallback) {
        resultCallback(interimTranscript, false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      isRunning = false;
      if (errorCallback) {
        errorCallback(getErrorMessage(event.error));
      }
    };

    recognition.onend = () => {
      isRunning = false;
      if (endCallback) {
        endCallback();
      }
    };
  }

  const start = (): void => {
    if (recognition && !isRunning) {
      try {
        recognition.start();
        isRunning = true;
      } catch (error) {
        logger.error('Speech recognition start error:', error);
        isRunning = false;
        if (errorCallback) {
          errorCallback('Failed to start recognition. Please try again.');
        }
      }
    }
  };

  const stop = (): void => {
    if (recognition && isRunning) {
      try {
        recognition.stop();
      } catch (error) {
        logger.error('Speech recognition stop error:', error);
        isRunning = false;
      }
    }
  };

  const setLanguage = (language: string): void => {
    if (recognition) {
      recognition.lang = language;
    }
  };

  const onResult = (
    callback: (transcript: string, isFinal: boolean) => void,
  ): void => {
    resultCallback = callback;
  };

  const onError = (callback: (error: string) => void): void => {
    errorCallback = callback;
  };

  const onEnd = (callback: () => void): void => {
    endCallback = callback;
  };

  return {
    start,
    stop,
    setLanguage,
    isSupported,
    onResult,
    onError,
    onEnd,
  };
};
