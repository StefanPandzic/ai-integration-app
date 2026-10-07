export type ProcessingStepStatus = 'pending' | 'active' | 'complete' | 'error';

export interface ProcessingStep {
  id: string;
  label: string;
  status: ProcessingStepStatus;
  details?: string;
  timestamp?: number;
}

export type ProgressCallback = (step: ProcessingStep) => void;
