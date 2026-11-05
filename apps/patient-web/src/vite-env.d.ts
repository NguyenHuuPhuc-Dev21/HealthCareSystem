/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCK?: string;
  readonly VITE_API_PROXY_TARGET?: string;
  readonly VITE_NURSE_WEB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
