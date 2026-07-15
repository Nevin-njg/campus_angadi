import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import pinoHttp from 'pino-http'
import { AppError } from '../core/errors/app-error.js'
import { errorHandler, notFoundHandler } from '../core/middleware/error-handler.js'
import { createMetricsRouter } from '../core/observability/metrics.routes.js'
import { rateLimitStoreOption } from '../core/rate-limit/rate-limit-store.factory.js'
import { requestIdMiddleware } from '../core/middleware/request-id.js'
import { isMongoReady } from '../infrastructure/database/mongoose.connection.js'
import { createAuthRouter } from '../modules/auth/presentation/auth.routes.js'
import { createHealthRouter } from '../modules/health/health.routes.js'
import { createProfileRouter } from '../modules/users/presentation/profile.routes.js'
import {
  createCategoryRouter,
  createAdminCategoryRouter,
} from '../modules/categories/presentation/category.routes.js'
import {
  createProductRouter,
  createAdminProductRouter,
} from '../modules/products/presentation/product.routes.js'
import {
  createHomepageRouter,
  createAdminHomepageRouter,
} from '../modules/homepage/presentation/homepage.routes.js'
import { createUploadRouter } from '../modules/uploads/presentation/upload.routes.js'
import {
  createAdminModerationRouter,
  createListingRouter,
} from '../modules/listings/presentation/listing.routes.js'
import { createCartRouter } from '../modules/cart/presentation/cart.routes.js'
import {
  createAdminOrderRouter,
  createOrderRouter,
} from '../modules/orders/presentation/order.routes.js'
import { createAdminDealerRouter } from '../modules/dealers/presentation/dealer.routes.js'
import {
  createNotificationRouter,
  createAdminNotificationRouter,
} from '../modules/notifications/presentation/notification.routes.js'
import {
  createReportRouter,
  createAdminReportRouter,
} from '../modules/reports/presentation/report.routes.js'
import { createAdminAuditRouter } from '../modules/audit/presentation/audit.routes.js'
import { createAdminAuditMiddleware } from '../modules/audit/presentation/admin-audit.middleware.js'
import {
  createSettingsRouter,
  createAdminSettingsRouter,
} from '../modules/settings/presentation/settings.routes.js'
import { createMarketplaceGate } from '../modules/settings/presentation/marketplace-gate.middleware.js'
import { createAdminCoreRouter } from '../modules/admin/presentation/admin.routes.js'
import { requireRoles } from '../core/middleware/authenticate.js'
import { createOperationsRouter } from '../modules/operations/presentation/operations.routes.js'
import type { CompositionRoot } from './composition-root.js'

