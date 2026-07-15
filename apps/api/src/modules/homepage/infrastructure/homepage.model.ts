import mongoose, { Schema, model, type InferSchemaType, type Model } from 'mongoose'

const homepageSelectionSchema = new Schema(
  {
    key: {
      type: String,
      enum: ['FEATURED', 'OFFICIAL', 'SECOND_HAND', 'RECENT'],
      required: true,
      unique: true,
    },
    productIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
)

export type HomepageSelectionDocumentShape = InferSchemaType<typeof homepageSelectionSchema>
export const HomepageSelectionModel: Model<HomepageSelectionDocumentShape> =
  (mongoose.models.HomepageSelection as Model<HomepageSelectionDocumentShape> | undefined) ??
  model<HomepageSelectionDocumentShape>('HomepageSelection', homepageSelectionSchema)
