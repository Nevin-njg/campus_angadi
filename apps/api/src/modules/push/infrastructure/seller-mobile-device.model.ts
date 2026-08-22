import mongoose, {
  Schema,
  model,
  type InferSchemaType,
  type Model,
} from 'mongoose'

const sellerMobileDeviceSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    deviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 128,
    },

    expoPushToken: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 512,
    },

    deviceName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    platform: {
      type: String,
      enum: ['android', 'ios'],
      required: true,
    },

    pushEnabled: {
      type: Boolean,
      default: true,
      required: true,
    },

    lastActiveAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    lastPushAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

sellerMobileDeviceSchema.index({ userId: 1, lastActiveAt: -1 })
sellerMobileDeviceSchema.index({ userId: 1, pushEnabled: 1 })

export type SellerMobileDeviceDocumentShape =
  InferSchemaType<typeof sellerMobileDeviceSchema>

export const SellerMobileDeviceModel: Model<SellerMobileDeviceDocumentShape> =
  (mongoose.models.SellerMobileDevice as
    | Model<SellerMobileDeviceDocumentShape>
    | undefined) ??
  model<SellerMobileDeviceDocumentShape>(
    'SellerMobileDevice',
    sellerMobileDeviceSchema,
  )
