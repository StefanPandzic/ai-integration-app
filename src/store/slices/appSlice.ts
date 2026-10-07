import { createSlice, PayloadAction } from '@reduxjs/toolkit';

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
    setColorMode: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.colorMode = action.payload;
    },
    toggleColorMode: (state) => {
      state.colorMode = state.colorMode === 'light' ? 'dark' : 'light';
    },
  },
});

export const { setColorMode, toggleColorMode } = appSlice.actions;

export default appSlice.reducer;
