import { ProgressCallback, ProcessingStep } from '../types';

export const createProgressEmitter = (onProgress?: ProgressCallback) => {
  return (
    id: string,
    label: string,
    status: ProcessingStep['status'],
    details?: string,
  ) => {
    if (onProgress) {
      onProgress({
        id,
        label,
        status,
        details,
        timestamp: Date.now(),
      });
    }
  };
};
