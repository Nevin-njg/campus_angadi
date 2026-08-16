import 'dotenv/config'
import { z } from 'zod'

const booleanFromString = z.preprocess((value) => {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return value
  return value.toLowerCase() === 'true'
}, z.boolean())

const csv = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean),
)

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_NAME: z.string().min(1).default('Campus Angadi'),
    BRAND_MARK: z.string().min(1).max(8).default('CA'),
    CAMPUS_DISPLAY_NAME: z.string().min(1).default('Campus'),
    WEB_URL: z.string().url().default('http://localhost:5173'),
    API_URL: z.string().url().default('http://localhost:5000'),
    API_PORT: z.coerce.number().int().positive().default(5000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    GLOBAL_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).default(900000),
    GLOBAL_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(500),
    METRICS_ENABLED: booleanFromString.default(true),
    METRICS_TOKEN: z.string().optional().default(''),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(15000),
    CLEANUP_ENABLED: booleanFromString.default(true),
    CLEANUP_RUN_ON_START: booleanFromString.default(true),
    CLEANUP_INTERVAL_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
    CLEANUP_LOCK_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(600),
    CLEANUP_BATCH_SIZE: z.coerce.number().int().min(10).max(1000).default(100),
    TEMP_UPLOAD_RETENTION_HOURS: z.coerce.number().int().min(1).max(720).default(24),
    READ_NOTIFICATION_RETENTION_DAYS: z.coerce.number().int().min(7).max(3650).default(180),
    REVOKED_SESSION_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().min(30).max(3650).default(730),
    MONGODB_URI: z.string().min(1),
    MONGODB_AUTO_INDEX: booleanFromString.default(true),
    MONGODB_MAX_POOL_SIZE: z.coerce.number().int().min(1).max(200).default(20),
    MONGODB_MIN_POOL_SIZE: z.coerce.number().int().min(0).max(50).default(0),
    MONGODB_SERVER_SELECTION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(8000),
    REDIS_URL: z.string().min(1),
    ALLOWED_EMAIL_DOMAINS: csv,
    GOOGLE_CLIENT_ID: z.string().trim().min(20),
    GOOGLE_HOSTED_DOMAINS: csv.default(''),
    ADMIN_EMAILS: csv.default(''),
    SUPER_ADMIN_EMAILS: csv.default(''),
    TEST_LOGIN_ENABLED: booleanFromString.default(false),
    TEST_LOGIN_EMAIL: z.string().trim().email().optional().or(z.literal('')).default(''),
    TEST_LOGIN_PASSWORD: z.string().optional().default(''),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),
    COOKIE_SECURE: booleanFromString.default(false),
    COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    COOKIE_DOMAIN: z.string().optional().default(''),
    CORS_ALLOWED_ORIGINS: csv,
    HOMEPAGE_FEATURED_LIMIT: z.coerce.number().int().min(1).max(48).default(8),
    HOMEPAGE_OFFICIAL_LIMIT: z.coerce.number().int().min(1).max(48).default(8),
    HOMEPAGE_SECOND_HAND_LIMIT: z.coerce.number().int().min(1).max(48).default(8),
    HOMEPAGE_RECENT_LIMIT: z.coerce.number().int().min(1).max(48).default(8),
    UPLOAD_PROVIDER: z.enum(['cloudinary']).default('cloudinary'),
    CLOUDINARY_CLOUD_NAME: z.string().min(1),
    CLOUDINARY_API_KEY: z.string().min(1),
    CLOUDINARY_API_SECRET: z.string().min(1),
    CLOUDINARY_FOLDER: z.string().trim().min(1).default('campusbaza/products'),
    PRODUCT_IMAGE_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(100_000)
      .max(15_000_000)
      .default(5_000_000),
    PRODUCT_IMAGE_MAX_COUNT: z.coerce.number().int().min(1).max(8).default(8),

    // Web Push / seller order notifications.
    // Empty values keep push disabled without preventing the API from starting.
    VAPID_PUBLIC_KEY: z.string().trim().default(''),
    VAPID_PRIVATE_KEY: z.string().trim().default(''),
    VAPID_SUBJECT: z.string().trim().default('https://campusangadi.app'),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production' && value.METRICS_ENABLED && !value.METRICS_TOKEN) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['METRICS_TOKEN'],
        message: 'Production metrics require a METRICS_TOKEN.',
      })
    }

    if (value.COOKIE_SAME_SITE === 'none' && !value.COOKIE_SECURE) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_SECURE'],
        message: 'SameSite=None requires secure cookies.',
      })
    }

    if (value.NODE_ENV === 'production' && !value.COOKIE_SECURE) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_SECURE'],
        message: 'Production requires secure authentication cookies.',
      })
    }
    if (value.NODE_ENV === 'production' && value.TEST_LOGIN_ENABLED) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TEST_LOGIN_ENABLED'],
        message: 'The test login cannot be enabled in production.',
      })
    }
    if (
      value.TEST_LOGIN_ENABLED &&
      (!value.TEST_LOGIN_EMAIL || value.TEST_LOGIN_PASSWORD.length < 12)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TEST_LOGIN_PASSWORD'],
        message: 'Test login requires an email and a password of at least 12 characters.',
      })
    }
  })

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.error('Invalid environment configuration', result.error.flatten().fieldErrors)
  throw new Error('Invalid environment configuration')
}

export const env = result.data
export type AppEnv = typeof env
