import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const uploadAssetSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    provider: { type: String, enum: ['CLOUDINARY'], required: true, default: 'CLOUDINARY' },
    publicId: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
    bytes: { type: Number, required: true, min: 0 },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    status: {
      type: String,
      enum: ['TEMPORARY', 'ATTACHED', 'DELETED'],
      required: true,
      default: 'TEMPORARY',
    },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
)
uploadAssetSchema.index({ ownerId: 1, status: 1, createdAt: -1 })
uploadAssetSchema.index({ productId: 1, status: 1 })
uploadAssetSchema.index({ status: 1, deletedAt: 1, createdAt: 1 })

export type UploadAssetDocumentShape = InferSchemaType<typeof uploadAssetSchema>
export const UploadAssetModel: Model<UploadAssetDocumentShape> =
  (mongoose.models.UploadAsset as Model<UploadAssetDocumentShape> | undefined) ??
  model<UploadAssetDocumentShape>('UploadAsset', uploadAssetSchema)
