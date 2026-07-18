import type { UpdateProfileInput, UserRole } from '@campusbaza/contracts'
import type { ProfileRecord, UserRecord, UserRepository, UserWithProfile } from '../domain/user.js'
import { UserModel, UserProfileModel } from './user.models.js'

function mapUser(document: Record<string, unknown>): UserRecord {
  return {
    id: String(document._id),
    email: String(document.email),
    emailVerified: Boolean(document.emailVerified),
    role: document.role as UserRecord['role'],
    status: document.status as UserRecord['status'],
    canSell: Boolean(document.canSell),
    canMediateOrders: Boolean(document.canMediateOrders) || document.role === 'MODERATOR',
    profileCompleted: Boolean(document.profileCompleted),
    createdAt: document.createdAt as Date,
    updatedAt: document.updatedAt as Date,
    lastLoginAt: (document.lastLoginAt as Date | null) ?? null,
    lastActiveAt: (document.lastActiveAt as Date | null) ?? null,
  }
}

function mapProfile(document: Record<string, unknown>): ProfileRecord {
  return {
    userId: String(document.userId),
    fullName: (document.fullName as string | null) ?? null,
    displayName: (document.displayName as string | null) ?? null,
    profileImageUrl: (document.profileImageUrl as string | null) ?? null,
    phoneNumber: (document.phoneNumber as string | null) ?? null,
    department: (document.department as string | null) ?? null,
    graduationYear: (document.graduationYear as number | null) ?? null,
    campusRole: (document.campusRole as string | null) ?? null,
    preferredPickupLocation: (document.preferredPickupLocation as string | null) ?? null,
    bio: (document.bio as string | null) ?? null,
    createdAt: document.createdAt as Date,
    updatedAt: document.updatedAt as Date,
  }
}

export class MongooseUserRepository implements UserRepository {
  async findById(id: string): Promise<UserWithProfile | null> {
    const user = await UserModel.findById(id).lean<Record<string, unknown>>()
    if (!user) return null
    const profile = await this.ensureProfile(user._id)
    return { user: mapUser(user), profile: mapProfile(profile) }
  }

  async findByEmail(email: string): Promise<UserWithProfile | null> {
    const user = await UserModel.findOne({ email }).lean<Record<string, unknown>>()
    if (!user) return null
    const profile = await this.ensureProfile(user._id)
    return { user: mapUser(user), profile: mapProfile(profile) }
  }

  async findOrCreateByEmail(email: string, role: UserRole): Promise<UserWithProfile> {
    const now = new Date()
    const user = await UserModel.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          email,
          emailVerified: true,
          status: 'ACTIVE',
          canSell: true,
          canMediateOrders: role === 'MODERATOR',
          profileCompleted: false,
          createdAt: now,
        },
        $set: { role },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean<Record<string, unknown>>()

    if (!user) throw new Error('Unable to provision user')
    const profile = await this.ensureProfile(user._id)
    return { user: mapUser(user), profile: mapProfile(profile) }
  }

  async recordSuccessfulLogin(userId: string, role: UserRole): Promise<UserWithProfile> {
    const now = new Date()
    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          emailVerified: true,
          lastLoginAt: now,
          lastActiveAt: now,
          role,
          ...(role === 'MODERATOR' ? { canMediateOrders: true } : {}),
        },
      },
      { new: true },
    ).lean<Record<string, unknown>>()
    if (!user) throw new Error('User no longer exists')
    const profile = await this.ensureProfile(user._id)
    return { user: mapUser(user), profile: mapProfile(profile) }
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserWithProfile> {
    await UserProfileModel.findOneAndUpdate(
      { userId },
      { $set: input, $setOnInsert: { userId } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    const profile = await UserProfileModel.findOne({ userId }).lean<Record<string, unknown>>()
    if (!profile) throw new Error('Unable to update profile')
    const profileCompleted = Boolean(profile.fullName && profile.displayName && profile.department)
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { profileCompleted, lastActiveAt: new Date() } },
      { new: true },
    ).lean<Record<string, unknown>>()
    if (!user) throw new Error('User no longer exists')
    return { user: mapUser(user), profile: mapProfile(profile) }
  }

  private async ensureProfile(userId: unknown): Promise<Record<string, unknown>> {
    const profile = await UserProfileModel.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean<Record<string, unknown>>()
    if (!profile) throw new Error('Unable to provision user profile')
    return profile
  }
}
