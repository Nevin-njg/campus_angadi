import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const moderationHistorySchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, required: true, ref: 'Product' },
    action: {
      type: String,
      enum: [
        'SUBMITTED',
        'RESUBMITTED',
        'APPROVED',
        'REJECTED',
        'CHANGES_REQUESTED',
        'HIDDEN',
        'RESTORED',
        'MARKED_SOLD',
        'DELETED',
      ],
      required: true,
    },
    fromStatus: { type: String, default: null },
    toStatus: { type: String, required: true },
    reason: { type: String, trim: true, default: null },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
)
moderationHistorySchema.index({ productId: 1, createdAt: -1 })
moderationHistorySchema.index({ actorId: 1, createdAt: -1 })

export type ModerationHistoryDocumentShape = InferSchemaType<typeof moderationHistorySchema>
export const ModerationHistoryModel: Model<ModerationHistoryDocumentShape> =
  (mongoose.models.ModerationHistory as Model<ModerationHistoryDocumentShape> | undefined) ??
  model<ModerationHistoryDocumentShape>('ModerationHistory', moderationHistorySchema)
