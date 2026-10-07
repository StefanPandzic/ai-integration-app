import { useCallback } from 'react';
import { ProcessingStep } from '../features/ai/types/processing';
import { AppDispatch } from '../store';
import {
  appendThinking,
  setIsThinking,
  setCurrentThinking,
  updateProcessingStep,
  setProcessingSteps,
} from '../store/slices/appSlice';

interface UseProgressTrackerProps {
  dispatch: AppDispatch;
}

/**
 * Manages progress tracking for multi-step AI pipeline
 * Handles special case of thinking accumulation for reasoning models
 */
export const useProgressTracker = ({ dispatch }: UseProgressTrackerProps) => {
  /**
   * Real-time progress tracking for multi-step AI pipeline
   * Special handling for thinking steps (DeepSeek-R1, Gemma 4)
   * Updates UI progress indicators and thinking panel
   */
  const handleProgress = useCallback(
    (step: ProcessingStep) => {
      // Thinking steps require accumulation (streaming chunks from backend)
      if (step.id === 'ai-thinking') {
        if (step.status === 'active' && step.details) {
          dispatch(setIsThinking(true));
          dispatch(appendThinking(step.details)); // Use new appendThinking action
        } else if (step.status === 'complete') {
          dispatch(setIsThinking(false));
        }
      }

      // Update or append step to processing queue
      dispatch(updateProcessingStep(step));
    },
    [dispatch],
  );

  // Reset progress trackers for new pipeline execution
  const resetProgress = useCallback(() => {
    dispatch(setProcessingSteps([]));
    dispatch(setCurrentThinking(null));
    dispatch(setIsThinking(false));
  }, [dispatch]);

  return {
    handleProgress,
    resetProgress,
  };
};
