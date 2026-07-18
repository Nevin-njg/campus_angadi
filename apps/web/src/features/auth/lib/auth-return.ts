const RETURN_TO_KEY = 'campusbaza-auth-return-to'

export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  if (value.startsWith('/login') || value.startsWith('/verify-otp')) return null
  return value
}

export function rememberReturnTo(value: string | null | undefined): void {
  const safeValue = safeReturnTo(value)
  if (safeValue) window.sessionStorage.setItem(RETURN_TO_KEY, safeValue)
}

export function takeReturnTo(): string | null {
  const value = safeReturnTo(window.sessionStorage.getItem(RETURN_TO_KEY))
  window.sessionStorage.removeItem(RETURN_TO_KEY)
  return value
}
