import cookieParser from 'cookie-parser'
import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { errorHandler } from '../../../core/middleware/error-handler.js'
import { TokenService } from '../../../core/security/token-service.js'
import { FakeGoogleIdentityVerifier } from '../../../test/fakes.js'
import { AuthService } from '../application/auth.service.js'
import { MongooseSessionRepository } from '../infrastructure/mongoose-session.repository.js'
import { MongooseUserRepository } from '../../users/infrastructure/mongoose-user.repository.js'
import { createAuthRouter } from './auth.routes.js'

describe('Auth Routes', () => {
  let app: express.Application
  let google: FakeGoogleIdentityVerifier

  const credential = 'google-id-token-'.padEnd(120, 'x')
  const env = {
    COOKIE_SECURE: false,
    COOKIE_SAME_SITE: 'lax' as const,
    COOKIE_DOMAIN: '',
  } as any

  beforeEach(() => {
    const users = new MongooseUserRepository()
    const sessions = new MongooseSessionRepository()
    google = new FakeGoogleIdentityVerifier()
    const tokens = new TokenService(
      'access-secret'.repeat(4),
      'refresh-secret'.repeat(4),
      '15m',
      '7d',
    )

    const authService = new AuthService(users, sessions, google, tokens, {
      allowedEmailDomains: ['campus.edu'],
      googleHostedDomains: [],
      adminEmails: [],
      superAdminEmails: [],
    })

    app = express()
    app.use(express.json())
    app.use(cookieParser())

    const authenticate = (req: any, _res: any, next: any) => {
      req.auth = { user: { id: 'some-user-id' } }
      next()
    }

    const rateLimitStoreFactory = () => undefined as any
    app.use('/auth', createAuthRouter(authService, authenticate, env, rateLimitStoreFactory))
    app.use(errorHandler)
  })

  it('POST /auth/google signs in a valid Google account and sets the refresh cookie', async () => {
    google.set(credential, {
      subject: 'google-user-1',
      email: 'student@campus.edu',
      emailVerified: true,
      name: 'Student User',
      picture: null,
      hostedDomain: 'campus.edu',
    })

    const response = await request(app).post('/auth/google').send({ credential })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.accessToken).toBeDefined()
    expect(response.body.data.user.email).toBe('student@campus.edu')
    expect(response.headers['set-cookie'][0]).toContain('campusbaza_refresh')
  })

  it('POST /auth/google rejects an account outside the allowed domains', async () => {
    google.set(credential, {
      subject: 'google-user-2',
      email: 'student@gmail.com',
      emailVerified: true,
      name: 'Student User',
      picture: null,
      hostedDomain: null,
    })

    const response = await request(app).post('/auth/google').send({ credential })

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('EMAIL_DOMAIN_NOT_ALLOWED')
  })

  it('POST /auth/google rejects an invalid Google credential', async () => {
    const response = await request(app).post('/auth/google').send({ credential })

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('GOOGLE_TOKEN_INVALID')
  })
})
