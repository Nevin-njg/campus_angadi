import { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const storeCategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, default: null, trim: true },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: true, timestamps: true },
)

const storeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, default: null, trim: true },
    logoUrl: { type: String, default: null },
    bannerUrl: { type: String, default: null },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'StoreDepartment',
      default: null,
    },
    commissionPercent: { type: Number, required: true, min: 0, max: 100 },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED', 'ARCHIVED'], default: 'ACTIVE' },
    campusLocation: { type: String, default: null, trim: true },
    deliveryTimeMinutes: { type: Number, default: 30, min: 1 },
    minimumOrderAmount: { type: Number, default: 0, min: 0 },
    categories: { type: [storeCategorySchema], default: [] },
  },
  { timestamps: true },
)
storeSchema.index({ name: 'text', slug: 1 })
storeSchema.index({ departmentId: 1, status: 1 })

export type StoreDocument = InferSchemaType<typeof storeSchema>
export const StoreModel = model('Store', storeSchema) as Model<StoreDocument>
