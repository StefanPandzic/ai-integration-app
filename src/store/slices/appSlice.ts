import { createSlice } from '@reduxjs/toolkit';

/**
 * App-level UI state (persisted)
 */
interface AppState {
  colorMode: 'light' | 'dark';
}

const initialState: AppState = {
  colorMode: 'light',
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    toggleColorMode: (state) => {
      state.colorMode = state.colorMode === 'light' ? 'dark' : 'light';
    },
  },
});

export const { toggleColorMode } = appSlice.actions;

export default appSlice.reducer;
