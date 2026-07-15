import express from 'express'
import request from 'supertest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createOrderRouter, createAdminOrderRouter } from './order.routes.js'
import type { OrderService } from '../application/order.service.js'
import { z } from 'zod'
import { errorHandler } from '../../../core/middleware/error-handler.js'

describe('Order Routes', () => {
  let app: express.Express
  let mockOrderService: vi.Mocked<OrderService>
  let mockAuthenticate: express.RequestHandler
  let mockStoreFactory: any

  beforeEach(() => {
    mockOrderService = {
      checkout: vi.fn(),
      listOwned: vi.fn(),
      continueOnWhatsapp: vi.fn(),
      getOwned: vi.fn(),
      cancelOwned: vi.fn(),
      listAdmin: vi.fn(),
      getAdmin: vi.fn(),
      assignDealer: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as vi.Mocked<OrderService>

    mockAuthenticate = (req, res, next) => {
      req.auth = {
        user: {
          id: 'user-123',
          role: 'ADMIN',
        },
      } as any
      next()
    }

    mockStoreFactory = vi.fn().mockReturnValue(undefined)

    app = express()
    app.use(express.json())

    const orderRouter = createOrderRouter(mockOrderService as any, mockAuthenticate, mockStoreFactory)
    app.use('/orders', orderRouter)

    const adminRouter = createAdminOrderRouter(mockOrderService as any, mockAuthenticate)
    app.use('/admin/orders', adminRouter)

    app.use(errorHandler as any)
  })

  describe('User Routes (/orders)', () => {
    describe('POST /orders/checkout', () => {
      it('should return 201 and checkout data on valid input', async () => {
        const body = {
          fullName: 'John Doe',
          phoneNumber: '1234567890',
          pickupLocation: 'Main Gate',
        }
        mockOrderService.checkout.mockResolvedValue({ checkoutGroupId: 'group-1' } as any)

        const res = await request(app).post('/orders/checkout').send(body)

        expect(res.status).toBe(201)
        expect(res.body.success).toBe(true)
        expect(res.body.data.checkoutGroupId).toBe('group-1')
        expect(mockOrderService.checkout).toHaveBeenCalledWith('user-123', body)
      })

      it('should return 400 on invalid input', async () => {
        const body = {
          fullName: 'J', // too short
        }
        const res = await request(app).post('/orders/checkout').send(body)

        expect(res.status).toBe(400)
        expect(res.body.success).toBe(false)
        expect(mockOrderService.checkout).not.toHaveBeenCalled()
      })
    })

    describe('GET /orders', () => {
      it('should list owned orders', async () => {
        mockOrderService.listOwned.mockResolvedValue({
          items: [{ id: 'order-1' }],
          meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
        } as any)

        const res = await request(app).get('/orders?page=1&limit=10')

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data).toHaveLength(1)
        expect(res.body.meta.total).toBe(1)
        expect(mockOrderService.listOwned).toHaveBeenCalledWith('user-123', { page: 1, limit: 10 })
      })
    })

    describe('POST /orders/:id/whatsapp', () => {
      it('should continue on whatsapp', async () => {
        mockOrderService.continueOnWhatsapp.mockResolvedValue({ url: 'http://wa.me/123' } as any)

        const res = await request(app).post('/orders/order-1/whatsapp')

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.url).toBe('http://wa.me/123')
        expect(mockOrderService.continueOnWhatsapp).toHaveBeenCalledWith('order-1', 'user-123')
      })

      it('should return 400 for invalid id', async () => {
        const res = await request(app).post('/orders//whatsapp') // This will match nothing or 404
        expect(res.status).toBe(404)
      })
    })

    describe('GET /orders/:id', () => {
      it('should get owned order', async () => {
        mockOrderService.getOwned.mockResolvedValue({ id: 'order-1' } as any)

        const res = await request(app).get('/orders/order-1')

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.id).toBe('order-1')
        expect(mockOrderService.getOwned).toHaveBeenCalledWith('order-1', 'user-123')
      })
    })

    describe('POST /orders/:id/cancel', () => {
      it('should cancel owned order', async () => {
        mockOrderService.cancelOwned.mockResolvedValue({ id: 'order-1', status: 'CANCELLED' } as any)

        const body = { reason: 'No longer needed' }
        const res = await request(app).post('/orders/order-1/cancel').send(body)

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(mockOrderService.cancelOwned).toHaveBeenCalledWith('order-1', 'user-123', body)
      })
    })
  })

  describe('Admin Routes (/admin/orders)', () => {
    describe('GET /admin/orders', () => {
      it('should list admin orders', async () => {
        mockOrderService.listAdmin.mockResolvedValue({
          items: [{ id: 'order-1' }],
          meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
        } as any)

        const res = await request(app).get('/admin/orders?page=1&limit=10')

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data).toHaveLength(1)
        expect(mockOrderService.listAdmin).toHaveBeenCalledWith({ page: 1, limit: 10 })
      })
    })

    describe('GET /admin/orders/:id', () => {
      it('should get admin order', async () => {
        mockOrderService.getAdmin.mockResolvedValue({ id: 'order-1' } as any)

        const res = await request(app).get('/admin/orders/order-1')

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(mockOrderService.getAdmin).toHaveBeenCalledWith('order-1')
      })
    })

    describe('PATCH /admin/orders/:id/dealer', () => {
      it('should update dealer assignment', async () => {
        mockOrderService.assignDealer.mockResolvedValue({ id: 'order-1' } as any)

        const body = { mode: 'MANUAL', reason: 'Admin assigned', dealerId: 'dealer-1' }
        const res = await request(app).patch('/admin/orders/order-1/dealer').send(body)

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(mockOrderService.assignDealer).toHaveBeenCalledWith('order-1', 'user-123', body)
      })

      it('should return 400 on invalid payload', async () => {
        const body = { mode: 'INVALID_MODE' }
        const res = await request(app).patch('/admin/orders/order-1/dealer').send(body)

        expect(res.status).toBe(400)
      })
    })

    describe('PATCH /admin/orders/:id/status', () => {
      it('should update order status', async () => {
        mockOrderService.updateStatus.mockResolvedValue({ id: 'order-1' } as any)

        const body = { status: 'PENDING', note: 'Looks good' }
        const res = await request(app).patch('/admin/orders/order-1/status').send(body)

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(mockOrderService.updateStatus).toHaveBeenCalledWith('order-1', 'user-123', body)
      })

      it('should return 400 on invalid status', async () => {
        const body = { status: 'INVALID_STATUS' }
        const res = await request(app).patch('/admin/orders/order-1/status').send(body)

        expect(res.status).toBe(400)
      })
    })
  })
})
