import type { NextFunction, Request, Response } from 'express'
import type { UserRole } from '@campusbaza/contracts'
import type { TokenService } from '../security/token-service.js'
import { AppError } from '../errors/app-error.js'
import type { UserRepository } from '../../modules/users/domain/user.js'
import { toAuthUser } from '../../modules/users/domain/user.js'

export function createAuthenticateMiddleware(tokens: TokenService, users: UserRepository) {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    try {
      const authorization = request.header('authorization')
      if (!authorization?.startsWith('Bearer ')) {
        throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.')
      }
      const payload = tokens.verifyAccessToken(authorization.slice(7))
      const value = await users.findById(payload.sub)
      if (!value || value.user.status !== 'ACTIVE') {
        throw new AppError(403, 'ACCOUNT_NOT_ACTIVE', 'This account is not currently active.')
      }
      request.auth = { user: toAuthUser(value) }
      next()
    } catch (error) {
      next(error)
    }
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const user = request.auth?.user
    if (!user) {
      next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.'))
      return
    }
    if (!roles.includes(user.role)) {
      next(
        new AppError(
          403,
          'INSUFFICIENT_PERMISSION',
          'You do not have permission to perform this action.',
        ),
      )
      return
    }
    next()
  }
}
