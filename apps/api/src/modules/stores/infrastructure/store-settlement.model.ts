import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const storeSettlementSchema = new Schema(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Store',
      index: true,
    },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    grossSales: { type: Number, required: true, min: 0 },
    completedOrderCount: { type: Number, required: true, min: 0 },
    commissionPercent: { type: Number, required: true, min: 0, max: 100 },
    commissionAmount: { type: Number, required: true, min: 0 },
    payableToStore: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['SETTLED'],
      required: true,
      default: 'SETTLED',
    },
    settledAt: { type: Date, required: true },
    settledBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
)

storeSettlementSchema.index({ storeId: 1, month: 1 }, { unique: true })

export type StoreSettlementDocumentShape = InferSchemaType<typeof storeSettlementSchema>
export const StoreSettlementModel: Model<StoreSettlementDocumentShape> =
  (mongoose.models.StoreSettlement as Model<StoreSettlementDocumentShape> | undefined) ??
  model<StoreSettlementDocumentShape>('StoreSettlement', storeSettlementSchema)
