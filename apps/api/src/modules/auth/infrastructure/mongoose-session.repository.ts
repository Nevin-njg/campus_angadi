import type { SessionRecord, SessionRepository } from '../domain/session.js'
import { SessionModel } from './session.model.js'

function mapSession(document: Record<string, unknown>): SessionRecord {
  return {
    id: String(document._id),
    userId: String(document.userId),
    refreshTokenHash: String(document.refreshTokenHash),
    refreshJti: String(document.refreshJti),
    expiresAt: document.expiresAt as Date,
    revokedAt: (document.revokedAt as Date | null) ?? null,
    revokeReason: (document.revokeReason as string | null) ?? null,
    ipAddress: (document.ipAddress as string | null) ?? null,
    userAgent: (document.userAgent as string | null) ?? null,
    createdAt: document.createdAt as Date,
    updatedAt: document.updatedAt as Date,
  }
}

export class MongooseSessionRepository implements SessionRepository {
  async create(input: Omit<SessionRecord, 'createdAt' | 'updatedAt'>): Promise<SessionRecord> {
    const document = await SessionModel.create({ ...input, _id: input.id })
    return mapSession(document.toObject())
  }

  async findById(id: string): Promise<SessionRecord | null> {
    const document = await SessionModel.findById(id).lean<Record<string, unknown>>()
    return document ? mapSession(document) : null
  }

  async rotate(
    id: string,
    expectedRefreshTokenHash: string,
    expectedRefreshJti: string,
    refreshTokenHash: string,
    refreshJti: string,
    expiresAt: Date,
  ): Promise<boolean> {
    const result = await SessionModel.updateOne(
      {
        _id: id,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
        refreshTokenHash: expectedRefreshTokenHash,
        refreshJti: expectedRefreshJti,
      },
      { $set: { refreshTokenHash, refreshJti, expiresAt } },
    )

    return result.modifiedCount === 1
  }

  async revoke(id: string, reason: string): Promise<void> {
    await SessionModel.updateOne(
      { _id: id, revokedAt: null },
      { $set: { revokedAt: new Date(), revokeReason: reason } },
    )
  }

  async revokeAllForUser(userId: string, reason: string): Promise<void> {
    await SessionModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokeReason: reason } },
    )
  }
}
