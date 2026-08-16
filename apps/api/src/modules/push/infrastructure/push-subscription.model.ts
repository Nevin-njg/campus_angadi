import mongoose, {
  Schema,
  model,
  type InferSchemaType,
  type Model,
} from 'mongoose'

const pushSubscriptionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    endpoint: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    expirationTime: {
      type: Number,
      default: null,
    },

    keys: {
      p256dh: {
        type: String,
        required: true,
      },
      auth: {
        type: String,
        required: true,
      },
    },

    userAgent: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
)

pushSubscriptionSchema.index({ userId: 1, createdAt: -1 })

export type PushSubscriptionDocumentShape =
  InferSchemaType<typeof pushSubscriptionSchema>

export const PushSubscriptionModel: Model<PushSubscriptionDocumentShape> =
  (mongoose.models.PushSubscription as
    | Model<PushSubscriptionDocumentShape>
    | undefined) ??
  model<PushSubscriptionDocumentShape>(
    'PushSubscription',
    pushSubscriptionSchema,
  )
