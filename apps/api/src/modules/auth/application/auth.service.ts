import { randomInt, randomUUID } from 'node:crypto'
import type { AuthUser, UserRole } from '@campusbaza/contracts'
import { isEmailDomainAllowed, maskEmail, normalizeEmail } from '@campusbaza/validation'
import { AppError } from '../../../core/errors/app-error.js'
import { hashOtp, hashToken } from '../../../core/security/hash.js'
import type { TokenService } from '../../../core/security/token-service.js'
import type { UserRepository } from '../../users/domain/user.js'
import { toAuthUser } from '../../users/domain/user.js'
import type { EmailSender, OtpRecord, OtpStore } from '../domain/otp.js'
import type { SessionRepository } from '../domain/session.js'

export interface AuthServiceOptions {
  appName: string
  allowedEmailDomains: readonly string[]
  adminEmails: readonly string[]
  superAdminEmails: readonly string[]
  otpLength: number
  otpExpiryMinutes: number
  otpResendCooldownSeconds: number
  otpMaxAttempts: number
  otpHashSecret: string
}

export interface RequestMetadata {
  ipAddress: string | null
  userAgent: string | null
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
    private readonly otpStore: OtpStore,
    private readonly emailSender: EmailSender,
    private readonly tokenService: TokenService,
    private readonly options: AuthServiceOptions,
  ) {}

  async requestOtp(
    rawEmail: string,
  ): Promise<{ maskedEmail: string; expiresInSeconds: number; resendAfterSeconds: number }> {
    const email = this.assertAllowedEmail(rawEmail)
    const now = new Date()
    const existing = await this.otpStore.get(email)

    if (existing && existing.resendAvailableAt.getTime() > now.getTime()) {
      const retryAfter = Math.ceil((existing.resendAvailableAt.getTime() - now.getTime()) / 1000)
      throw new AppError(
        429,
        'OTP_RESEND_COOLDOWN',
        `Please wait ${retryAfter} seconds before requesting another code.`,
        {
          retryAfterSeconds: retryAfter,
        },
      )
    }

    const code = randomInt(0, 10 ** this.options.otpLength)
      .toString()
      .padStart(this.options.otpLength, '0')
    const expiresAt = new Date(now.getTime() + this.options.otpExpiryMinutes * 60_000)
    const resendAvailableAt = new Date(now.getTime() + this.options.otpResendCooldownSeconds * 1000)
    const sendWindowStartedAt =
      existing && now.getTime() - existing.sendWindowStartedAt.getTime() < 60 * 60_000
        ? existing.sendWindowStartedAt
        : now
    const sendCount =
      existing && now.getTime() - existing.sendWindowStartedAt.getTime() < 60 * 60_000
        ? existing.sendCount + 1
        : 1

    const record: OtpRecord = {
      email,
      hash: hashOtp(email, code, this.options.otpHashSecret),
      expiresAt,
      resendAvailableAt,
      attemptsRemaining: this.options.otpMaxAttempts,
      sendCount,
      sendWindowStartedAt,
    }

    await this.otpStore.set(record)
    try {
      await this.emailSender.sendLoginOtp({
        recipient: email,
        code,
        expiresInMinutes: this.options.otpExpiryMinutes,
        appName: this.options.appName,
      })
    } catch (error) {
      await this.otpStore.delete(email)
      throw new AppError(
        503,
        'OTP_DELIVERY_FAILED',
        'The login code could not be delivered. Please try again.',
        {
          cause: error instanceof Error ? error.message : 'Unknown email provider error',
        },
      )
    }

    return {
      maskedEmail: maskEmail(email),
      expiresInSeconds: this.options.otpExpiryMinutes * 60,
      resendAfterSeconds: this.options.otpResendCooldownSeconds,
    }
  }

  async verifyOtp(
    rawEmail: string,
    code: string,
    metadata: RequestMetadata,
  ): Promise<AuthenticationResult> {
    const email = this.assertAllowedEmail(rawEmail)
    const candidateHash = hashOtp(email, code, this.options.otpHashSecret)
    const verification = await this.otpStore.verifyAndConsume(email, candidateHash)

    if (verification.status === 'MISSING') {
      throw new AppError(401, 'OTP_INVALID_OR_EXPIRED', 'The code is invalid or has expired.')
    }
    if (verification.status === 'LOCKED') {
      throw new AppError(
        429,
        'OTP_ATTEMPTS_EXCEEDED',
        'Too many incorrect attempts. Request a new code.',
      )
    }
    if (verification.status === 'INVALID') {
      throw new AppError(401, 'OTP_INVALID_OR_EXPIRED', 'The code is invalid or has expired.', {
        attemptsRemaining: verification.attemptsRemaining,
      })
    }

    const configuredRole = this.resolveConfiguredRole(email)
    let value = await this.users.findByEmail(email)
    if (!value) value = await this.users.findOrCreateByEmail(email, configuredRole ?? 'USER')
    if (value.user.status !== 'ACTIVE') {
      await this.sessions.revokeAllForUser(value.user.id, 'ACCOUNT_NOT_ACTIVE')
      throw new AppError(403, 'ACCOUNT_NOT_ACTIVE', 'This account is not currently active.')
    }

    value = await this.users.recordSuccessfulLogin(value.user.id, configuredRole ?? value.user.role)
    const sessionId = randomUUID()
    const tokens = this.tokenService.createTokenPair(value.user.id, value.user.role, sessionId)

    await this.sessions.create({
      id: sessionId,
      userId: value.user.id,
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
    await this.sessions.rotate(
      session.id,
      hashToken(tokens.refreshToken),
      tokens.refreshJti,
      tokens.refreshExpiresAt,
    )

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

  private assertAllowedEmail(rawEmail: string): string {
    const email = normalizeEmail(rawEmail)
    if (!isEmailDomainAllowed(email, this.options.allowedEmailDomains)) {
      throw new AppError(
        403,
        'EMAIL_DOMAIN_NOT_ALLOWED',
        'Use an approved campus email address to continue.',
      )
    }
    return email
  }

  private resolveConfiguredRole(email: string): UserRole | null {
    if (this.options.superAdminEmails.includes(email)) return 'SUPER_ADMIN'
    if (this.options.adminEmails.includes(email)) return 'ADMIN'
    return null
  }
}
