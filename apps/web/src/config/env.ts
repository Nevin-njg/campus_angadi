import { DEFAULT_BRAND } from '@campusbaza/config'

export const webEnv = {
  apiUrl: import.meta.env.VITE_API_URL ?? '/api/v1',
  appName: import.meta.env.VITE_APP_NAME ?? DEFAULT_BRAND.appName,
  brandMark: import.meta.env.VITE_BRAND_MARK ?? DEFAULT_BRAND.brandMark,
  campusDisplayName: import.meta.env.VITE_CAMPUS_DISPLAY_NAME ?? DEFAULT_BRAND.campusDisplayName,
}
