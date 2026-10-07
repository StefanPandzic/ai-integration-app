import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ProcessingStep } from '../../features/ai/types/processing';
import { ModelMetadata } from '../../features/ai';

/**
 * App-level state slice
 * Manages UI state, AI processing state, and speech recognition settings
 */
interface AppState {
  // UI State
  appTitle: string;
  appSubtitle: string;
  colorMode: 'light' | 'dark';

  // AI Processing State
  selectedModel: string;
  availableModels: ModelMetadata[];
  processingSteps: ProcessingStep[];
  currentThinking: string | null;
  isThinking: boolean;

  // Speech Recognition State
  selectedLanguage: string;
}

const initialState: AppState = {
  // UI State
  appTitle: 'Speech-to-Text AI',
  appSubtitle: 'Speak naturally, AI responds instantly',
  colorMode: 'light',

  // AI Processing State
  selectedModel: 'llama3',
  availableModels: [],
  processingSteps: [],
  currentThinking: null,
  isThinking: false,

  // Speech Recognition State
  selectedLanguage: 'en-US',
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    // UI State Actions
    setAppTitle: (state, action: PayloadAction<string>) => {
      state.appTitle = action.payload;
    },
    setAppSubtitle: (state, action: PayloadAction<string>) => {
      state.appSubtitle = action.payload;
    },
    setColorMode: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.colorMode = action.payload;
    },
    toggleColorMode: (state) => {
      state.colorMode = state.colorMode === 'light' ? 'dark' : 'light';
    },

    // AI Processing Actions
    setSelectedModel: (state, action: PayloadAction<string>) => {
      state.selectedModel = action.payload;
    },
    setAvailableModels: (state, action: PayloadAction<ModelMetadata[]>) => {
      state.availableModels = action.payload;
    },
    setProcessingSteps: (state, action: PayloadAction<ProcessingStep[]>) => {
      state.processingSteps = action.payload;
    },
    setCurrentThinking: (state, action: PayloadAction<string | null>) => {
      state.currentThinking = action.payload;
    },
    appendThinking: (state, action: PayloadAction<string>) => {
      state.currentThinking = (state.currentThinking || '') + action.payload;
    },
    setIsThinking: (state, action: PayloadAction<boolean>) => {
      state.isThinking = action.payload;
    },
    updateProcessingStep: (state, action: PayloadAction<ProcessingStep>) => {
      const existing = state.processingSteps.find(
        (s) => s.id === action.payload.id,
      );
      if (existing) {
        state.processingSteps = state.processingSteps.map((s) =>
          s.id === action.payload.id ? action.payload : s,
        );
      } else {
        state.processingSteps.push(action.payload);
      }
    },

    // Speech Recognition Actions
    setSelectedLanguage: (state, action: PayloadAction<string>) => {
      state.selectedLanguage = action.payload;
    },
  },
});

export const {
  setAppTitle,
  setAppSubtitle,
  setColorMode,
  toggleColorMode,
  setSelectedModel,
  setAvailableModels,
  setProcessingSteps,
  setCurrentThinking,
  appendThinking,
  setIsThinking,
  updateProcessingStep,
  setSelectedLanguage,
} = appSlice.actions;

export default appSlice.reducer;
