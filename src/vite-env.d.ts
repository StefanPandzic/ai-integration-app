/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OLLAMA_API_URL?: string;
  readonly VITE_OLLAMA_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
