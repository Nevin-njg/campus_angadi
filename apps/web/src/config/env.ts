import { DEFAULT_BRAND } from '@campusbaza/config'

const fallbackIceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]

function hasIceServerUrls(entry: unknown): entry is RTCIceServer {
  if (typeof entry !== 'object' || entry === null) return false
  const urls = (entry as Record<string, unknown>)['urls']
  return (
    typeof urls === 'string' ||
    (Array.isArray(urls) && urls.length > 0 && urls.every((url) => typeof url === 'string'))
  )
}

function parseIceServers(value: string | undefined): RTCIceServer[] {
  if (!value) return fallbackIceServers
  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(hasIceServerUrls)) {
      return parsed
    }
  } catch {
    // Invalid deployment configuration falls back to public STUN instead of breaking chat.
  }
  return fallbackIceServers
}

export const webEnv = {
  apiUrl: import.meta.env.VITE_API_URL ?? '/api/v1',
  appName: import.meta.env.VITE_APP_NAME ?? DEFAULT_BRAND.appName,
  brandMark: import.meta.env.VITE_BRAND_MARK ?? DEFAULT_BRAND.brandMark,
  campusDisplayName: import.meta.env.VITE_CAMPUS_DISPLAY_NAME ?? DEFAULT_BRAND.campusDisplayName,
  webrtcIceServers: parseIceServers(import.meta.env.VITE_WEBRTC_ICE_SERVERS_JSON),
}
