import pino from 'pino'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createAuthenticateMiddleware } from '../core/middleware/authenticate.js'
import { TokenService } from '../core/security/token-service.js'
import { MetricsRegistry } from '../core/observability/metrics.js'
import { InMemoryOtpStore } from '../infrastructure/otp/in-memory-otp.store.js'
import { AuthService } from '../modules/auth/application/auth.service.js'
import { ProfileService } from '../modules/users/application/profile.service.js'
import type { CategoryService } from '../modules/categories/application/category.service.js'
import type { ProductService } from '../modules/products/application/product.service.js'
import type { HomepageService } from '../modules/homepage/application/homepage.service.js'
import type { ImageUploadService } from '../modules/uploads/application/image-upload.service.js'
import type { ListingService } from '../modules/listings/application/listing.service.js'
import type { CartService } from '../modules/cart/application/cart.service.js'
import type { OrderService } from '../modules/orders/application/order.service.js'
import type { DealerService } from '../modules/dealers/application/dealer.service.js'
import {
  FakeEmailSender,
  InMemorySessionRepository,
  InMemoryUserRepository,
} from '../test/fakes.js'
import { createApp } from './create-app.js'
import type { CompositionRoot } from './composition-root.js'

function createTestRoot(): CompositionRoot {
  const users = new InMemoryUserRepository()
  const sessions = new InMemorySessionRepository()
  const tokens = new TokenService('a'.repeat(48), 'b'.repeat(48), '15m', '30d')
  const authService = new AuthService(
    users,
    sessions,
    new InMemoryOtpStore(),
    new FakeEmailSender(),
    tokens,
    {
      appName: 'Campus Angadi',
      allowedEmailDomains: ['campusbaza.example.edu'],
      adminEmails: [],
      superAdminEmails: [],
      otpLength: 6,
      otpExpiryMinutes: 5,
      otpResendCooldownSeconds: 60,
      otpMaxAttempts: 5,
      otpHashSecret: 'c'.repeat(48),
    },
  )

  const emptySection = (key: 'FEATURED' | 'OFFICIAL' | 'SECOND_HAND' | 'RECENT') => ({
    key,
    limit: 8,
    manualProductIds: [],
    products: [],
    manualCount: 0,
    automaticCount: 0,
  })
  const categoryService = {
    listPublic: async () => [],
  } as unknown as CategoryService
  const productService = {
    listPublic: async () => ({
      items: [],
      meta: { page: 1, limit: 12, total: 0, totalPages: 0 },
    }),
  } as unknown as ProductService
  const uploadService = {
    uploadProductImages: async () => [],
    removeTemporary: async () => undefined,
  } as unknown as ImageUploadService
  const listingService = {
    listMine: async () => ({
      items: [],
      meta: { page: 1, limit: 12, total: 0, totalPages: 0 },
    }),
    listModeration: async () => ({
      items: [],
      meta: { page: 1, limit: 12, total: 0, totalPages: 0 },
    }),
  } as unknown as ListingService
  const cartService = {
    get: async () => ({
      id: 'cart',
      userId: 'user',
      items: [],
      totalItems: 0,
      subtotal: 0,
      issues: [],
      updatedAt: new Date().toISOString(),
    }),
  } as unknown as CartService
  const orderService = {
    listOwned: async () => ({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
    listAdmin: async () => ({ items: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
  } as unknown as OrderService
  const dealerService = {
    list: async () => ({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
  } as unknown as DealerService
  const homepageService = {
    getPublic: async () => ({
      categories: [],
      sections: {
        FEATURED: emptySection('FEATURED'),
        OFFICIAL: emptySection('OFFICIAL'),
        SECOND_HAND: emptySection('SECOND_HAND'),
        RECENT: emptySection('RECENT'),
      },
    }),
  } as unknown as HomepageService

  return {
    env: {
      NODE_ENV: 'test',
      APP_NAME: 'Campus Angadi',
      BRAND_MARK: 'CV',
      CAMPUS_DISPLAY_NAME: 'Test Campus',
      WEB_URL: 'http://localhost:5173',
      API_URL: 'http://localhost:5000',
      API_PORT: 5000,
      LOG_LEVEL: 'silent',
      GLOBAL_RATE_LIMIT_WINDOW_MS: 900000,
      GLOBAL_RATE_LIMIT_MAX: 500,
      METRICS_ENABLED: true,
      METRICS_TOKEN: '',
      SHUTDOWN_TIMEOUT_MS: 15000,
      CLEANUP_ENABLED: false,
      CLEANUP_RUN_ON_START: false,
      CLEANUP_INTERVAL_MINUTES: 60,
      CLEANUP_LOCK_TTL_SECONDS: 600,
      CLEANUP_BATCH_SIZE: 100,
      TEMP_UPLOAD_RETENTION_HOURS: 24,
      READ_NOTIFICATION_RETENTION_DAYS: 180,
      REVOKED_SESSION_RETENTION_DAYS: 30,
      AUDIT_LOG_RETENTION_DAYS: 730,
      MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
      MONGODB_AUTO_INDEX: true,
      MONGODB_MAX_POOL_SIZE: 20,
      MONGODB_MIN_POOL_SIZE: 0,
      MONGODB_SERVER_SELECTION_TIMEOUT_MS: 8000,
      REDIS_URL: 'redis://127.0.0.1:6379',
      OTP_STORE: 'memory',
      ALLOWED_EMAIL_DOMAINS: ['campusbaza.example.edu'],
      ADMIN_EMAILS: [],
      SUPER_ADMIN_EMAILS: [],
      OTP_LENGTH: 6,
      OTP_EXPIRY_MINUTES: 5,
      OTP_RESEND_COOLDOWN_SECONDS: 60,
      OTP_MAX_ATTEMPTS: 5,
      OTP_SEND_MAX_PER_HOUR: 5,
      OTP_HASH_SECRET: 'c'.repeat(48),
      EMAIL_PROVIDER: 'console',
      SMTP_HOST: '',
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_USER: '',
      SMTP_PASSWORD: '',
      SMTP_FROM_NAME: 'Campus Angadi',
      SMTP_FROM_EMAIL: 'no-reply@campusbaza.example.edu',
      JWT_ACCESS_SECRET: 'a'.repeat(48),
      JWT_REFRESH_SECRET: 'b'.repeat(48),
      ACCESS_TOKEN_EXPIRES_IN: '15m',
      REFRESH_TOKEN_EXPIRES_IN: '30d',
      COOKIE_SECURE: false,
      COOKIE_SAME_SITE: 'lax',
      COOKIE_DOMAIN: '',
      CORS_ALLOWED_ORIGINS: ['http://localhost:5173'],
      HOMEPAGE_FEATURED_LIMIT: 8,
      HOMEPAGE_OFFICIAL_LIMIT: 8,
      HOMEPAGE_SECOND_HAND_LIMIT: 8,
      HOMEPAGE_RECENT_LIMIT: 8,
      UPLOAD_PROVIDER: 'cloudinary',
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: 'test-secret',
      CLOUDINARY_FOLDER: 'campusbaza/test',
      PRODUCT_IMAGE_MAX_BYTES: 5_000_000,
      PRODUCT_IMAGE_MAX_COUNT: 8,
    },
    logger: pino({ enabled: false }),
    redis: null,
    metrics: new MetricsRegistry(),
    rateLimitStoreFactory: () => undefined,
    authService,
    profileService: new ProfileService(users),
    categoryService,
    productService,
    homepageService,
    uploadService,
    listingService,
    cartService,
    orderService,
    dealerService,
    notificationService: {} as CompositionRoot['notificationService'],
    reportService: {} as CompositionRoot['reportService'],
    auditService: {
      record: async () => undefined,
      list: async () => ({ items: [], meta: { page: 1, limit: 30, total: 0, totalPages: 0 } }),
    },
    settingsService: {
      getPublic: async () => ({
        appName: 'Campus Angadi',
        brandMark: 'CV',
        campusDisplayName: 'Test Campus',
        supportEmail: null,
        supportPhone: null,
        defaultPickupLocations: [],
        listingExpirationDays: 30,
        maxActiveListingsPerUser: 20,
        termsUrl: null,
        privacyUrl: null,
      }),
    } as unknown as CompositionRoot['settingsService'],
    adminService: {} as CompositionRoot['adminService'],
    cleanupScheduler: {
      start: () => undefined,
      stop: () => undefined,
      isRunning: () => false,
      getLastResult: () => null,
      run: async () => null,
    } as unknown as CompositionRoot['cleanupScheduler'],
    indexInspectionService: { inspect: async () => [] },
    authenticate: createAuthenticateMiddleware(tokens, users),
  }
}

describe('Campus Angadi API application', () => {
  it('returns the health contract without external dependencies', async () => {
    const response = await request(createApp(createTestRoot())).get('/api/v1/health')
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      success: true,
      data: { service: 'campusbaza-api', status: 'ok' },
    })
  })

  it('exposes Prometheus-compatible metrics without counting health checks as failures', async () => {
    const response = await request(createApp(createTestRoot())).get('/api/v1/metrics')
    expect(response.status).toBe(200)
    expect(response.text).toContain('campusbaza_process_uptime_seconds')
    expect(response.headers['content-type']).toContain('text/plain')
  })

  it('rejects an OTP request for a non-campus domain', async () => {
    const response = await request(createApp(createTestRoot()))
      .post('/api/v1/auth/otp/request')
      .send({ email: 'student@gmail.com' })
    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('EMAIL_DOMAIN_NOT_ALLOWED')
  })

  it('serves the public Part 2 catalogue contracts', async () => {
    const app = createApp(createTestRoot())
    const [homepage, products, categories] = await Promise.all([
      request(app).get('/api/v1/homepage'),
      request(app).get('/api/v1/products'),
      request(app).get('/api/v1/categories'),
    ])

    expect(homepage.status).toBe(200)
    expect(homepage.body.data.sections.FEATURED.products).toEqual([])
    expect(products.status).toBe(200)
    expect(products.body.meta).toMatchObject({ page: 1, limit: 12, total: 0 })
    expect(categories.status).toBe(200)
  })

  it('rejects unsafe catalogue page sizes before reaching the service', async () => {
    const response = await request(createApp(createTestRoot())).get('/api/v1/products?limit=1000')
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })
})
