import { randomUUID } from 'node:crypto'
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken'

type JwtExpiresIn = NonNullable<SignOptions['expiresIn']>
import type { UserRole } from '@campusbaza/contracts'
import { AppError } from '../errors/app-error.js'
import { durationToSeconds } from './duration.js'

interface AccessPayload extends JwtPayload {
  sub: string
  role: UserRole
  type: 'access'
}

interface RefreshPayload extends JwtPayload {
  sub: string
  sid: string
  jti: string
  type: 'refresh'
}

export interface TokenPairData {
  accessToken: string
  refreshToken: string
  refreshJti: string
  refreshExpiresAt: Date
}

export class TokenService {
  constructor(
    private readonly accessSecret: string,
    private readonly refreshSecret: string,
    private readonly accessExpiresIn: string,
    private readonly refreshExpiresIn: string,
  ) {}

  createTokenPair(userId: string, role: UserRole, sessionId: string): TokenPairData {
    const refreshJti = randomUUID()
    const accessToken = jwt.sign({ role, type: 'access' }, this.accessSecret, {
      subject: userId,
      // jsonwebtoken's declaration narrows duration strings more than the runtime API.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expiresIn: this.accessExpiresIn as JwtExpiresIn,
    })
    const refreshToken = jwt.sign(
      { sid: sessionId, jti: refreshJti, type: 'refresh' },
      this.refreshSecret,
      {
        subject: userId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        expiresIn: this.refreshExpiresIn as JwtExpiresIn,
      },
    )

    return {
      accessToken,
      refreshToken,
      refreshJti,
      refreshExpiresAt: new Date(Date.now() + durationToSeconds(this.refreshExpiresIn) * 1000),
    }
  }

  verifyAccessToken(token: string): AccessPayload {
    try {
      const payload = jwt.verify(token, this.accessSecret)
      if (
        typeof payload === 'string' ||
        payload.type !== 'access' ||
        typeof payload.sub !== 'string' ||
        !['USER', 'ADMIN', 'SUPER_ADMIN'].includes(String(payload.role))
      ) {
        throw new Error('Invalid access payload')
      }
      return payload as AccessPayload
    } catch {
      throw new AppError(401, 'ACCESS_TOKEN_INVALID', 'Your session is not valid.')
    }
  }

  verifyRefreshToken(token: string): RefreshPayload {
    try {
      const payload = jwt.verify(token, this.refreshSecret)
      if (
        typeof payload === 'string' ||
        payload.type !== 'refresh' ||
        typeof payload.sub !== 'string' ||
        typeof payload.sid !== 'string' ||
        typeof payload.jti !== 'string'
      ) {
        throw new Error('Invalid refresh payload')
      }
      return payload as RefreshPayload
    } catch {
      throw new AppError(401, 'REFRESH_TOKEN_INVALID', 'Please sign in again.')
    }
  }
}
