import { useState, useEffect, useRef, useCallback } from 'react';
import { RecognitionState, IRecognitionService } from '../types/recognition';
import { WebSpeechRecognitionService } from '../services/recognitionService';

/**
 * Custom hook for managing speech recognition functionality
 * Handles Web Speech API integration and voice input state
 * Transcription storage now handled by Redux store
 *
 * @param language - BCP 47 language code (e.g., 'en-US', 'es-ES')
 * @returns Speech recognition state and control methods
 */
export const useSpeechRecognition = (language: string = 'en-US') => {
  // Core recognition state (listening status, transcripts, errors)
  const [state, setState] = useState<RecognitionState>({
    isListening: false,
    isSupported: false,
    error: null,
    interimTranscript: '',
    finalTranscript: '',
  });

  // Service instance stored in ref to survive re-renders
  const recognitionServiceRef = useRef<IRecognitionService | null>(null);

  // Initialize speech recognition service on mount
  useEffect(() => {
    const service = WebSpeechRecognitionService();
    recognitionServiceRef.current = service;

    setState((prev) => ({
      ...prev,
      isSupported: service.isSupported(),
    }));

    if (service.isSupported()) {
      service.onResult((transcript, isFinal) => {
        if (isFinal) {
          setState((prev) => ({
            ...prev,
            finalTranscript: prev.finalTranscript + transcript + ' ',
            interimTranscript: '',
          }));
        } else {
          setState((prev) => ({
            ...prev,
            interimTranscript: transcript,
          }));
        }
      });

      service.onError((error) => {
        setState((prev) => ({
          ...prev,
          error,
          isListening: false,
        }));
      });

      service.onEnd(() => {
        setState((prev) => ({
          ...prev,
          isListening: false,
        }));
      });
    }
  }, []);

  // Update recognition language when language prop changes
  useEffect(() => {
    if (recognitionServiceRef.current) {
      recognitionServiceRef.current.setLanguage(language);
    }
  }, [language]);

  /**
   * Start speech recognition session
   */
  const startListening = useCallback(() => {
    if (!recognitionServiceRef.current) return;

    setState((prev) => ({
      ...prev,
      isListening: true,
      error: null,
      finalTranscript: '',
      interimTranscript: '',
    }));

    recognitionServiceRef.current.start();
  }, []);

  /**
   * Stop speech recognition session
   */
  const stopListening = useCallback(() => {
    if (!recognitionServiceRef.current) return;
    recognitionServiceRef.current.stop();
  }, []);

  /**
   * Update the current transcript text programmatically
   *
   * @param text - New transcript text to set
   */
  const updateCurrentTranscript = useCallback((text: string) => {
    setState((prev) => ({
      ...prev,
      finalTranscript: text,
    }));
  }, []);

  /**
   * Clear the current working transcript (editor content)
   */
  const clearCurrentTranscript = useCallback(() => {
    setState((prev) => ({
      ...prev,
      finalTranscript: '',
      interimTranscript: '',
    }));
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    updateCurrentTranscript,
    clearCurrentTranscript,
  };
};
