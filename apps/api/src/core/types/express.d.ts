import type { AuthUser } from '@campusbaza/contracts'

declare global {
  namespace Express {
    interface Request {
      requestId: string
      auth?: {
        user: AuthUser
      }
    }
  }
}

export {}
