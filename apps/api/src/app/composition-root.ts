import type Redis from 'ioredis'
import { env } from '../config/env.js'
import { logger } from '../core/http/logger.js'
import { createAuthenticateMiddleware } from '../core/middleware/authenticate.js'
import { TokenService } from '../core/security/token-service.js'
import { createRedis } from '../infrastructure/database/redis.connection.js'
import { ConsoleEmailSender } from '../infrastructure/email/console-email.sender.js'
import { SmtpEmailSender } from '../infrastructure/email/smtp-email.sender.js'
import { InMemoryOtpStore } from '../infrastructure/otp/in-memory-otp.store.js'
import { RedisOtpStore } from '../infrastructure/otp/redis-otp.store.js'
import { AuthService } from '../modules/auth/application/auth.service.js'
import type { EmailSender, OtpStore } from '../modules/auth/domain/otp.js'
import { MongooseSessionRepository } from '../modules/auth/infrastructure/mongoose-session.repository.js'
import { ProfileService } from '../modules/users/application/profile.service.js'
import { MongooseUserRepository } from '../modules/users/infrastructure/mongoose-user.repository.js'
import { CategoryService } from '../modules/categories/application/category.service.js'
import { MongooseCategoryRepository } from '../modules/categories/infrastructure/mongoose-category.repository.js'
import { ProductService } from '../modules/products/application/product.service.js'
import { MongooseProductRepository } from '../modules/products/infrastructure/mongoose-product.repository.js'
import { HomepageService } from '../modules/homepage/application/homepage.service.js'
import { MongooseHomepageRepository } from '../modules/homepage/infrastructure/mongoose-homepage.repository.js'
import { CloudinaryImageStorage } from '../modules/uploads/infrastructure/cloudinary-image-storage.js'
import { MongooseUploadAssetRepository } from '../modules/uploads/infrastructure/mongoose-upload-asset.repository.js'
import { ImageUploadService } from '../modules/uploads/application/image-upload.service.js'
import { MongooseListingRepository } from '../modules/listings/infrastructure/mongoose-listing.repository.js'
import { ListingService } from '../modules/listings/application/listing.service.js'
import {
  MongooseCartRepository,
  MongooseCheckoutCatalogRepository,
  DefaultCartMapper,
} from '../modules/cart/infrastructure/mongoose-cart.repository.js'
import { CartService } from '../modules/cart/application/cart.service.js'
import { MongooseOrderRepository } from '../modules/orders/infrastructure/mongoose-order.repository.js'
import { OrderService } from '../modules/orders/application/order.service.js'
import { DealerService } from '../modules/dealers/application/dealer.service.js'
import { MongooseDealerRepository } from '../modules/dealers/infrastructure/mongoose-dealer.repository.js'
import { MongooseNotificationRepository } from '../modules/notifications/infrastructure/mongoose-notification.repository.js'
import { NotificationService } from '../modules/notifications/application/notification.service.js'
import { ReportService } from '../modules/reports/application/report.service.js'
import { AuditService } from '../modules/audit/application/audit.service.js'
import { SettingsService } from '../modules/settings/application/settings.service.js'
import { MongooseAdminRepository } from '../modules/admin/infrastructure/mongoose-admin.repository.js'
import { AdminService } from '../modules/admin/application/admin.service.js'
import { MetricsRegistry } from '../core/observability/metrics.js'
import { createRateLimitStoreFactory } from '../core/rate-limit/rate-limit-store.factory.js'
import { CleanupService } from '../modules/operations/application/cleanup.service.js'
import { CleanupScheduler } from '../modules/operations/application/cleanup.scheduler.js'
import { IndexInspectionService } from '../modules/operations/application/index-inspection.service.js'
import { ChatService } from '../modules/chat/application/chat.service.js'
import { CloudinaryAudioStorage } from '../modules/chat/infrastructure/cloudinary-audio-storage.js'

