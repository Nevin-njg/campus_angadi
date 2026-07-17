import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const orderStatuses = [
  'PENDING',
  'WAITING_FOR_DEALER_ASSIGNMENT',
  'AWAITING_TEAM_CONFIRMATION',
  'CONTACTED',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
] as const

const orderSchema = new Schema(
  {
    checkoutGroupId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true, unique: true },
    buyerId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    sellerType: { type: String, enum: ['ADMIN', 'USER'], required: true },
    sellerId: { type: Schema.Types.ObjectId, default: null, ref: 'User' },
    status: { type: String, enum: orderStatuses, required: true, default: 'PENDING' },
    subtotal: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    itemCount: { type: Number, required: true, min: 1 },
    fullName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    campusId: { type: String, default: null, trim: true },
    department: { type: String, default: null, trim: true },
    building: { type: String, default: null, trim: true },
    pickupLocation: { type: String, required: true, trim: true },
    preferredPickupTime: { type: String, default: null, trim: true },
    notes: { type: String, default: null, trim: true },
    internalNotes: { type: String, default: null, trim: true },
    assignedDealerId: { type: Schema.Types.ObjectId, default: null, ref: 'Dealer' },
    assignedDealerName: { type: String, default: null },
    assignedDealerPhone: { type: String, default: null },
    dealerAssignedAt: { type: Date, default: null },
    dealerReleased: { type: Boolean, required: true, default: false },
    assignedModeratorId: { type: Schema.Types.ObjectId, default: null, ref: 'User' },
    assignedModeratorName: { type: String, default: null },
    moderatorAssignedAt: { type: Date, default: null },
    stockRestored: { type: Boolean, required: true, default: false },
    cancelledAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
)
orderSchema.index({ buyerId: 1, createdAt: -1 })
orderSchema.index({ sellerId: 1, createdAt: -1 })
orderSchema.index({ status: 1, createdAt: -1 })
orderSchema.index({ sellerType: 1, status: 1, createdAt: -1 })
orderSchema.index({ assignedDealerId: 1, status: 1, createdAt: -1 })
orderSchema.index({ assignedModeratorId: 1, status: 1, createdAt: -1 })

const orderItemSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, required: true, ref: 'Order' },
    productId: { type: Schema.Types.ObjectId, required: true, ref: 'Product' },
    productName: { type: String, required: true },
    productSlug: { type: String, required: true },
    productImageUrl: { type: String, default: null },
    sellerId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    productType: { type: String, enum: ['NEW', 'SECOND_HAND'], required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, versionKey: false },
)
orderItemSchema.index({ orderId: 1 })
orderItemSchema.index({ productId: 1, createdAt: -1 })

const orderStatusHistorySchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, required: true, ref: 'Order' },
    fromStatus: { type: String, enum: orderStatuses, default: null },
    toStatus: { type: String, enum: orderStatuses, required: true },
    note: { type: String, default: null },
    actorId: { type: Schema.Types.ObjectId, default: null, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
)
orderStatusHistorySchema.index({ orderId: 1, createdAt: 1 })

export type OrderDocumentShape = InferSchemaType<typeof orderSchema>
export type OrderItemDocumentShape = InferSchemaType<typeof orderItemSchema>
export type OrderStatusHistoryDocumentShape = InferSchemaType<typeof orderStatusHistorySchema>
export const OrderModel: Model<OrderDocumentShape> =
  (mongoose.models.Order as Model<OrderDocumentShape> | undefined) ??
  model<OrderDocumentShape>('Order', orderSchema)
export const OrderItemModel: Model<OrderItemDocumentShape> =
  (mongoose.models.OrderItem as Model<OrderItemDocumentShape> | undefined) ??
  model<OrderItemDocumentShape>('OrderItem', orderItemSchema)
export const OrderStatusHistoryModel: Model<OrderStatusHistoryDocumentShape> =
  (mongoose.models.OrderStatusHistory as Model<OrderStatusHistoryDocumentShape> | undefined) ??
  model<OrderStatusHistoryDocumentShape>('OrderStatusHistory', orderStatusHistorySchema)
