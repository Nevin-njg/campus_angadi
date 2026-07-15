import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const cartItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, required: true, ref: 'Product' },
    quantity: { type: Number, required: true, min: 1, max: 20 },
    priceAtAddition: { type: Number, required: true, min: 0 },
  },
  { _id: false },
)

const cartSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true, ref: 'User' },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
)
cartSchema.index({ 'items.productId': 1 })

export type CartDocumentShape = InferSchemaType<typeof cartSchema>
export const CartModel: Model<CartDocumentShape> =
  (mongoose.models.Cart as Model<CartDocumentShape> | undefined) ??
  model<CartDocumentShape>('Cart', cartSchema)
