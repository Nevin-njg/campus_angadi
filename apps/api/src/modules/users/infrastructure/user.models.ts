import mongoose from 'mongoose'

const { Schema } = mongoose

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    emailVerified: {
      type: Boolean,
      required: true,
      default: true,
    },
    role: {
      type: String,
      enum: ['USER', 'ADMIN', 'SUPER_ADMIN'],
      required: true,
      default: 'USER',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'BLOCKED', 'DELETED'],
      required: true,
      default: 'ACTIVE',
    },
    canSell: {
      type: Boolean,
      required: true,
      default: true,
    },
    profileCompleted: {
      type: Boolean,
      required: true,
      default: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    lastActiveAt: {
      type: Date,
      default: null,
    },
    internalNotes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

userSchema.index({ status: 1, role: 1 })
userSchema.index({ lastActiveAt: -1 })

const profileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      ref: 'User',
    },
    fullName: {
      type: String,
      trim: true,
      default: null,
    },
    displayName: {
      type: String,
      trim: true,
      default: null,
    },
    profileImageUrl: {
      type: String,
      default: null,
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: null,
    },
    department: {
      type: String,
      trim: true,
      default: null,
    },
    graduationYear: {
      type: Number,
      default: null,
    },
    campusRole: {
      type: String,
      trim: true,
      default: null,
    },
    preferredPickupLocation: {
      type: String,
      trim: true,
      default: null,
    },
    bio: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

export type UserDocumentShape =
  mongoose.InferSchemaType<typeof userSchema>

export type ProfileDocumentShape =
  mongoose.InferSchemaType<typeof profileSchema>

export const UserModel: mongoose.Model<UserDocumentShape> =
  (mongoose.models.User as
    | mongoose.Model<UserDocumentShape>
    | undefined) ??
  mongoose.model<UserDocumentShape>('User', userSchema)

export const UserProfileModel: mongoose.Model<ProfileDocumentShape> =
  (mongoose.models.UserProfile as
    | mongoose.Model<ProfileDocumentShape>
    | undefined) ??
  mongoose.model<ProfileDocumentShape>(
    'UserProfile',
    profileSchema,
  )