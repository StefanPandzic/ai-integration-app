import { combineReducers, configureStore } from '@reduxjs/toolkit';
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  persistReducer,
  persistStore,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { api } from './api';
import appReducer from './slices/appSlice';

/**
 * Only the `app` slice (color mode) is persisted; the RTK Query cache
 * is refetched from the backend
 */
const persistConfig = {
  key: 'coaching',
  storage,
  whitelist: ['app'],
};

// Keys written by the old speech-to-text app (transcripts with embeddings)
const LEGACY_PERSIST_KEYS = ['persist:root', 'persist:app', 'persist:transcription'];
LEGACY_PERSIST_KEYS.forEach((key) => {
  void storage.removeItem(key);
});

const rootReducer = combineReducers({
  app: appReducer,
  [api.reducerPath]: api.reducer,
});

export const store = configureStore({
  reducer: persistReducer(persistConfig, rootReducer),
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(api.middleware),
  devTools: import.meta.env.DEV,
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
