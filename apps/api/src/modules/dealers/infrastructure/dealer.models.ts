import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const workingHoursSchema = new Schema(
  {
    mediatorUserId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    mediatorEmail: { type: String, required: true, trim: true, lowercase: true },
    timeZone: { type: String, required: true, default: 'Asia/Kolkata' },
    startTime: { type: String, required: true, default: '00:00' },
    endTime: { type: String, required: true, default: '23:59' },
    days: { type: [Number], required: true, default: [0, 1, 2, 3, 4, 5, 6] },
  },
  { _id: false },
)

const dealerSchema = new Schema(
  {
    displayName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    isActive: { type: Boolean, required: true, default: true },
    maxOpenOrders: { type: Number, required: true, min: 1, default: 10 },
    currentOpenOrders: { type: Number, required: true, min: 0, default: 0 },
    completedOrders: { type: Number, required: true, min: 0, default: 0 },
    lastAssignedAt: { type: Date, default: null },
    workingHours: { type: workingHoursSchema, required: true, default: () => ({}) },
    notes: { type: String, default: null, trim: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
)
dealerSchema.index({ phoneNumber: 1 }, { unique: true })
dealerSchema.index({ mediatorUserId: 1 }, { unique: true, sparse: true })
dealerSchema.index({ isActive: 1, deletedAt: 1, currentOpenOrders: 1, lastAssignedAt: 1 })

const dealerAssignmentHistorySchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, required: true, ref: 'Order' },
    previousDealerId: { type: Schema.Types.ObjectId, default: null, ref: 'Dealer' },
    previousDealerName: { type: String, default: null },
    previousDealerPhone: { type: String, default: null },
    newDealerId: { type: Schema.Types.ObjectId, default: null, ref: 'Dealer' },
    newDealerName: { type: String, default: null },
    newDealerPhone: { type: String, default: null },
    reason: { type: String, required: true },
    mode: { type: String, enum: ['AUTO', 'MANUAL'], required: true },
    actorId: { type: Schema.Types.ObjectId, default: null, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
)
dealerAssignmentHistorySchema.index({ orderId: 1, createdAt: 1 })
dealerAssignmentHistorySchema.index({ newDealerId: 1, createdAt: -1 })

export type DealerDocumentShape = InferSchemaType<typeof dealerSchema>
export type DealerAssignmentHistoryDocumentShape = InferSchemaType<
  typeof dealerAssignmentHistorySchema
>
export const DealerModel: Model<DealerDocumentShape> =
  (mongoose.models.Dealer as Model<DealerDocumentShape> | undefined) ??
  model<DealerDocumentShape>('Dealer', dealerSchema)
export const DealerAssignmentHistoryModel: Model<DealerAssignmentHistoryDocumentShape> =
  (mongoose.models.DealerAssignmentHistory as
    Model<DealerAssignmentHistoryDocumentShape> | undefined) ??
  model<DealerAssignmentHistoryDocumentShape>(
    'DealerAssignmentHistory',
    dealerAssignmentHistorySchema,
  )
