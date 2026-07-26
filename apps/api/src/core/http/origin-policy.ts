export function isOriginAllowed(
  origin: string,
  allowedOrigins: readonly string[],
  environment: 'development' | 'test' | 'production',
): boolean {
  const normalized = origin.trim().toLowerCase()
  if (allowedOrigins.some((allowed) => allowed.toLowerCase() === normalized)) return true
  if (environment !== 'development') return false

  try {
    const url = new URL(normalized)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
  } catch {
    return false
  }
}
