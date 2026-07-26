import type {
  AuthUser,
  UpdateProfileInput,
  UserProfile,
  UserRole,
  UserStatus,
} from '@campusbaza/contracts'

export interface UserRecord {
  id: string
  email: string
  emailVerified: boolean
  role: UserRole
  status: UserStatus
  canSell: boolean
  canMediateOrders: boolean
  profileCompleted: boolean
  createdAt: Date
  updatedAt: Date
  lastLoginAt: Date | null
  lastActiveAt: Date | null
}

export interface ProfileRecord extends UserProfile {
  userId: string
  createdAt: Date
  updatedAt: Date
}

export interface UserWithProfile {
  user: UserRecord
  profile: ProfileRecord
}

export interface UserRepository {
  findById(id: string): Promise<UserWithProfile | null>
  findByEmail(email: string): Promise<UserWithProfile | null>
  findOrCreateByEmail(email: string, role: UserRole): Promise<UserWithProfile>
  recordSuccessfulLogin(userId: string, role: UserRole): Promise<UserWithProfile>
  updateProfile(userId: string, input: UpdateProfileInput): Promise<UserWithProfile>
}

export function toAuthUser(value: UserWithProfile): AuthUser {
  return {
    id: value.user.id,
    email: value.user.email,
    emailVerified: value.user.emailVerified,
    role: value.user.role,
    status: value.user.status,
    canSell: value.user.canSell,
    canMediateOrders: value.user.canMediateOrders,
    profileCompleted: value.user.profileCompleted,
    profile: {
      fullName: value.profile.fullName,
      displayName: value.profile.displayName,
      profileImageUrl: value.profile.profileImageUrl,
      phoneNumber: value.profile.phoneNumber,
      department: value.profile.department,
      graduationYear: value.profile.graduationYear,
      campusRole: value.profile.campusRole,
      preferredPickupLocation: value.profile.preferredPickupLocation,
      bio: value.profile.bio,
    },
    createdAt: value.user.createdAt.toISOString(),
    lastLoginAt: value.user.lastLoginAt?.toISOString() ?? null,
  }
}
