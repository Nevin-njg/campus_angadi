import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const productSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, required: true, trim: true },
    categoryId: { type: Schema.Types.ObjectId, required: true, ref: 'Category' },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, default: null, min: 0 },
    stock: { type: Number, required: true, min: 0 },
    condition: {
      type: String,
      enum: ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'USED', 'OPEN_BOX'],
      required: true,
    },
    productType: { type: String, enum: ['NEW', 'SECOND_HAND'], required: true },
    sellerType: { type: String, enum: ['ADMIN', 'USER'], required: true },
    sellerId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'PENDING_APPROVAL',
        'CHANGES_REQUESTED',
        'APPROVED',
        'REJECTED',
        'HIDDEN',
        'SOLD',
        'OUT_OF_STOCK',
        'DELETED',
      ],
      required: true,
    },
    published: { type: Boolean, required: true, default: true },
    pickupLocation: { type: String, trim: true, default: null },
    tags: { type: [String], default: [] },
    productAge: { type: String, trim: true, default: null },
    reasonForSelling: { type: String, trim: true, default: null },
    additionalDetails: { type: String, trim: true, default: null },
    moderationMessage: { type: String, trim: true, default: null },
    submittedAt: { type: Date, default: null },
    isFeatured: { type: Boolean, required: true, default: false },
    viewCount: { type: Number, required: true, default: 0, min: 0 },
    completedOrderCount: { type: Number, required: true, default: 0, min: 0 },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, default: null, ref: 'User' },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, default: null, ref: 'User' },
  },
  { timestamps: true, versionKey: false },
)
productSchema.index({ status: 1, published: 1, productType: 1, createdAt: -1 })
productSchema.index({ categoryId: 1, status: 1, published: 1, price: 1 })
productSchema.index({ isFeatured: -1, completedOrderCount: -1, viewCount: -1, createdAt: -1 })
productSchema.index({ sellerId: 1, createdAt: -1 })
productSchema.index({ title: 'text', description: 'text', tags: 'text' })
productSchema.index({ sellerType: 1, status: 1, published: 1, deletedAt: 1, approvedAt: 1 })

const productImageSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, required: true, ref: 'Product' },
    url: { type: String, required: true },
    altText: { type: String, required: true, trim: true, default: '' },
    displayOrder: { type: Number, required: true, min: 0, default: 0 },
    isPrimary: { type: Boolean, required: true, default: false },
    storageKey: { type: String, default: null },
    mimeType: { type: String, default: null },
    bytes: { type: Number, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
  },
  { timestamps: true, versionKey: false },
)
productImageSchema.index({ productId: 1, displayOrder: 1 })
productImageSchema.index({ productId: 1, isPrimary: 1 })

export type ProductDocumentShape = InferSchemaType<typeof productSchema>
export type ProductImageDocumentShape = InferSchemaType<typeof productImageSchema>
export const ProductModel: Model<ProductDocumentShape> =
  (mongoose.models.Product as Model<ProductDocumentShape> | undefined) ??
  model<ProductDocumentShape>('Product', productSchema)
export const ProductImageModel: Model<ProductImageDocumentShape> =
  (mongoose.models.ProductImage as Model<ProductImageDocumentShape> | undefined) ??
  model<ProductImageDocumentShape>('ProductImage', productImageSchema)
