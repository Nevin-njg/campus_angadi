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

const homepageSectionSchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        'FEATURED_PRODUCTS',
        'POPULAR_PRODUCTS',
        'STORE_CATEGORY',
        'SECOND_HAND_PRODUCTS',
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    enabled: {
      type: Boolean,
      default: true,
    },

    displayOrder: {
      type: Number,
      required: true,
      min: 0,
      max: 999,
      default: 0,
    },

    limit: {
      type: Number,
      required: true,
      min: 1,
      max: 48,
      default: 8,
    },

    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'StoreDepartment',
      default: null,
    },

    productIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],

    storeIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Store',
      },
    ],

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

homepageSectionSchema.index({
  enabled: 1,
  displayOrder: 1,
  createdAt: 1,
})

homepageSectionSchema.index({
  type: 1,
  departmentId: 1,
})

export type HomepageSectionDocumentShape =
  InferSchemaType<typeof homepageSectionSchema>

export const HomepageSectionModel: Model<HomepageSectionDocumentShape> =
  (mongoose.models.HomepageSection as
    | Model<HomepageSectionDocumentShape>
    | undefined) ??
  model<HomepageSectionDocumentShape>(
    'HomepageSection',
    homepageSectionSchema,
  )
