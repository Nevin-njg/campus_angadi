export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function getEmailDomain(email: string): string {
  const normalized = normalizeEmail(email)
  return normalized.slice(normalized.lastIndexOf('@') + 1)
}

export function isEmailDomainAllowed(email: string, allowedDomains: readonly string[]): boolean {
  const domain = getEmailDomain(email)
  return allowedDomains.some((allowedDomain) => domain === allowedDomain.toLowerCase())
}

export function maskEmail(email: string): string {
  const normalized = normalizeEmail(email)
  const [local = '', domain = ''] = normalized.split('@')
  const visible = local.slice(0, Math.min(2, local.length))
  const masked = `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}`
  return `${masked}@${domain}`
}
