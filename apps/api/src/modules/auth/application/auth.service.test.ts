import { describe, expect, it } from 'vitest'
import { TokenService } from '../../../core/security/token-service.js'
import {
  FakeGoogleIdentityVerifier,
  InMemorySessionRepository,
  InMemoryUserRepository,
} from '../../../test/fakes.js'
import { AuthService } from './auth.service.js'

function createSubject() {
  const users = new InMemoryUserRepository()
  const sessions = new InMemorySessionRepository()
  const google = new FakeGoogleIdentityVerifier()
  const tokens = new TokenService('a'.repeat(48), 'b'.repeat(48), '15m', '30d')
  const auth = new AuthService(users, sessions, google, tokens, {
    allowedEmailDomains: ['campusbaza.example.edu', 'gmail.com'],
    googleHostedDomains: [],
    adminEmails: ['admin@campusbaza.example.edu'],
    superAdminEmails: ['owner@campusbaza.example.edu'],
  })
  return { auth, users, sessions, google }
}

function identity(email: string) {
  return {
    subject: `google-${email}`,
    email,
    emailVerified: true,
    name: 'Campus Student',
    picture: 'https://example.com/avatar.png',
    hostedDomain: email.endsWith('@gmail.com') ? null : 'campusbaza.example.edu',
  }
}

describe('AuthService', () => {
  it('rejects Google accounts outside configured email domains', async () => {
    const { auth, google } = createSubject()
    google.set('outside-token', identity('student@outside.example'))

    await expect(
      auth.signInWithGoogle('outside-token', { ipAddress: null, userAgent: null }),
    ).rejects.toMatchObject({
      code: 'EMAIL_DOMAIN_NOT_ALLOWED',
      statusCode: 403,
    })
  })

  it('creates a profile on first Google login and reuses it later', async () => {
    const { auth, users, google } = createSubject()
    const address = 'student@campusbaza.example.edu'
    google.set('student-token', identity(address))

    const first = await auth.signInWithGoogle('student-token', {
      ipAddress: null,
      userAgent: null,
    })
    expect(first.user.email).toBe(address)
    expect(first.user.profile.fullName).toBe('Campus Student')
    expect(first.user.profileCompleted).toBe(false)

    const second = await auth.signInWithGoogle('student-token', {
      ipAddress: null,
      userAgent: null,
    })
    expect(second.user.id).toBe(first.user.id)
    expect((await users.findByEmail(address))?.user.id).toBe(first.user.id)
  })

  it('rejects an invalid Google credential', async () => {
    const { auth } = createSubject()
    await expect(
      auth.signInWithGoogle('invalid-token', { ipAddress: null, userAgent: null }),
    ).rejects.toMatchObject({ code: 'GOOGLE_TOKEN_INVALID' })
  })

  it('provisions configured administrator roles only on the backend', async () => {
    const { auth, google } = createSubject()
    const address = 'admin@campusbaza.example.edu'
    google.set('admin-token', identity(address))

    const result = await auth.signInWithGoogle('admin-token', {
      ipAddress: null,
      userAgent: null,
    })
    expect(result.user.role).toBe('ADMIN')
  })

  it('preserves roles promoted through the administrator console', async () => {
    const { auth, users, google } = createSubject()
    const address = 'moderator@campusbaza.example.edu'
    await users.findOrCreateByEmail(address, 'MODERATOR')
    google.set('moderator-token', identity(address))

    const result = await auth.signInWithGoogle('moderator-token', {
      ipAddress: null,
      userAgent: null,
    })

    expect(result.user.role).toBe('MODERATOR')
  })

  it('rotates refresh tokens and revokes the session when an old token is reused', async () => {
    const { auth, google, sessions } = createSubject()
    const address = 'student@campusbaza.example.edu'
    google.set('refresh-token', identity(address))
    const login = await auth.signInWithGoogle('refresh-token', {
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
