import mongoose, {
  Schema,
  model,
  type InferSchemaType,
  type Model,
} from 'mongoose'

const storeDepartmentSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },

    cardTheme: {
      type: String,
      enum: [
        'FOOD',
        'SPORTS',
        'STATIONERY',
        'ELECTRONICS',
        'GROCERY',
        'FASHION',
        'CUSTOM',
        'GENERAL',
      ],
      default: 'GENERAL',
      required: true,
    },
    customBackgroundStart: {
      type: String,
      trim: true,
      default: null,
      maxlength: 7,
    },

    customBackgroundEnd: {
      type: String,
      trim: true,
      default: null,
      maxlength: 7,
    },

    customStickers: {
      type: [String],
      default: [],
      validate: {
        validator(value: string[]) {
          return value.length <= 5
        },
        message: 'A department card can have at most 5 stickers.',
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    displayOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
)

storeDepartmentSchema.index({
  isActive: 1,
  displayOrder: 1,
  name: 1,
})

export type StoreDepartmentDocumentShape =
  InferSchemaType<typeof storeDepartmentSchema>

export const StoreDepartmentModel: Model<StoreDepartmentDocumentShape> =
  (mongoose.models.StoreDepartment as
    | Model<StoreDepartmentDocumentShape>
    | undefined) ??
  model<StoreDepartmentDocumentShape>(
    'StoreDepartment',
    storeDepartmentSchema,
  )
