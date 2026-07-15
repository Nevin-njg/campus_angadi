import type { AuthUser, UpdateProfileInput } from '@campusbaza/contracts'
import { AppError } from '../../../core/errors/app-error.js'
import type { UserRepository } from '../domain/user.js'
import { toAuthUser } from '../domain/user.js'

export class ProfileService {
  constructor(private readonly users: UserRepository) {}

  async getProfile(userId: string): Promise<AuthUser> {
    const value = await this.users.findById(userId)
    if (!value || value.user.status === 'DELETED') {
      throw new AppError(404, 'USER_NOT_FOUND', 'The user account could not be found.')
    }
    return toAuthUser(value)
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUser> {
    const current = await this.users.findById(userId)
    if (!current || current.user.status !== 'ACTIVE') {
      throw new AppError(403, 'ACCOUNT_NOT_ACTIVE', 'This account cannot be updated.')
    }
    return toAuthUser(await this.users.updateProfile(userId, input))
  }
}
