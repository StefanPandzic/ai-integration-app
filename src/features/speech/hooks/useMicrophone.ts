import { useState, useEffect, useRef, useCallback } from 'react';
import { MicrophoneState } from '../types/recognition';
import { createLogger } from '../../logging';

const logger = createLogger('speech');

/**
 * Custom hook for real-time microphone monitoring and audio level detection
 * Uses Web Audio API to analyze audio input and provide visual feedback
 *
 * @param isListening - Whether speech recognition is active (controls monitoring lifecycle)
 * @returns Microphone state including device name, audio level, and status
 */
export const useMicrophone = (isListening: boolean) => {
  const [state, setState] = useState<MicrophoneState>({
    deviceName: 'Default Microphone',
    audioLevel: 0,
    isActive: false,
    isSupported: false,
    error: null,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const checkSupport = useCallback(() => {
    const supported = !!(
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    );
    setState((prev) => ({ ...prev, isSupported: supported }));
    return supported;
  }, []);

  const getMicrophoneDevice = async (): Promise<string> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(
        (device) => device.kind === 'audioinput',
      );

      if (audioInputs.length > 0) {
        const defaultMic = audioInputs.find(
          (device) => device.deviceId === 'default',
        );
        const activeMic = defaultMic || audioInputs[0];
        return activeMic.label || 'Microphone';
      }

      return 'No microphone detected';
    } catch (error) {
      logger.error('Error getting microphone device:', error);
      return 'Unknown microphone';
    }
  };

  const startMonitoring = useCallback(async () => {
    if (!state.isSupported) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneStreamRef.current = stream;

      const deviceName = await getMicrophoneDevice();

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      setState((prev) => ({
        ...prev,
        deviceName,
        isActive: true,
        error: null,
      }));

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        const average =
          dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;

        const normalizedLevel = Math.min(average / 128, 1);

        setState((prev) => ({
          ...prev,
          audioLevel: normalizedLevel,
        }));

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: 'Failed to access microphone',
        isActive: false,
      }));
    }
  }, [state.isSupported]);

  const stopMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach((track) => track.stop());
      microphoneStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;

    setState((prev) => ({
      ...prev,
      audioLevel: 0,
      isActive: false,
    }));
  }, []);

  useEffect(() => {
    checkSupport();
  }, [checkSupport]);

  useEffect(() => {
    if (isListening) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [isListening, startMonitoring, stopMonitoring]);

  return state;
};
