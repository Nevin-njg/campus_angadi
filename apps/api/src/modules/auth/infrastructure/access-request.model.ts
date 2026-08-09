import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const accessRequestSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    affiliation: { type: String, required: true, trim: true },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      required: true,
      default: 'PENDING',
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote: { type: String, trim: true, default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
)

accessRequestSchema.index({ status: 1, createdAt: -1 })

type AccessRequestDocumentShape = InferSchemaType<typeof accessRequestSchema>
export const AccessRequestModel: Model<AccessRequestDocumentShape> =
  (mongoose.models.AccessRequest as Model<AccessRequestDocumentShape> | undefined) ??
  model<AccessRequestDocumentShape>('AccessRequest', accessRequestSchema)
