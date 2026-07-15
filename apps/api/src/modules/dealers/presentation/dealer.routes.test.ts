import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createAdminDealerRouter } from './dealer.routes.js'
import type { DealerService } from '../application/dealer.service.js'
import { AppError } from '../../../core/errors/app-error.js'

describe('Dealer Routes', () => {
  let app: express.Express
  let mockService: vi.Mocked<DealerService>
  let mockAuth: express.RequestHandler

  beforeEach(() => {
    mockService = {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    } as unknown as vi.Mocked<DealerService>

    app = express()
    app.use(express.json())

    mockAuth = (req: any, res: any, next: any) => {
      req.auth = { user: { role: 'ADMIN' } }
      next()
    }

    const router = createAdminDealerRouter(mockService as unknown as DealerService, mockAuth)
    app.use('/dealers', router)
    
    // Global error handler
    app.use((err: any, req: any, res: any, next: any) => {
      console.error(err)
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({
          success: false,
          error: err.code,
          message: err.message,
        })
      }
      // Assuming zod or generic error
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.code || 'INTERNAL_ERROR',
        message: err.message,
      })
    })
  })

  describe('GET /dealers', () => {
    it('should list dealers successfully', async () => {
      mockService.list.mockResolvedValue({
        items: [{ id: '1', displayName: 'Dealer 1' }],
        meta: { total: 1, page: 1, limit: 10 },
      } as any)

      const response = await request(app).get('/dealers').query({ limit: 10, page: 1 })
      
      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        message: 'Dealers retrieved.',
        data: [{ id: '1', displayName: 'Dealer 1' }],
        meta: { total: 1, page: 1, limit: 10 },
      })
      expect(mockService.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 10, page: 1 }))
    })

    it('should fail with invalid query', async () => {
      const response = await request(app).get('/dealers').query({ limit: -1 })
      expect(response.status).toBe(400)
    })
  })

  describe('GET /dealers/:id', () => {
    it('should get a dealer by id', async () => {
      mockService.get.mockResolvedValue({ id: '1', displayName: 'Dealer 1' } as any)

      const response = await request(app).get('/dealers/1')
      
      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        message: 'Dealer retrieved.',
        data: { id: '1', displayName: 'Dealer 1' },
      })
      expect(mockService.get).toHaveBeenCalledWith('1')
    })

    it('should handle service throwing AppError (e.g. not found)', async () => {
      mockService.get.mockRejectedValue(new AppError(404, 'DEALER_NOT_FOUND', 'Dealer not found.'))

      const response = await request(app).get('/dealers/1')
      expect(response.status).toBe(404)
      expect(response.body.error).toBe('DEALER_NOT_FOUND')
    })
  })

  describe('POST /dealers', () => {
    const validPayload = {
      displayName: 'Test Dealer',
      phoneNumber: '+1234567890',
    }

    it('should create a dealer', async () => {
      mockService.create.mockResolvedValue({ id: '1', ...validPayload } as any)

      const response = await request(app).post('/dealers').send(validPayload)
      
      expect(response.status).toBe(201)
      expect(response.body).toEqual({
        success: true,
        message: 'Dealer created.',
        data: { id: '1', ...validPayload },
      })
      expect(mockService.create).toHaveBeenCalledWith(expect.objectContaining(validPayload))
    })

    it('should fail with invalid payload', async () => {
      const response = await request(app).post('/dealers').send({ displayName: 'A' })
      expect(response.status).toBe(400)
    })
  })

  describe('PATCH /dealers/:id', () => {
    const validPayload = {
      displayName: 'Updated Dealer',
    }

    it('should update a dealer', async () => {
      mockService.update.mockResolvedValue({ id: '1', ...validPayload } as any)

      const response = await request(app).patch('/dealers/1').send(validPayload)
      
      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        message: 'Dealer updated.',
        data: { id: '1', ...validPayload },
      })
      expect(mockService.update).toHaveBeenCalledWith('1', expect.objectContaining(validPayload))
    })

    it('should handle not found error', async () => {
      mockService.update.mockRejectedValue(new AppError(404, 'DEALER_NOT_FOUND', 'Dealer not found.'))

      const response = await request(app).patch('/dealers/1').send(validPayload)
      expect(response.status).toBe(404)
    })
  })

  describe('DELETE /dealers/:id', () => {
    it('should delete a dealer', async () => {
      mockService.remove.mockResolvedValue(undefined)

      const response = await request(app).delete('/dealers/1')
      
      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        message: 'Dealer removed.',
        data: null,
      })
      expect(mockService.remove).toHaveBeenCalledWith('1')
    })

    it('should handle conflict error', async () => {
      mockService.remove.mockRejectedValue(new AppError(409, 'DEALER_HAS_OPEN_ORDERS', 'Reassign or finish this dealer’s open orders before removing the dealer.'))

      const response = await request(app).delete('/dealers/1')
      expect(response.status).toBe(409)
    })
  })
})
