import pino from 'pino'
import { env } from '../../config/env.js'

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers.set-cookie',
      '*.accessToken',
      '*.refreshToken',
      '*.code',
      '*.password',
      '*.otp',
      '*.token',
      '*.secret',
    ],
    censor: '[REDACTED]',
  },
  base: { service: 'campusbaza-api', environment: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
})
