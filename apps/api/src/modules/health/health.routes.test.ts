import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createHealthRouter, DependencyHealth } from './health.routes.js'

describe('Health Routes', () => {
  let app: express.Express
  let mockHealth: DependencyHealth

  beforeEach(() => {
    mockHealth = {
      mongo: vi.fn().mockResolvedValue(true),
      redis: vi.fn().mockResolvedValue(true),
      redisRequired: true,
    }

    app = express()
    app.use(express.json())
    app.use('/', createHealthRouter(mockHealth))
    
    // Simple error handler to catch asyncHandler errors
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.status(500).json({ success: false, message: 'Internal Server Error' })
    })
  })

  describe('GET /health', () => {
    it('should return 200 and healthy status', async () => {
      const response = await request(app).get('/health')
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        message: 'Campus Angaadi API is healthy.',
        data: { service: 'campusbaza-api', status: 'ok' },
      })
      expect(response.body.data).toHaveProperty('timestamp')
    })
  })

  describe('GET /ready', () => {
    it('should return 200 and ready when all dependencies are ready', async () => {
      const response = await request(app).get('/ready')
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        message: 'Campus Angaadi API is ready.',
        data: { mongo: true, redis: true, status: 'ready' }
      })
    })

    it('should return 503 and not-ready when mongo is down', async () => {
      mockHealth.mongo = vi.fn().mockResolvedValue(false)
      const response = await request(app).get('/ready')
      expect(response.status).toBe(503)
      expect(response.body).toMatchObject({
        success: false,
        message: 'Campus Angaadi API dependencies are not ready.',
        data: { mongo: false, redis: true, status: 'not-ready' }
      })
    })

    it('should return 503 and not-ready when redis is down and required', async () => {
      mockHealth.redis = vi.fn().mockResolvedValue(false)
      const response = await request(app).get('/ready')
      expect(response.status).toBe(503)
      expect(response.body).toMatchObject({
        success: false,
        message: 'Campus Angaadi API dependencies are not ready.',
        data: { mongo: true, redis: false, status: 'not-ready' }
      })
    })

    it('should return 200 and ready when redis is down but not required', async () => {
      mockHealth.redis = vi.fn().mockResolvedValue(false)
      mockHealth.redisRequired = false
      const response = await request(app).get('/ready')
      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        success: true,
        message: 'Campus Angaadi API is ready.',
        data: { mongo: true, redis: 'not-required', status: 'ready' }
      })
      expect(mockHealth.redis).not.toHaveBeenCalled()
    })

    it('should return 500 when dependency check throws an error', async () => {
      mockHealth.mongo = vi.fn().mockRejectedValue(new Error('Connection error'))
      const response = await request(app).get('/ready')
      expect(response.status).toBe(500)
      expect(response.body).toEqual({ success: false, message: 'Internal Server Error' })
    })
  })
})
