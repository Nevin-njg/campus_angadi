import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'
const reportSchema = new Schema(
  {
    reporterId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    targetType: { type: String, enum: ['PRODUCT', 'USER'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    type: {
      type: String,
      enum: [
        'MISLEADING_PRODUCT',
        'PROHIBITED_ITEM',
        'FRAUD',
        'DUPLICATE_LISTING',
        'INAPPROPRIATE_CONTENT',
        'INCORRECT_CONDITION',
        'SELLER_ISSUE',
        'OTHER',
      ],
      required: true,
    },
    description: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'],
      required: true,
      default: 'OPEN',
      index: true,
    },
    assignedAdminId: { type: Schema.Types.ObjectId, default: null, ref: 'User' },
    resolution: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
)
reportSchema.index({ status: 1, createdAt: -1 })
reportSchema.index({ targetType: 1, targetId: 1, reporterId: 1, status: 1 })
export type ReportDocumentShape = InferSchemaType<typeof reportSchema>
export const ReportModel: Model<ReportDocumentShape> =
  (mongoose.models.Report as Model<ReportDocumentShape> | undefined) ??
  model<ReportDocumentShape>('Report', reportSchema)
