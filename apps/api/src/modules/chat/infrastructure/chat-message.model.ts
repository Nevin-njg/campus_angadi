import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const chatMessageSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, required: true, ref: 'Order' },
    senderId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    senderKind: { type: String, enum: ['BUYER', 'TEAM'], required: true },
    senderName: { type: String, required: true, trim: true },
    type: { type: String, enum: ['TEXT', 'AUDIO', 'SYSTEM'], required: true },
    text: { type: String, default: null, trim: true },
    audioUrl: { type: String, default: null },
    audioPublicId: { type: String, default: null },
    audioDurationSeconds: { type: Number, default: null, min: 0, max: 300 },
    clientId: { type: String, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
)

chatMessageSchema.index({ orderId: 1, createdAt: -1 })
chatMessageSchema.index(
  { orderId: 1, senderId: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } },
)

export type ChatMessageDocumentShape = InferSchemaType<typeof chatMessageSchema>
export const ChatMessageModel: Model<ChatMessageDocumentShape> =
  (mongoose.models.ChatMessage as Model<ChatMessageDocumentShape> | undefined) ??
  model<ChatMessageDocumentShape>('ChatMessage', chatMessageSchema)
