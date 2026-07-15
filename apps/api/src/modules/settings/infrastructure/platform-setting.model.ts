import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'
const schema = new Schema(
  {
    _id: { type: String, required: true, default: 'platform' },
    appName: { type: String, required: true },
    brandMark: { type: String, required: true },
    campusDisplayName: { type: String, required: true },
    supportEmail: { type: String, default: null },
    supportPhone: { type: String, default: null },
    defaultPickupLocations: { type: [String], default: [] },
    listingExpirationDays: { type: Number, required: true, default: 30 },
    maxActiveListingsPerUser: { type: Number, required: true, default: 20 },
    termsUrl: { type: String, default: null },
    privacyUrl: { type: String, default: null },
    allowNewListings: { type: Boolean, required: true, default: true },
    allowOrders: { type: Boolean, required: true, default: true },
    maintenanceMessage: { type: String, default: null },
    whatsappMessageTemplate: {
      type: String,
      required: true,
      default: 'Hello, I would like to confirm order {{orderNumber}}.',
    },
  },
  { timestamps: true, versionKey: false },
)
export type PlatformSettingDocumentShape = InferSchemaType<typeof schema>
export const PlatformSettingModel: Model<PlatformSettingDocumentShape> =
  (mongoose.models.PlatformSetting as Model<PlatformSettingDocumentShape> | undefined) ??
  model<PlatformSettingDocumentShape>('PlatformSetting', schema)