export function createApp(root: CompositionRoot) {
  const app = express()
  app.disable('x-powered-by')
  if (root.env.NODE_ENV === 'production') app.set('trust proxy', 1)

  app.use(requestIdMiddleware)
  app.use(root.metrics.middleware())
  app.use(
    pinoHttp({
      logger: root.logger,
      genReqId: (request) => request.headers['x-request-id'] as string,
    }),
  )
  const corsOptions: cors.CorsOptions = {
    origin(origin, callback) {
      if (!origin || root.env.CORS_ALLOWED_ORIGINS.includes(origin.toLowerCase())) {
        callback(null, true)
        return
      }
      callback(new AppError(403, 'CORS_ORIGIN_DENIED', 'This origin is not allowed.'))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  }
  // CORS must come before helmet so that preflight OPTIONS responses carry
  // Access-Control-Allow-Origin before any of helmet's policies run.
  app.options('*path', cors(corsOptions))
  app.use(cors(corsOptions))
  app.use(helmet())
  // Express 5 exposes these built-in parser factories at runtime; TypeScript validates their
  // middleware shape, while the current type-aware ESLint resolver cannot resolve the overload.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  app.use(express.json({ limit: '32kb', strict: true }))
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  app.use(express.urlencoded({ extended: false, limit: '16kb' }))
  app.use(cookieParser())
  app.use(
    rateLimit({
      windowMs: root.env.GLOBAL_RATE_LIMIT_WINDOW_MS,
      limit: root.env.GLOBAL_RATE_LIMIT_MAX,
      ...rateLimitStoreOption(root.rateLimitStoreFactory, 'global'),
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: (request) =>
        request.path.endsWith('/health') ||
        request.path.endsWith('/ready') ||
        request.path.endsWith('/metrics'),
    }),
  )

  const api = express.Router()
  api.use((request, response, next) => {
    if (
      request.method !== 'GET' ||
      /\/(auth|profile|cart|orders|notifications|admin)(\/|$)/.test(request.path)
    ) {
      response.setHeader('Cache-Control', 'no-store')
    }
    next()
  })
  api.use(
    createHealthRouter({
      mongo: () => Promise.resolve(isMongoReady()),
      redis: async () => {
        if (!root.redis) return false
        try {
          return (await root.redis.ping()) === 'PONG'
        } catch {
          return false
        }
      },
      redisRequired: root.env.OTP_STORE === 'redis',
    }),
  )
  if (root.env.METRICS_ENABLED) {
    api.use(createMetricsRouter(root.metrics, root.env.METRICS_TOKEN))
  }
  api.use(
    '/auth',
    createAuthRouter(root.authService, root.authenticate, root.env, root.rateLimitStoreFactory),
  )
  api.use('/profile', createProfileRouter(root.profileService, root.authenticate))
  api.use('/categories', createCategoryRouter(root.categoryService))
  api.use('/products', createProductRouter(root.productService))
  api.use('/homepage', createHomepageRouter(root.homepageService))
  api.use(
    '/uploads',
    createUploadRouter(
      root.uploadService,
      root.authenticate,
      {
        maxBytes: root.env.PRODUCT_IMAGE_MAX_BYTES,
        maxCount: root.env.PRODUCT_IMAGE_MAX_COUNT,
      },
      root.rateLimitStoreFactory,
    ),
  )
  api.use(
    '/listings',
    root.authenticate,
    createMarketplaceGate(root.settingsService, 'LISTINGS'),
    createListingRouter(root.listingService, root.authenticate, root.rateLimitStoreFactory),
  )
  api.use(
    '/cart',
    createCartRouter(root.cartService, root.authenticate, root.rateLimitStoreFactory),
  )
  api.use(
    '/orders',
    root.authenticate,
    createMarketplaceGate(root.settingsService, 'ORDERS'),
    createOrderRouter(root.orderService, root.authenticate, root.rateLimitStoreFactory),
  )
  api.use('/notifications', createNotificationRouter(root.notificationService, root.authenticate))
  api.use('/reports', createReportRouter(root.reportService, root.authenticate))
  api.use('/settings', createSettingsRouter(root.settingsService))
  api.use(
    '/admin',
    root.authenticate,
    requireRoles('ADMIN', 'SUPER_ADMIN'),
    createAdminAuditMiddleware(root.auditService),
  )
  api.use('/admin', createAdminCoreRouter(root.adminService, root.authenticate))
  api.use('/admin/categories', createAdminCategoryRouter(root.categoryService, root.authenticate))
  api.use('/admin/products', createAdminProductRouter(root.productService, root.authenticate))
  api.use('/admin/homepage', createAdminHomepageRouter(root.homepageService, root.authenticate))
  api.use('/admin/orders', createAdminOrderRouter(root.orderService, root.authenticate))
  api.use('/admin/dealers', createAdminDealerRouter(root.dealerService, root.authenticate))
  api.use('/admin/reports', createAdminReportRouter(root.reportService, root.authenticate))
  api.use(
    '/admin/notifications',
    createAdminNotificationRouter(root.notificationService, root.authenticate),
  )
  api.use('/admin/audit-logs', createAdminAuditRouter(root.auditService, root.authenticate))
  api.use('/admin/settings', createAdminSettingsRouter(root.settingsService, root.authenticate))
  api.use(
    '/admin/operations',
    createOperationsRouter({
      authenticate: root.authenticate,
      cleanup: root.cleanupScheduler,
      indexes: root.indexInspectionService,
      mongoReady: isMongoReady,
      redisReady: async () => {
        if (!root.redis) return false
        try {
          return (await root.redis.ping()) === 'PONG'
        } catch {
          return false
        }
      },
      redisRequired: root.env.NODE_ENV === 'production',
      cleanupEnabled: root.env.CLEANUP_ENABLED,
      cleanupIntervalMinutes: root.env.CLEANUP_INTERVAL_MINUTES,
    }),
  )
  api.use(
    '/admin/moderation/products',
    createAdminModerationRouter(root.listingService, root.authenticate),
  )

  app.use('/api/v1', api)
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
