import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Transcription } from '../../features/ai/types/transcription';

/**
 * Transcription history state slice
 * Manages transcription CRUD operations
 */
interface TranscriptionState {
  history: Transcription[];
  isSaving: boolean;
}

const initialState: TranscriptionState = {
  history: [],
  isSaving: false,
};

// Maximum number of transcriptions to keep in history
const MAX_HISTORY_SIZE = 20;

const transcriptionSlice = createSlice({
  name: 'transcription',
  initialState,
  reducers: {
    // Set entire history (used for initial load from persistence)
    setHistory: (state, action: PayloadAction<Transcription[]>) => {
      state.history = action.payload;
    },

    // Set isSaving flag
    setIsSaving: (state, action: PayloadAction<boolean>) => {
      state.isSaving = action.payload;
    },

    // Add new transcription to history
    addTranscription: (state, action: PayloadAction<Transcription>) => {
      // Prepend new transcription (newest first)
      state.history = [action.payload, ...state.history].slice(
        0,
        MAX_HISTORY_SIZE,
      );
    },

    // Delete transcription by ID
    deleteTranscription: (state, action: PayloadAction<string>) => {
      state.history = state.history.filter(
        (item) => item.id !== action.payload,
      );
    },

    // Clear all transcription history
    clearHistory: (state) => {
      state.history = [];
    },

    // Update AI response for a specific transcription
    updateTranscriptionResponse: (
      state,
      action: PayloadAction<{ id: string; aiResponse: string }>,
    ) => {
      const transcription = state.history.find(
        (item) => item.id === action.payload.id,
      );
      if (transcription) {
        transcription.aiResponse = action.payload.aiResponse;
        transcription.isGeneratingResponse = false;
      }
    },

    // Update embedding for a specific transcription
    updateTranscriptionEmbedding: (
      state,
      action: PayloadAction<{ id: string; embedding: number[] }>,
    ) => {
      const transcription = state.history.find(
        (item) => item.id === action.payload.id,
      );
      if (transcription) {
        transcription.embedding = action.payload.embedding;
      }
    },

    // Set isGeneratingResponse flag for a specific transcription
    setGeneratingResponse: (
      state,
      action: PayloadAction<{ id: string; isGenerating: boolean }>,
    ) => {
      const transcription = state.history.find(
        (item) => item.id === action.payload.id,
      );
      if (transcription) {
        transcription.isGeneratingResponse = action.payload.isGenerating;
      }
    },
  },
});

export const {
  setHistory,
  setIsSaving,
  addTranscription,
  deleteTranscription,
  clearHistory,
  updateTranscriptionResponse,
  updateTranscriptionEmbedding,
  setGeneratingResponse,
} = transcriptionSlice.actions;

export default transcriptionSlice.reducer;
