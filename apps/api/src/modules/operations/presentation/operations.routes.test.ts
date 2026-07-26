import { describe, it, expect, vi, beforeEach } from 'vitest'
import express, { type Request, type Response, type NextFunction } from 'express'
import request from 'supertest'
import { createOperationsRouter } from './operations.routes.js'
import { AppError } from '../../../core/errors/app-error.js'

describe('Operations Routes', () => {
  let app: express.Express
  let mockCleanup: any
  let mockIndexes: any
  let mockMongoReady: any
  let mockRedisReady: any
  let authenticateMock: any

  beforeEach(() => {
    mockCleanup = {
      run: vi.fn(),
      isRunning: vi.fn(),
      getLastResult: vi.fn(),
    }

    mockIndexes = {
      inspect: vi.fn(),
    }

    mockMongoReady = vi.fn()
    mockRedisReady = vi.fn()

    authenticateMock = (role: string = 'SUPER_ADMIN') => {
      return (req: Request, res: Response, next: NextFunction) => {
        ;(req as any).auth = { user: { role } }
        next()
      }
    }

    const buildApp = (authRole = 'SUPER_ADMIN') => {
      const router = createOperationsRouter({
        authenticate: authenticateMock(authRole),
        cleanup: mockCleanup as any,
        indexes: mockIndexes as any,
        mongoReady: mockMongoReady,
        redisReady: mockRedisReady,
        redisRequired: true,
        cleanupEnabled: true,
        cleanupIntervalMinutes: 60,
      })

      const expressApp = express()
      expressApp.use(express.json())
      expressApp.use('/operations', router)

      // Error handling middleware to catch AppError
      expressApp.use((err: any, req: Request, res: Response, next: NextFunction) => {
        if (err instanceof AppError) {
          res.status(err.statusCode).json({ error: err.code, message: err.message })
        } else {
          res.status(500).json({ error: 'INTERNAL_ERROR' })
        }
      })

      return expressApp
    }

    app = buildApp()
  })

  describe('Authorization', () => {
    it('should deny access if user is not SUPER_ADMIN', async () => {
      const appNotAdmin = createOperationsRouter({
        authenticate: authenticateMock('USER'),
        cleanup: mockCleanup,
        indexes: mockIndexes,
        mongoReady: mockMongoReady,
        redisReady: mockRedisReady,
        redisRequired: true,
        cleanupEnabled: true,
        cleanupIntervalMinutes: 60,
      })

      const expressApp = express()
      expressApp.use('/operations', appNotAdmin)
      expressApp.use((err: any, req: Request, res: Response, next: NextFunction) => {
        res.status(err.statusCode || 500).json({ error: err.code })
      })

      const response = await request(expressApp).get('/operations/status')
      expect(response.status).toBe(403)
      expect(response.body.error).toBe('INSUFFICIENT_PERMISSION')
    })

    it('should deny access if not authenticated', async () => {
      const appUnauth = createOperationsRouter({
        authenticate: (req: Request, res: Response, next: NextFunction) => next(),
        cleanup: mockCleanup,
        indexes: mockIndexes,
        mongoReady: mockMongoReady,
        redisReady: mockRedisReady,
        redisRequired: true,
        cleanupEnabled: true,
        cleanupIntervalMinutes: 60,
      })

      const expressApp = express()
      expressApp.use('/operations', appUnauth)
      expressApp.use((err: any, req: Request, res: Response, next: NextFunction) => {
        res.status(err.statusCode || 500).json({ error: err.code })
      })

      const response = await request(expressApp).get('/operations/status')
      expect(response.status).toBe(401)
      expect(response.body.error).toBe('AUTHENTICATION_REQUIRED')
    })
  })

  describe('GET /status', () => {
    it('should return operations status successfully', async () => {
      mockMongoReady.mockReturnValue(true)
      mockRedisReady.mockResolvedValue(true)
      mockIndexes.inspect.mockResolvedValue([{ model: 'User', toCreate: ['index'], toDrop: [] }])
      mockCleanup.isRunning.mockReturnValue(false)
      mockCleanup.getLastResult.mockReturnValue({ success: true })

      const response = await request(app).get('/operations/status')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual({
        mongoReady: true,
        redisReady: true,
        redisRequired: true,
        cleanupEnabled: true,
        cleanupRunning: false,
        cleanupIntervalMinutes: 60,
        lastCleanup: { success: true },
        indexDriftCount: 1,
      })
    })

    it('should handle errors from dependencies', async () => {
      mockRedisReady.mockRejectedValue(new Error('Redis error'))
      mockIndexes.inspect.mockResolvedValue([])

      const response = await request(app).get('/operations/status')
      expect(response.status).toBe(500)
    })
  })

  describe('GET /indexes', () => {
    it('should return index drift inspection results', async () => {
      const mockDrift = [{ model: 'User', toCreate: ['index1'], toDrop: ['index2'] }]
      mockIndexes.inspect.mockResolvedValue(mockDrift)

      const response = await request(app).get('/operations/indexes')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockDrift)
    })
  })

  describe('POST /cleanup', () => {
    it('should run cleanup successfully', async () => {
      const mockResult = { success: true, durationMs: 100 }
      mockCleanup.run.mockResolvedValue(mockResult)

      const response = await request(app).post('/operations/cleanup')

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual(mockResult)
      expect(mockCleanup.run).toHaveBeenCalledWith('manual')
    })

    it('should return 409 if cleanup is already running', async () => {
      mockCleanup.run.mockResolvedValue(null)

      const response = await request(app).post('/operations/cleanup')

      expect(response.status).toBe(409)
      expect(response.body.error).toBe('CLEANUP_ALREADY_RUNNING')
    })
  })
})
