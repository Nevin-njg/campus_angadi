import { randomInt, randomUUID } from 'node:crypto'
import type { AuthUser, UserRole } from '@campusbaza/contracts'
import { isEmailDomainAllowed, normalizeEmail } from '@campusbaza/validation'
import { AppError } from '../../../core/errors/app-error.js'
import { hashOtp, hashToken } from '../../../core/security/hash.js'
import type { TokenService } from '../../../core/security/token-service.js'
import type { UserRepository } from '../../users/domain/user.js'
import { toAuthUser } from '../../users/domain/user.js'
import type { GoogleIdentityVerifier } from '../domain/google-identity.js'
import type { EmailSender, OtpStore } from '../domain/otp.js'
import type { SessionRepository } from '../domain/session.js'

export interface AuthServiceOptions {
  allowedEmailDomains: readonly string[]
  googleHostedDomains: readonly string[]
  adminEmails: readonly string[]
  superAdminEmails: readonly string[]
}

export interface RequestMetadata {
  ipAddress: string | null
  userAgent: string | null
}

export interface SellerOtpConfig {
  store: OtpStore
  emailSender: EmailSender
  hashSecret: string
  appName: string
  expiresInMinutes?: number
  resendAfterSeconds?: number
  attempts?: number
}

export interface AuthenticationResult {
  accessToken: string
  refreshToken: string
  refreshExpiresAt: Date
  user: AuthUser
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly googleIdentity: GoogleIdentityVerifier,
    private readonly tokenService: TokenService,
    private readonly options: AuthServiceOptions,
    private readonly sellerOtp?: SellerOtpConfig,
  ) {}

  async signInWithGoogle(
    credential: string,
    metadata: RequestMetadata,
  ): Promise<AuthenticationResult> {
    let identity
    try {
      identity = await this.googleIdentity.verify(credential)
    } catch {
      throw new AppError(
        401,
        'GOOGLE_TOKEN_INVALID',
        'Google sign-in could not be verified. Please try again.',
      )
    }

    if (!identity.emailVerified) {
      throw new AppError(
        403,
        'GOOGLE_EMAIL_NOT_VERIFIED',
        'Your Google account email must be verified.',
      )
    }

    const email = normalizeEmail(identity.email)
    const configuredRole = this.resolveConfiguredRole(email)
    let value = await this.users.findByEmail(email)
    const isFirstLogin = value === null

    const domainAllowed = isEmailDomainAllowed(email, this.options.allowedEmailDomains)
    if (!value && !domainAllowed && !configuredRole) {
      throw new AppError(
        403,
        'ACCESS_APPROVAL_REQUIRED',
        'This email needs administrator approval before its first sign-in.',
      )
    }
    if (domainAllowed) this.assertHostedDomain(email, identity.hostedDomain)

    if (!value) value = await this.users.findOrCreateByEmail(email, configuredRole ?? 'USER')
    if (value.user.status !== 'ACTIVE') {
      await this.sessions.revokeAllForUser(value.user.id, 'ACCOUNT_NOT_ACTIVE')
      throw new AppError(403, 'ACCOUNT_NOT_ACTIVE', 'This account is not currently active.')
    }

    if (isFirstLogin && (identity.name || identity.picture)) {
      const fullName = identity.name?.slice(0, 80) ?? undefined
      const displayName = identity.name?.slice(0, 40) ?? email.split('@')[0]?.slice(0, 40)
      value = await this.users.updateProfile(value.user.id, {
        ...(fullName ? { fullName } : {}),
        ...(displayName && displayName.length >= 2 ? { displayName } : {}),
        ...(identity.picture ? { profileImageUrl: identity.picture } : {}),
      })
    }

    value = await this.users.recordSuccessfulLogin(value.user.id, configuredRole ?? value.user.role)

    return this.createSession(value.user.id, value.user.role, toAuthUser(value), metadata)
  }

  async requestSellerOtp(
    rawEmail: string,
  ): Promise<{ expiresInSeconds: number; resendAfterSeconds: number }> {
    const config = this.requireSellerOtp()
    const email = normalizeEmail(rawEmail)

    const expiresInMinutes = config.expiresInMinutes ?? 5
    const resendAfterSeconds = config.resendAfterSeconds ?? 30
    const attempts = config.attempts ?? 5

    const value = await this.users.findByEmail(email)

    // Keep the request response generic so we do not expose which
    // email addresses are registered seller accounts.
    if (!value || value.user.role !== 'SELLER' || value.user.status !== 'ACTIVE') {
      return {
        expiresInSeconds: expiresInMinutes * 60,
        resendAfterSeconds,
      }
    }

    const now = new Date()
    const existing = await config.store.get(email)

    if (existing && existing.resendAvailableAt.getTime() > now.getTime()) {
      const waitSeconds = Math.max(
        1,
        Math.ceil(
          (existing.resendAvailableAt.getTime() - now.getTime()) / 1000,
        ),
      )

      throw new AppError(
        429,
        'SELLER_OTP_RESEND_TOO_SOON',
        `Wait ${waitSeconds} seconds before requesting another code.`,
      )
    }

    const sendCount = existing ? existing.sendCount + 1 : 1

    if (sendCount > 5) {
      throw new AppError(
        429,
        'SELLER_OTP_SEND_LIMIT',
        'Too many login codes requested. Try again later.',
      )
    }

    const code = randomInt(0, 1_000_000)
      .toString()
      .padStart(6, '0')

    const expiresAt = new Date(
      now.getTime() + expiresInMinutes * 60_000,
    )

    await config.store.set({
      email,
      hash: hashOtp(email, code, config.hashSecret),
      expiresAt,
      resendAvailableAt: new Date(
        now.getTime() + resendAfterSeconds * 1000,
      ),
      attemptsRemaining: attempts,
      sendCount,
      sendWindowStartedAt:
        existing?.sendWindowStartedAt ?? now,
    })

    try {
      await config.emailSender.sendLoginOtp({
        recipient: email,
        code,
        expiresInMinutes,
        appName: `${config.appName} Seller`,
      })
    } catch {
      await config.store.delete(email)

      throw new AppError(
        503,
        'SELLER_OTP_DELIVERY_FAILED',
        'Could not send the login code. Try again.',
      )
    }

    return {
      expiresInSeconds: expiresInMinutes * 60,
      resendAfterSeconds,
    }
  }

  async verifySellerOtp(
    rawEmail: string,
    code: string,
    metadata: RequestMetadata,
  ): Promise<AuthenticationResult> {
    const config = this.requireSellerOtp()
    const email = normalizeEmail(rawEmail)

    const verification = await config.store.verifyAndConsume(
      email,
      hashOtp(email, code, config.hashSecret),
    )

    if (verification.status === 'MISSING') {
      throw new AppError(
        401,
        'SELLER_OTP_EXPIRED',
        'The login code is missing or expired. Request a new code.',
      )
    }

    if (verification.status === 'LOCKED') {
      throw new AppError(
        429,
        'SELLER_OTP_LOCKED',
        'Too many incorrect attempts. Request a new code.',
      )
    }

    if (verification.status === 'INVALID') {
      throw new AppError(
        401,
        'SELLER_OTP_INVALID',
        `Incorrect code. ${verification.attemptsRemaining} attempts remaining.`,
      )
    }

    const value = await this.users.findByEmail(email)

    if (
      !value ||
      value.user.role !== 'SELLER' ||
      value.user.status !== 'ACTIVE'
    ) {
      throw new AppError(
        403,
        'SELLER_APP_ACCESS_DENIED',
        'This account cannot use the seller app.',
      )
    }

    const activeUser = await this.users.recordSuccessfulLogin(
      value.user.id,
      'SELLER',
    )

    return this.createSession(
      activeUser.user.id,
      activeUser.user.role,
      toAuthUser(activeUser),
      metadata,
    )
  }

  async signInForTesting(email: string, metadata: RequestMetadata): Promise<AuthenticationResult> {
    const value = await this.users.findByEmail(normalizeEmail(email))
    if (!value || value.user.status !== 'ACTIVE') {
      throw new AppError(401, 'TEST_LOGIN_INVALID', 'The test sign-in details are not valid.')
    }

    const activeUser = await this.users.recordSuccessfulLogin(value.user.id, value.user.role)
    return this.createSession(
      activeUser.user.id,
      activeUser.user.role,
      toAuthUser(activeUser),
      metadata,
    )
  }

  async refreshSellerMobile(refreshToken: string): Promise<AuthenticationResult> {
    const payload = this.tokenService.verifyRefreshToken(refreshToken)
    const session = await this.sessions.findById(payload.sid)

    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new AppError(401, 'SESSION_EXPIRED', 'Please sign in again.')
    }

    if (
      session.userId !== payload.sub ||
      session.refreshJti !== payload.jti ||
      session.refreshTokenHash !== hashToken(refreshToken)
    ) {
      // Do not revoke every seller device because of one stale/invalid token.
      // Each seller login is a separate device session.
      throw new AppError(401, 'SESSION_EXPIRED', 'Please sign in again.')
    }

    const value = await this.users.findById(payload.sub)
    if (!value || value.user.status !== 'ACTIVE') {
      await this.sessions.revoke(session.id, 'ACCOUNT_NOT_ACTIVE')
      throw new AppError(403, 'ACCOUNT_NOT_ACTIVE', 'This account is not currently active.')
    }

    return {
      accessToken: this.tokenService.createAccessToken(value.user.id, value.user.role),
      refreshToken,
      refreshExpiresAt: session.expiresAt,
      user: toAuthUser(value),
    }
  }

  async refresh(refreshToken: string): Promise<AuthenticationResult> {
    const payload = this.tokenService.verifyRefreshToken(refreshToken)
    const session = await this.sessions.findById(payload.sid)
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new AppError(401, 'SESSION_EXPIRED', 'Please sign in again.')
    }

    if (
      session.userId !== payload.sub ||
      session.refreshJti !== payload.jti ||
      session.refreshTokenHash !== hashToken(refreshToken)
    ) {
      await this.sessions.revokeAllForUser(payload.sub, 'REFRESH_TOKEN_REUSE_DETECTED')
      throw new AppError(
        401,
        'REFRESH_TOKEN_REUSE_DETECTED',
        'This session was revoked for security. Please sign in again.',
      )
    }

    const value = await this.users.findById(payload.sub)
    if (!value || value.user.status !== 'ACTIVE') {
      await this.sessions.revokeAllForUser(payload.sub, 'ACCOUNT_NOT_ACTIVE')
      throw new AppError(403, 'ACCOUNT_NOT_ACTIVE', 'This account is not currently active.')
    }

    const tokens = this.tokenService.createTokenPair(value.user.id, value.user.role, session.id)
    const rotated = await this.sessions.rotate(
      session.id,
      session.refreshTokenHash,
      session.refreshJti,
      hashToken(tokens.refreshToken),
      tokens.refreshJti,
      tokens.refreshExpiresAt,
    )

    if (!rotated) {
      await this.sessions.revokeAllForUser(payload.sub, 'REFRESH_TOKEN_REUSE_DETECTED')
      throw new AppError(
        401,
        'REFRESH_TOKEN_REUSE_DETECTED',
        'This session was revoked for security. Please sign in again.',
      )
    }

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshExpiresAt: tokens.refreshExpiresAt,
      user: toAuthUser(value),
    }
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return
    try {
      const payload = this.tokenService.verifyRefreshToken(refreshToken)
      await this.sessions.revoke(payload.sid, 'USER_LOGOUT')
    } catch {
      // Logout is idempotent; an invalid or expired cookie is still cleared by the controller.
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessions.revokeAllForUser(userId, 'USER_LOGOUT_ALL')
  }

  private async createSession(
    userId: string,
    role: UserRole,
    user: AuthUser,
    metadata: RequestMetadata,
  ): Promise<AuthenticationResult> {
    const sessionId = randomUUID()
    const tokens = this.tokenService.createTokenPair(userId, role, sessionId)

    await this.sessions.create({
      id: sessionId,
      userId,
      refreshTokenHash: hashToken(tokens.refreshToken),
      refreshJti: tokens.refreshJti,
      expiresAt: tokens.refreshExpiresAt,
      revokedAt: null,
      revokeReason: null,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
    })

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshExpiresAt: tokens.refreshExpiresAt,
      user,
    }
  }

  private requireSellerOtp(): SellerOtpConfig {
    if (!this.sellerOtp) {
      throw new AppError(
        503,
        'SELLER_OTP_NOT_CONFIGURED',
        'Seller login is not configured.',
      )
    }

    return this.sellerOtp
  }

  private assertHostedDomain(email: string, hostedDomain: string | null): void {
    if (this.options.googleHostedDomains.length === 0) return
    const emailDomain = email.split('@')[1] ?? ''
    if (emailDomain === 'gmail.com') return
    if (!hostedDomain || !this.options.googleHostedDomains.includes(hostedDomain)) {
      throw new AppError(
        403,
        'GOOGLE_HOSTED_DOMAIN_NOT_ALLOWED',
        'Use an approved Google Workspace account to continue.',
      )
    }
  }

  private resolveConfiguredRole(email: string): UserRole | null {
    if (this.options.superAdminEmails.includes(email)) return 'SUPER_ADMIN'
    if (this.options.adminEmails.includes(email)) return 'ADMIN'
    return null
  }
}
