import { describe, expect, it } from 'vitest'
import { TokenService } from '../../../core/security/token-service.js'
import { InMemoryOtpStore } from '../../../infrastructure/otp/in-memory-otp.store.js'
import {
  FakeEmailSender,
  InMemorySessionRepository,
  InMemoryUserRepository,
} from '../../../test/fakes.js'
import { AuthService } from './auth.service.js'

function createSubject() {
  const users = new InMemoryUserRepository()
  const sessions = new InMemorySessionRepository()
  const otpStore = new InMemoryOtpStore()
  const email = new FakeEmailSender()
  const tokens = new TokenService('a'.repeat(48), 'b'.repeat(48), '15m', '30d')
  const auth = new AuthService(users, sessions, otpStore, email, tokens, {
    appName: 'Campus Angaadi',
    allowedEmailDomains: ['campusbaza.example.edu'],
    adminEmails: ['admin@campusbaza.example.edu'],
    superAdminEmails: ['owner@campusbaza.example.edu'],
    otpLength: 6,
    otpExpiryMinutes: 5,
    otpResendCooldownSeconds: 60,
    otpMaxAttempts: 5,
    otpHashSecret: 'c'.repeat(48),
  })
  return { auth, users, sessions, email }
}

describe('AuthService', () => {
  it('rejects email addresses outside the configured campus domains', async () => {
    const { auth } = createSubject()
    await expect(auth.requestOtp('student@gmail.com')).rejects.toMatchObject({
      code: 'EMAIL_DOMAIN_NOT_ALLOWED',
      statusCode: 403,
    })
  })

  it('creates a profile on first OTP login and reuses it on later logins', async () => {
    const { auth, users, email } = createSubject()
    const address = 'student@campusbaza.example.edu'
    await auth.requestOtp(address)
    const first = await auth.verifyOtp(address, email.messages.at(-1)!.code, {
      ipAddress: null,
      userAgent: null,
    })
    expect(first.user.email).toBe(address)
    expect(first.user.profileCompleted).toBe(false)

    await auth.requestOtp(address)
    const second = await auth.verifyOtp(address, email.messages.at(-1)!.code, {
      ipAddress: null,
      userAgent: null,
    })
    expect(second.user.id).toBe(first.user.id)
    expect((await users.findByEmail(address))?.user.id).toBe(first.user.id)
  })

  it('consumes a successful OTP exactly once', async () => {
    const { auth, email } = createSubject()
    const address = 'student@campusbaza.example.edu'
    await auth.requestOtp(address)
    const code = email.messages.at(-1)!.code
    await auth.verifyOtp(address, code, { ipAddress: null, userAgent: null })
    await expect(
      auth.verifyOtp(address, code, { ipAddress: null, userAgent: null }),
    ).rejects.toMatchObject({
      code: 'OTP_INVALID_OR_EXPIRED',
    })
  })

  it('provisions configured administrator roles only on the backend', async () => {
    const { auth, email } = createSubject()
    await auth.requestOtp('admin@campusbaza.example.edu')
    const result = await auth.verifyOtp(
      'admin@campusbaza.example.edu',
      email.messages.at(-1)!.code,
      {
        ipAddress: null,
        userAgent: null,
      },
    )
    expect(result.user.role).toBe('ADMIN')
  })

  it('rotates refresh tokens and revokes the session when an old token is reused', async () => {
    const { auth, email, sessions } = createSubject()
    const address = 'student@campusbaza.example.edu'
    await auth.requestOtp(address)
    const login = await auth.verifyOtp(address, email.messages.at(-1)!.code, {
      ipAddress: null,
      userAgent: null,
    })
    const refreshed = await auth.refresh(login.refreshToken)
    expect(refreshed.refreshToken).not.toBe(login.refreshToken)

    await expect(auth.refresh(login.refreshToken)).rejects.toMatchObject({
      code: 'REFRESH_TOKEN_REUSE_DETECTED',
    })
    expect([...sessions.sessions.values()].every((session) => session.revokedAt !== null)).toBe(
      true,
    )
  })
})
