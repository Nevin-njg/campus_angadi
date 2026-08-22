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

const STORE_DAYS = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const

const storeOpeningHourSchema = new Schema(
  {
    day: { type: String, enum: STORE_DAYS, required: true },
    isOpen: { type: Boolean, default: true },
    openTime: { type: String, required: true, default: '00:00' },
    closeTime: { type: String, required: true, default: '23:59' },
  },
  { _id: false },
)

const defaultOpeningHours = () =>
  STORE_DAYS.map((day) => ({
    day,
    isOpen: true,
    openTime: '00:00',
    closeTime: '23:59',
  }))

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
    openingHours: { type: [storeOpeningHourSchema], default: defaultOpeningHours },
    manualOpenOverride: {
      type: String,
      enum: ['AUTO', 'OPEN', 'CLOSED'],
      default: 'AUTO',
    },
    categories: { type: [storeCategorySchema], default: [] },
  },
  { timestamps: true },
)
storeSchema.index({ name: 'text', slug: 1 })
storeSchema.index({ departmentId: 1, status: 1 })

export type StoreDocument = InferSchemaType<typeof storeSchema>
export const StoreModel = model('Store', storeSchema) as Model<StoreDocument>
