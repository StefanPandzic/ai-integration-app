import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { combineReducers } from '@reduxjs/toolkit';
import appReducer from './slices/appSlice';
import transcriptionReducer from './slices/transcriptionSlice';
import productionReducer from './slices/productionSlice';
import commandReducer from './slices/commandSlice';

/**
 * Redux-persist configuration
 * Persists transcription history to localStorage
 */
const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['transcription'], // Only persist transcription slice
};

/**
 * App-specific persist configuration for selective persistence
 * Only persist selectedModel, selectedLanguage, and colorMode from app slice
 */
const appPersistConfig = {
  key: 'app',
  storage,
  whitelist: ['selectedModel', 'selectedLanguage', 'colorMode'], // Only persist these fields
};

/**
 * Transcription-specific persist configuration
 * Only persist history array, not transient UI state like isSaving
 */
const transcriptionPersistConfig = {
  key: 'transcription',
  storage,
  whitelist: ['history'], // Only persist history, not isSaving
};

const rootReducer = combineReducers({
  app: persistReducer(appPersistConfig, appReducer),
  transcription: persistReducer(
    transcriptionPersistConfig,
    transcriptionReducer,
  ),
  production: productionReducer,
  command: commandReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

/**
 * Configure Redux store with persistence middleware
 * Redux DevTools enabled in development mode only
 */
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore all redux-persist actions for serialization check
        ignoredActions: [
          'persist/FLUSH',
          'persist/REHYDRATE',
          'persist/PAUSE',
          'persist/PERSIST',
          'persist/PURGE',
          'persist/REGISTER',
        ],
      },
    }),
  devTools: import.meta.env.DEV, // Enable Redux DevTools in development only
});

export const persistor = persistStore(store);

// Export types for TypeScript usage
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
