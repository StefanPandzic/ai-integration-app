import { useEffect, useRef } from 'react';
import { BackendService } from '../features/ai';
import { createLogger } from '../features/logging';
import { AppDispatch } from '../store';
import { setSelectedModel, setAvailableModels } from '../store/slices/appSlice';

const logger = createLogger('app');

interface UseModelManagerProps {
  selectedModel: string;
  dispatch: AppDispatch;
}

/**
 * Manages AI model configuration, persistence, and backend synchronization
 * Handles model loading on mount and model switching with rollback on failure
 */
export const useModelManager = ({
  selectedModel,
  dispatch,
}: UseModelManagerProps) => {
  const backendServiceRef = useRef(BackendService());

  // Load available AI models on mount
  // Note: Model preference is restored automatically by Redux Persist
  useEffect(() => {
    const loadModels = async () => {
      try {
        logger.info('🔍 Fetching available models');
        const models = await backendServiceRef.current.getAvailableModels();
        dispatch(setAvailableModels(models));
        logger.info(`✅ Received ${models.length} models`);
      } catch (error) {
        logger.error('❌ Failed to load models:', error);
      }
    };

    loadModels();
  }, [dispatch]);

  // Switch AI model with backend sync and rollback on failure
  // Note: Redux Persist automatically saves selectedModel to localStorage
  const handleModelChange = async (modelName: string) => {
    const previousModel = selectedModel;
    try {
      logger.info(`🔄 Changing model to: ${modelName}`);
      dispatch(setSelectedModel(modelName));

      await backendServiceRef.current.setActiveModel(modelName);

      logger.info(`✅ Model changed successfully to: ${modelName}`);
    } catch (error) {
      logger.error('❌ Failed to change model:', error);
      // Rollback state on failure (Redux Persist will sync to localStorage)
      dispatch(setSelectedModel(previousModel));
    }
  };

  return {
    backendServiceRef,
    handleModelChange,
  };
};
