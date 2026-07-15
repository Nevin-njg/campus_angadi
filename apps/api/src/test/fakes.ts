import { randomUUID } from 'node:crypto'
import type { UpdateProfileInput, UserRole } from '@campusbaza/contracts'
import type { EmailSender } from '../modules/auth/domain/otp.js'
import type { SessionRecord, SessionRepository } from '../modules/auth/domain/session.js'
import type {
  ProfileRecord,
  UserRecord,
  UserRepository,
  UserWithProfile,
} from '../modules/users/domain/user.js'

export class FakeEmailSender implements EmailSender {
  readonly messages: Array<{ recipient: string; code: string }> = []

  async sendLoginOtp(input: { recipient: string; code: string }): Promise<void> {
    this.messages.push({ recipient: input.recipient, code: input.code })
  }
}

export class InMemoryUserRepository implements UserRepository {
  private readonly records = new Map<string, UserWithProfile>()

  async findById(id: string): Promise<UserWithProfile | null> {
    const record = this.records.get(id)
    return record ? structuredClone(record) : null
  }

  async findByEmail(email: string): Promise<UserWithProfile | null> {
    const record = [...this.records.values()].find((value) => value.user.email === email)
    return record ? structuredClone(record) : null
  }

  async findOrCreateByEmail(email: string, role: UserRole): Promise<UserWithProfile> {
    const existing = await this.findByEmail(email)
    if (existing) {
      existing.user.role = role
      this.records.set(existing.user.id, structuredClone(existing))
      return existing
    }
    const now = new Date()
    const id = randomUUID()
    const user: UserRecord = {
      id,
      email,
      emailVerified: true,
      role,
      status: 'ACTIVE',
      canSell: true,
      profileCompleted: false,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
      lastActiveAt: null,
    }
    const profile: ProfileRecord = {
      userId: id,
      fullName: null,
      displayName: null,
      profileImageUrl: null,
      phoneNumber: null,
      department: null,
      graduationYear: null,
      campusRole: null,
      preferredPickupLocation: null,
      bio: null,
      createdAt: now,
      updatedAt: now,
    }
    const value = { user, profile }
    this.records.set(id, structuredClone(value))
    return value
  }

  async recordSuccessfulLogin(userId: string, role: UserRole): Promise<UserWithProfile> {
    const value = this.records.get(userId)
    if (!value) throw new Error('Missing user')
    value.user.role = role
    value.user.lastLoginAt = new Date()
    value.user.lastActiveAt = new Date()
    value.user.updatedAt = new Date()
    return structuredClone(value)
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserWithProfile> {
    const value = this.records.get(userId)
    if (!value) throw new Error('Missing user')
    Object.assign(value.profile, input, { updatedAt: new Date() })
    value.user.profileCompleted = Boolean(
      value.profile.fullName && value.profile.displayName && value.profile.department,
    )
    value.user.updatedAt = new Date()
    return structuredClone(value)
  }

  setStatus(userId: string, status: UserRecord['status']): void {
    const value = this.records.get(userId)
    if (value) value.user.status = status
  }
}

export class InMemorySessionRepository implements SessionRepository {
  readonly sessions = new Map<string, SessionRecord>()

  async create(input: Omit<SessionRecord, 'createdAt' | 'updatedAt'>): Promise<SessionRecord> {
    const now = new Date()
    const value = { ...input, createdAt: now, updatedAt: now }
    this.sessions.set(value.id, structuredClone(value))
    return value
  }

  async findById(id: string): Promise<SessionRecord | null> {
    const value = this.sessions.get(id)
    return value ? structuredClone(value) : null
  }

  async rotate(
    id: string,
    refreshTokenHash: string,
    refreshJti: string,
    expiresAt: Date,
  ): Promise<void> {
    const value = this.sessions.get(id)
    if (!value) throw new Error('Missing session')
    value.refreshTokenHash = refreshTokenHash
    value.refreshJti = refreshJti
    value.expiresAt = expiresAt
    value.updatedAt = new Date()
  }

  async revoke(id: string, reason: string): Promise<void> {
    const value = this.sessions.get(id)
    if (value) {
      value.revokedAt = new Date()
      value.revokeReason = reason
    }
  }

  async revokeAllForUser(userId: string, reason: string): Promise<void> {
    for (const value of this.sessions.values()) {
      if (value.userId === userId && !value.revokedAt) {
        value.revokedAt = new Date()
        value.revokeReason = reason
      }
    }
  }
}
