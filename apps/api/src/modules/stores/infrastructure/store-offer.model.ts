import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const storeOfferSchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, required: true, ref: 'Store', index: true },
    sellerId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    productId: { type: Schema.Types.ObjectId, required: true, ref: 'Product', index: true },
    discountType: {
      type: String,
      enum: ['PERCENTAGE', 'FLAT'],
      required: true,
    },
    discountValue: { type: Number, required: true, min: 0 },
    basePrice: { type: Number, required: true, min: 0 },
    discountedPrice: { type: Number, required: true, min: 0 },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['SCHEDULED', 'ACTIVE', 'EXPIRED'],
      required: true,
      index: true,
    },
    isCurrent: { type: Boolean, required: true, default: true, index: true },
  },
  { timestamps: true, versionKey: false },
)

storeOfferSchema.index({ storeId: 1, createdAt: -1 })
storeOfferSchema.index({ storeId: 1, status: 1, startsAt: 1, endsAt: 1 })
storeOfferSchema.index(
  { productId: 1 },
  {
    unique: true,
    partialFilterExpression: { isCurrent: true },
    name: 'one_current_store_offer_per_product',
  },
)

export type StoreOfferDocumentShape = InferSchemaType<typeof storeOfferSchema>

export const StoreOfferModel: Model<StoreOfferDocumentShape> =
  (mongoose.models.StoreOffer as Model<StoreOfferDocumentShape> | undefined) ??
  model<StoreOfferDocumentShape>('StoreOffer', storeOfferSchema)
