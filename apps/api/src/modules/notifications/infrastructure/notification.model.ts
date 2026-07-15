import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    type: {
      type: String,
      enum: ['SYSTEM', 'PRODUCT', 'ORDER', 'ACCOUNT', 'REPORT'],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    referenceType: { type: String, default: null, trim: true },
    referenceId: { type: String, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
)
notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 })
notificationSchema.index({ readAt: 1 })

export type NotificationDocumentShape = InferSchemaType<typeof notificationSchema>
export const NotificationModel: Model<NotificationDocumentShape> =
  (mongoose.models.Notification as Model<NotificationDocumentShape> | undefined) ??
  model<NotificationDocumentShape>('Notification', notificationSchema)
