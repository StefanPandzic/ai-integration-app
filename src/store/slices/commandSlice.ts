import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BatchCommandResult } from '../../features/ai/types';

/**
 * Command interpreter state slice
 * Manages AI command execution state and history
 */
interface CommandState {
  isProcessing: boolean;
  currentResult: BatchCommandResult | null;
  history: BatchCommandResult[];
  error: string | null;
}

const initialState: CommandState = {
  isProcessing: false,
  currentResult: null,
  history: [],
  error: null,
};

const commandSlice = createSlice({
  name: 'command',
  initialState,
  reducers: {
    setProcessing: (state, action: PayloadAction<boolean>) => {
      state.isProcessing = action.payload;
      if (action.payload) {
        state.error = null;
      }
    },
    setCommandResult: (state, action: PayloadAction<BatchCommandResult>) => {
      state.currentResult = action.payload;
      state.history = [action.payload, ...state.history].slice(0, 5); // Keep last 5
      state.isProcessing = false;
      state.error = null;
    },
    setCommandError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isProcessing = false;
    },
    clearCommandHistory: (state) => {
      state.history = [];
      state.currentResult = null;
    },
    dismissCurrentResult: (state) => {
      state.currentResult = null;
      state.error = null;
    },
  },
});

export const {
  setProcessing,
  setCommandResult,
  setCommandError,
  clearCommandHistory,
  dismissCurrentResult,
} = commandSlice.actions;

export default commandSlice.reducer;
