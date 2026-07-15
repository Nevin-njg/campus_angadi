import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'
const schema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    actorLabel: { type: String, required: true },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, default: null },
    requestMethod: { type: String, required: true },
    requestPath: { type: String, required: true },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
)
schema.index({ createdAt: -1 })
schema.index({ entityType: 1, createdAt: -1 })
export type AuditLogDocumentShape = InferSchemaType<typeof schema>
export const AuditLogModel: Model<AuditLogDocumentShape> =
  (mongoose.models.AuditLog as Model<AuditLogDocumentShape> | undefined) ??
  model<AuditLogDocumentShape>('AuditLog', schema)
