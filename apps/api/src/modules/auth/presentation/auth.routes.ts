import { Router, type CookieOptions, type RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import * as contracts from '@campusbaza/contracts'
import type { GoogleSignInInput } from '@campusbaza/contracts'

const { googleSignInInputSchema } = contracts
import type { AppEnv } from '../../../config/env.js'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { validateBody } from '../../../core/middleware/validate.js'
import {
  rateLimitStoreOption,
  type RateLimitStoreFactory,
} from '../../../core/rate-limit/rate-limit-store.factory.js'
import type { AuthService } from '../application/auth.service.js'

const REFRESH_COOKIE = 'campusbaza_refresh'

function cookieOptions(env: AppEnv, expiresAt?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/api/v1/auth',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    ...(expiresAt ? { expires: expiresAt } : {}),
  }
}

export function createAuthRouter(
  auth: AuthService,
  authenticate: RequestHandler,
  env: AppEnv,
  storeFactory: RateLimitStoreFactory,
): Router {
  const router = Router()
  const googleSignInLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 30,
    ...rateLimitStoreOption(storeFactory, 'auth-google-sign-in'),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'GOOGLE_SIGN_IN_RATE_LIMIT',
        message: 'Too many sign-in attempts. Try again later.',
      },
    },
  })

  router.post(
    '/google',
    googleSignInLimiter,
    validateBody(googleSignInInputSchema),
    asyncHandler(async (request, response) => {
      const input = request.body as GoogleSignInInput
      const result = await auth.signInWithGoogle(input.credential, {
        ipAddress: request.ip ?? null,
        userAgent: request.header('user-agent') ?? null,
      })
      response.cookie(
        REFRESH_COOKIE,
        result.refreshToken,
        cookieOptions(env, result.refreshExpiresAt),
      )
      response.json({
        success: true,
        message: 'Signed in successfully.',
        data: { accessToken: result.accessToken, user: result.user },
      })
    }),
  )

  router.post(
    '/refresh',
    asyncHandler(async (request, response) => {
      const token = (request.cookies as Record<string, string | undefined>)[REFRESH_COOKIE]
      const result = await auth.refresh(token ?? '')
      response.cookie(
        REFRESH_COOKIE,
        result.refreshToken,
        cookieOptions(env, result.refreshExpiresAt),
      )
      response.json({
        success: true,
        message: 'Session refreshed.',
        data: { accessToken: result.accessToken, user: result.user },
      })
    }),
  )

  router.post(
    '/logout',
    asyncHandler(async (request, response) => {
      const token = (request.cookies as Record<string, string | undefined>)[REFRESH_COOKIE]
      await auth.logout(token)
      response.clearCookie(REFRESH_COOKIE, cookieOptions(env))
      response.json({ success: true, message: 'Signed out successfully.', data: null })
    }),
  )

  router.post(
    '/logout-all',
    authenticate,
    asyncHandler(async (request, response) => {
      await auth.logoutAll(request.auth!.user.id)
      response.clearCookie(REFRESH_COOKIE, cookieOptions(env))
      response.json({ success: true, message: 'All sessions have been signed out.', data: null })
    }),
  )

  router.get('/me', authenticate, (request, response) => {
    response.json({
      success: true,
      message: 'Current user retrieved.',
      data: { user: request.auth!.user },
    })
  })

  return router
}
