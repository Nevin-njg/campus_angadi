import { Router, type CookieOptions, type RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import * as contracts from '@campusbaza/contracts'
import type {
  AccessRequestInput,
  GoogleSignInInput,
  ReviewAccessRequestInput,
} from '@campusbaza/contracts'

const { accessRequestInputSchema, googleSignInInputSchema, reviewAccessRequestInputSchema } =
  contracts
import type { AppEnv } from '../../../config/env.js'
import { AppError } from '../../../core/errors/app-error.js'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { isOriginAllowed } from '../../../core/http/origin-policy.js'
import { validateBody } from '../../../core/middleware/validate.js'
import {
  rateLimitStoreOption,
  type RateLimitStoreFactory,
} from '../../../core/rate-limit/rate-limit-store.factory.js'
import type { AuthService } from '../application/auth.service.js'
import type { AccessRequestService } from '../application/access-request.service.js'
import { requireRoles } from '../../../core/middleware/authenticate.js'

const REFRESH_COOKIE = 'campusbaza_refresh'

function queryText(value: unknown, key: string): string {
  if (typeof value !== 'object' || value === null) return ''
  const entry = (value as Record<string, unknown>)[key]
  return typeof entry === 'string' ? entry : ''
}

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
  accessRequests?: AccessRequestService,
): Router {
  const router = Router()

  const requireTrustedOrigin: RequestHandler = (request, _response, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      next()
      return
    }

    const origin = request.header('origin')

    // Keep local command-line testing convenient, while requiring an Origin
    // header for every unsafe production authentication request.
    if (!origin && env.NODE_ENV !== 'production') {
      next()
      return
    }

    if (!origin || !isOriginAllowed(origin, env.CORS_ALLOWED_ORIGINS, env.NODE_ENV)) {
      next(
        new AppError(
          403,
          'CSRF_ORIGIN_DENIED',
          'This authentication request did not come from an allowed origin.',
        ),
      )
      return
    }

    next()
  }

  router.use(requireTrustedOrigin)

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

  if (accessRequests) {
    router.post(
      '/access-requests',
      googleSignInLimiter,
      validateBody(accessRequestInputSchema),
      asyncHandler(async (request, response) => {
        const data = await accessRequests.request(request.body as AccessRequestInput)
        response.status(201).json({
          success: true,
          message: 'Your access request was sent to the administrators.',
          data,
        })
      }),
    )
  }

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

export function createAdminAccessRequestRouter(
  service: AccessRequestService,
  authenticate: RequestHandler,
) {
  const router = Router()
  router.use(authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'))
  router.get(
    '/',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Access requests retrieved.',
        data: await service.list(queryText(request.query, 'status')),
      })
    }),
  )
  router.patch(
    '/:id',
    validateBody(reviewAccessRequestInputSchema),
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Access request reviewed.',
        data: await service.review(
          String(request.params.id),
          request.auth!.user.id,
          request.body as ReviewAccessRequestInput,
        ),
      })
    }),
  )
  return router
}
