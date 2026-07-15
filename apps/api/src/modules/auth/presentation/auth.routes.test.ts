import { describe, expect, it, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import { createAuthRouter } from './auth.routes.js'
import { AuthService } from '../application/auth.service.js'
import { MongooseUserRepository } from '../../users/infrastructure/mongoose-user.repository.js'
import { MongooseSessionRepository } from '../infrastructure/mongoose-session.repository.js'
import { UserModel, UserProfileModel } from '../../users/infrastructure/user.models.js'
import { FakeEmailSender } from '../../../test/fakes.js'
import { InMemoryOtpStore } from '../../../infrastructure/otp/in-memory-otp.store.js'
import { TokenService } from '../../../core/security/token-service.js'
import { errorHandler } from '../../../core/middleware/error-handler.js'

describe('Auth Routes', () => {
  let app: express.Application
  let authService: AuthService
  let emailSender: FakeEmailSender
  let otpStore: InMemoryOtpStore
  let users: MongooseUserRepository
  let sessions: MongooseSessionRepository
  let tokens: TokenService

  const env = {
    COOKIE_SECURE: false,
    COOKIE_SAME_SITE: 'lax' as const,
    COOKIE_DOMAIN: '',
    OTP_SEND_MAX_PER_HOUR: 10
  } as any

  beforeEach(() => {
    users = new MongooseUserRepository()
    sessions = new MongooseSessionRepository()
    emailSender = new FakeEmailSender()
    otpStore = new InMemoryOtpStore()
    tokens = new TokenService('access-secret', 'refresh-secret', '15m', '7d')

    authService = new AuthService(
      users,
      sessions,
      otpStore,
      emailSender,
      tokens,
      {
        appName: 'TestApp',
        allowedEmailDomains: ['campus.edu'],
        adminEmails: [],
        superAdminEmails: [],
        otpLength: 6,
        otpExpiryMinutes: 5,
        otpResendCooldownSeconds: 0, // No cooldown for testing
        otpMaxAttempts: 3,
        otpHashSecret: 'hash-secret'
      }
    )

    app = express()
    app.use(express.json())
    app.use(cookieParser())

    const authenticate = (req: any, res: any, next: any) => {
      req.auth = { user: { id: 'some-user-id' } }
      next()
    }

    const rateLimitStoreFactory = () => undefined as any

    app.use('/auth', createAuthRouter(authService, authenticate, env, rateLimitStoreFactory))
    app.use(errorHandler)
  })

  it('POST /auth/otp/request sends an OTP for a valid email', async () => {
    const response = await request(app)
      .post('/auth/otp/request')
      .send({ email: 'student@campus.edu' })

    expect(response.status).toBe(202)
    expect(response.body.success).toBe(true)
    expect(emailSender.messages).toHaveLength(1)
    expect(emailSender.messages[0].recipient).toBe('student@campus.edu')
  })

  it('POST /auth/otp/request fails for invalid email domain', async () => {
    const response = await request(app)
      .post('/auth/otp/request')
      .send({ email: 'student@gmail.com' })

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('EMAIL_DOMAIN_NOT_ALLOWED')
  })

  it('POST /auth/otp/verify verifies OTP and sets cookie', async () => {
    await request(app)
      .post('/auth/otp/request')
      .send({ email: 'student@campus.edu' })
    
    const code = emailSender.messages[0].code
    
    const response = await request(app)
      .post('/auth/otp/verify')
      .send({ email: 'student@campus.edu', code })
      
    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.accessToken).toBeDefined()
    expect(response.headers['set-cookie'][0]).toContain('campusbaza_refresh')
  })

  it('POST /auth/otp/verify fails with invalid code', async () => {
    await request(app)
      .post('/auth/otp/request')
      .send({ email: 'student@campus.edu' })
      
    const response = await request(app)
      .post('/auth/otp/verify')
      .send({ email: 'student@campus.edu', code: '000000' })
      
    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('OTP_INVALID_OR_EXPIRED')
  })
})
