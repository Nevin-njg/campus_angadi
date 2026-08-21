import { timingSafeEqual } from 'node:crypto'
import { Router, type CookieOptions, type RequestHandler } from 'express'
import { z } from 'zod'
import { rateLimit } from 'express-rate-limit'
import * as contracts from '@campusbaza/contracts'
import type {
  AccessRequestInput,
  GoogleSignInInput,
  RequestOtpInput,
  ReviewAccessRequestInput,
  TestSignInInput,
  VerifyOtpInput,
} from '@campusbaza/contracts'

const {
  accessRequestInputSchema,
  googleSignInInputSchema,
  requestOtpInputSchema,
  reviewAccessRequestInputSchema,
  testSignInInputSchema,
  verifyOtpInputSchema,
} = contracts
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

const mobileRefreshInputSchema = z
  .object({
    refreshToken: z.string().trim().min(100).max(12_000),
  })
  .strict()

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

function safeMatches(value: string, expected: string): boolean {
  const left = Buffer.from(value)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
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

    // The native seller app does not use browser refresh cookies.
    // Its refresh token is stored securely on the device instead,
    // so browser Origin/CSRF checks do not apply to these endpoints.
    if (request.path.startsWith('/seller-mobile/')) {
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

  const sellerOtpRequestLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    ...rateLimitStoreOption(
      storeFactory,
      'auth-seller-otp-request',
    ),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'SELLER_OTP_RATE_LIMIT',
        message:
          'Too many login-code requests. Try again later.',
      },
    },
  })

  const sellerOtpVerifyLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 30,
    ...rateLimitStoreOption(
      storeFactory,
      'auth-seller-otp-verify',
    ),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'SELLER_OTP_VERIFY_RATE_LIMIT',
        message:
          'Too many verification attempts. Try again later.',
      },
    },
  })

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
    '/seller-mobile/request-otp',
    sellerOtpRequestLimiter,
    validateBody(requestOtpInputSchema),
    asyncHandler(async (request, response) => {
      const input = request.body as RequestOtpInput
      const data = await auth.requestSellerOtp(input.email)

      response.json({
        success: true,
        message:
          'If this is an active seller account, a login code has been sent.',
        data,
      })
    }),
  )

  router.post(
    '/seller-mobile/verify-otp',
    sellerOtpVerifyLimiter,
    validateBody(verifyOtpInputSchema),
    asyncHandler(async (request, response) => {
      const input = request.body as VerifyOtpInput

      const result = await auth.verifySellerOtp(
        input.email,
        input.code,
        {
          ipAddress: request.ip ?? null,
          userAgent:
            request.header('user-agent') ?? null,
        },
      )

      response.json({
        success: true,
        message: 'Seller signed in successfully.',
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.user,
        },
      })
    }),
  )

  router.post(
    '/seller-mobile/refresh',
    validateBody(mobileRefreshInputSchema),
    asyncHandler(async (request, response) => {
      const result = await auth.refreshSellerMobile(
        (
          request.body as {
            refreshToken: string
          }
        ).refreshToken,
      )

      if (result.user.role !== 'SELLER') {
        await auth.logout(result.refreshToken)

        throw new AppError(
          403,
          'SELLER_APP_ACCESS_DENIED',
          'This account cannot use the seller app.',
        )
      }

      response.json({
        success: true,
        message: 'Seller session refreshed.',
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.user,
        },
      })
    }),
  )

  router.post(
    '/seller-mobile/logout',
    validateBody(mobileRefreshInputSchema),
    asyncHandler(async (request, response) => {
      await auth.logout(
        (
          request.body as {
            refreshToken: string
          }
        ).refreshToken,
      )

      response.json({
        success: true,
        message: 'Seller signed out successfully.',
        data: null,
      })
    }),
  )

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

  if (env.TEST_LOGIN_ENABLED) {
    router.post(
      '/test-login',
      googleSignInLimiter,
      validateBody(testSignInInputSchema),
      asyncHandler(async (request, response) => {
        const input = request.body as TestSignInInput
        if (
          input.email.toLowerCase() !== env.TEST_LOGIN_EMAIL.toLowerCase() ||
          !safeMatches(input.password, env.TEST_LOGIN_PASSWORD)
        ) {
          throw new AppError(401, 'TEST_LOGIN_INVALID', 'The test sign-in details are not valid.')
        }

        const result = await auth.signInForTesting(input.email, {
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
          message: 'Test session started.',
          data: { accessToken: result.accessToken, user: result.user },
        })
      }),
    )
  }

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
