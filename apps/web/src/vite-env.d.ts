/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TEST_LOGIN_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_APP_NAME?: string
  readonly VITE_BRAND_MARK?: string
  readonly VITE_CAMPUS_DISPLAY_NAME?: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
