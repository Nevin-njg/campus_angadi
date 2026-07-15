import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, trim: true, default: null },
    imageUrl: { type: String, default: null },
    isActive: { type: Boolean, required: true, default: true },
    displayOrder: { type: Number, required: true, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
)
categorySchema.index({ isActive: 1, displayOrder: 1, name: 1 })
categorySchema.index({ deletedAt: 1 })

export type CategoryDocumentShape = InferSchemaType<typeof categorySchema>
export const CategoryModel: Model<CategoryDocumentShape> =
  (mongoose.models.Category as Model<CategoryDocumentShape> | undefined) ??
  model<CategoryDocumentShape>('Category', categorySchema)
