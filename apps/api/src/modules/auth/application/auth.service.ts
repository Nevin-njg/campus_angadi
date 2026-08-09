import { randomUUID } from 'node:crypto'
import type { AuthUser, UserRole } from '@campusbaza/contracts'
import { isEmailDomainAllowed, normalizeEmail } from '@campusbaza/validation'
import { AppError } from '../../../core/errors/app-error.js'
import { hashToken } from '../../../core/security/hash.js'
import type { TokenService } from '../../../core/security/token-service.js'
import type { UserRepository } from '../../users/domain/user.js'
import { toAuthUser } from '../../users/domain/user.js'
import type { GoogleIdentityVerifier } from '../domain/google-identity.js'
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
