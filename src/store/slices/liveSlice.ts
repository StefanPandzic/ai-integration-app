import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Live-updates connection (not persisted): while the SSE stream is open
 * the UI refetches on server events and barely polls
 */
interface LiveState {
  connected: boolean;
}

const initialState: LiveState = {
  connected: false,
};

const liveSlice = createSlice({
  name: 'live',
  initialState,
  reducers: {
    setLiveConnected: (state, action: PayloadAction<boolean>) => {
      state.connected = action.payload;
    },
  },
});

export const { setLiveConnected } = liveSlice.actions;

export default liveSlice.reducer;
