export interface SessionRecord {
  id: string
  userId: string
  refreshTokenHash: string
  refreshJti: string
  expiresAt: Date
  revokedAt: Date | null
  revokeReason: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
  updatedAt: Date
}

export interface SessionRepository {
  create(input: Omit<SessionRecord, 'createdAt' | 'updatedAt'>): Promise<SessionRecord>
  findById(id: string): Promise<SessionRecord | null>
  rotate(id: string, refreshTokenHash: string, refreshJti: string, expiresAt: Date): Promise<void>
  revoke(id: string, reason: string): Promise<void>
  revokeAllForUser(userId: string, reason: string): Promise<void>
}