export function createCompositionRoot() {
  const metrics = new MetricsRegistry()
  const users = new MongooseUserRepository()
  const sessions = new MongooseSessionRepository()
  const tokenService = new TokenService(
    env.JWT_ACCESS_SECRET,
    env.JWT_REFRESH_SECRET,
    env.ACCESS_TOKEN_EXPIRES_IN,
    env.REFRESH_TOKEN_EXPIRES_IN,
  )

  let redis: Redis | null = null
  let otpStore: OtpStore
  if (env.OTP_STORE === 'redis') {
    redis = createRedis(env.REDIS_URL, logger)
    otpStore = new RedisOtpStore(redis)
  } else {
    otpStore = new InMemoryOtpStore()
  }

  let emailSender: EmailSender
  if (env.EMAIL_PROVIDER === 'smtp') {
    emailSender = new SmtpEmailSender(
      env.SMTP_HOST,
      env.SMTP_PORT,
      env.SMTP_SECURE,
      env.SMTP_USER,
      env.SMTP_PASSWORD,
      env.SMTP_FROM_NAME,
      env.SMTP_FROM_EMAIL,
    )
  } else {
    emailSender = new ConsoleEmailSender(logger)
  }

  const authService = new AuthService(users, sessions, otpStore, emailSender, tokenService, {
    appName: env.APP_NAME,
    allowedEmailDomains: env.ALLOWED_EMAIL_DOMAINS,
    adminEmails: env.ADMIN_EMAILS,
    superAdminEmails: env.SUPER_ADMIN_EMAILS,
    otpLength: env.OTP_LENGTH,
    otpExpiryMinutes: env.OTP_EXPIRY_MINUTES,
    otpResendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
    otpMaxAttempts: env.OTP_MAX_ATTEMPTS,
    otpHashSecret: env.OTP_HASH_SECRET,
  })
  const profileService = new ProfileService(users)
  const categories = new MongooseCategoryRepository()
  const products = new MongooseProductRepository()
  const homepage = new MongooseHomepageRepository()
  const categoryService = new CategoryService(categories)
  const productService = new ProductService(products, categories)
  const homepageService = new HomepageService(homepage, products, categories, {
    FEATURED: env.HOMEPAGE_FEATURED_LIMIT,
    OFFICIAL: env.HOMEPAGE_OFFICIAL_LIMIT,
    SECOND_HAND: env.HOMEPAGE_SECOND_HAND_LIMIT,
    RECENT: env.HOMEPAGE_RECENT_LIMIT,
  })
  const imageStorage = new CloudinaryImageStorage(
    env.CLOUDINARY_CLOUD_NAME,
    env.CLOUDINARY_API_KEY,
    env.CLOUDINARY_API_SECRET,
    env.CLOUDINARY_FOLDER,
  )
  const uploadAssets = new MongooseUploadAssetRepository()
  const uploadService = new ImageUploadService(imageStorage, uploadAssets, {
    maxBytes: env.PRODUCT_IMAGE_MAX_BYTES,
    maxCount: env.PRODUCT_IMAGE_MAX_COUNT,
  })
  const notifications = new MongooseNotificationRepository()
  const listings = new MongooseListingRepository()
  const listingService = new ListingService(
    listings,
    categories,
    users,
    uploadService,
    notifications,
  )
  const carts = new MongooseCartRepository()
  const checkoutCatalog = new MongooseCheckoutCatalogRepository()
  const cartMapper = new DefaultCartMapper()
  const cartService = new CartService(carts, checkoutCatalog, cartMapper)
  const orders = new MongooseOrderRepository()
  const orderService = new OrderService(orders, carts, checkoutCatalog, env.APP_NAME, notifications)
  const chatAudioStorage = new CloudinaryAudioStorage(
    env.CLOUDINARY_CLOUD_NAME,
    env.CLOUDINARY_API_KEY,
    env.CLOUDINARY_API_SECRET,
    env.CLOUDINARY_FOLDER,
  )
  const chatService = new ChatService(chatAudioStorage, env.CHAT_AUDIO_MAX_BYTES)
  const dealers = new MongooseDealerRepository()
  const dealerService = new DealerService(dealers)
  const notificationService = new NotificationService(notifications)
  const reportService = new ReportService(notifications)
  const auditService = new AuditService()
  const settingsService = new SettingsService({
    appName: env.APP_NAME,
    brandMark: env.BRAND_MARK,
    campusDisplayName: env.CAMPUS_DISPLAY_NAME,
  })
  const adminService = new AdminService(new MongooseAdminRepository(), orderService, notifications)
  const cleanupService = new CleanupService(uploadService, settingsService, {
    batchSize: env.CLEANUP_BATCH_SIZE,
    temporaryUploadRetentionHours: env.TEMP_UPLOAD_RETENTION_HOURS,
    readNotificationRetentionDays: env.READ_NOTIFICATION_RETENTION_DAYS,
    revokedSessionRetentionDays: env.REVOKED_SESSION_RETENTION_DAYS,
    auditLogRetentionDays: env.AUDIT_LOG_RETENTION_DAYS,
  })
  const cleanupScheduler = new CleanupScheduler(cleanupService, redis, metrics, logger, {
    enabled: env.CLEANUP_ENABLED,
    runOnStart: env.CLEANUP_RUN_ON_START,
    intervalMinutes: env.CLEANUP_INTERVAL_MINUTES,
    lockTtlSeconds: env.CLEANUP_LOCK_TTL_SECONDS,
  })
  const indexInspectionService = new IndexInspectionService()
  const rateLimitStoreFactory = createRateLimitStoreFactory(redis)
  const authenticate = createAuthenticateMiddleware(tokenService, users)

  return {
    env,
    logger,
    redis,
    metrics,
    rateLimitStoreFactory,
    tokenService,
    users,
    authService,
    profileService,
    categoryService,
    productService,
    homepageService,
    uploadService,
    listingService,
    cartService,
    orderService,
    chatService,
    dealerService,
    notificationService,
    reportService,
    auditService,
    settingsService,
    adminService,
    cleanupScheduler,
    indexInspectionService,
    authenticate,
  }
}

export type CompositionRoot = ReturnType<typeof createCompositionRoot>
