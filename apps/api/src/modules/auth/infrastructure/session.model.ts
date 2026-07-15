import mongoose from 'mongoose'

const { Schema } = mongoose

const sessionSchema = new Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    refreshTokenHash: {
      type: String,
      required: true,
    },
    refreshJti: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokeReason: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

sessionSchema.index({ userId: 1, revokedAt: 1 })
sessionSchema.index({ revokedAt: 1 })
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export type SessionDocumentShape =
  mongoose.InferSchemaType<typeof sessionSchema>

export const SessionModel: mongoose.Model<SessionDocumentShape> =
  (mongoose.models.Session as
    | mongoose.Model<SessionDocumentShape>
    | undefined) ??
  mongoose.model<SessionDocumentShape>('Session', sessionSchema)