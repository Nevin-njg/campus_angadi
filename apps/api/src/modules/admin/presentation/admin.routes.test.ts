import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createAdminCoreRouter } from './admin.routes.js'
import { errorHandler } from '../../../core/middleware/error-handler.js'
import type { AdminService } from '../application/admin.service.js'
import { AppError } from '../../../core/errors/app-error.js'

describe('Admin Routes', () => {
  let app: express.Express
  let mockAdminService: ReturnType<typeof vi.fn> & any

  beforeEach(() => {
    mockAdminService = {
      dashboard: vi.fn(),
      listUsers: vi.fn(),
      getUser: vi.fn(),
      updateUser: vi.fn(),
      sales: vi.fn(),
    }

    const mockAuthMiddleware = (req: any, _res: any, next: any) => {
      req.auth = { user: { id: 'admin1', role: 'SUPER_ADMIN' } }
      next()
    }

    const router = createAdminCoreRouter(
      mockAdminService as unknown as AdminService,
      mockAuthMiddleware,
    )

    app = express()
    app.use(express.json())
    app.use('/admin', router)
    app.use(errorHandler)
  })

  describe('GET /admin/dashboard', () => {
    it('should return dashboard data', async () => {
      const mockData = { totalUsers: 10, recentOrders: [] }
      mockAdminService.dashboard.mockResolvedValue(mockData)

      const response = await request(app).get('/admin/dashboard')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        message: 'Dashboard retrieved.',
        data: mockData,
      })
      expect(mockAdminService.dashboard).toHaveBeenCalledTimes(1)
    })

    it('should handle service errors', async () => {
      mockAdminService.dashboard.mockRejectedValue(
        new AppError(500, 'INTERNAL_ERROR', 'Service failed'),
      )

      const response = await request(app).get('/admin/dashboard')

      expect(response.status).toBe(500)
      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('INTERNAL_ERROR')
    })
  })

  describe('GET /admin/users', () => {
    it('should return paginated user list', async () => {
      const mockData = { items: [{ id: 'user1' }], meta: { page: 1, limit: 10, total: 1 } }
      mockAdminService.listUsers.mockResolvedValue(mockData)

      const response = await request(app).get('/admin/users?page=1&limit=10')

      if (response.status !== 200) console.log(response.body)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        message: 'Users retrieved.',
        data: mockData.items,
        meta: mockData.meta,
      })
      expect(mockAdminService.listUsers).toHaveBeenCalledWith({ page: 1, limit: 10 })
    })

    it('should reject invalid query params', async () => {
      const response = await request(app).get('/admin/users?page=invalid')

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /admin/users/:id', () => {
    it('should return user details', async () => {
      const mockUser = { id: 'user1', name: 'John Doe' }
      mockAdminService.getUser.mockResolvedValue(mockUser)

      const response = await request(app).get('/admin/users/user1')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        message: 'User retrieved.',
        data: mockUser,
      })
      expect(mockAdminService.getUser).toHaveBeenCalledWith('user1')
    })

    it('should handle not found error', async () => {
      mockAdminService.getUser.mockRejectedValue(
        new AppError(404, 'USER_NOT_FOUND', 'User not found.'),
      )

      const response = await request(app).get('/admin/users/unknown')

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('USER_NOT_FOUND')
    })
  })

  describe('PATCH /admin/users/:id', () => {
    it('should update user and return updated data', async () => {
      const updateData = { role: 'ADMIN', reason: 'Promote to admin' }
      const mockUpdatedUser = { id: 'user2', role: 'ADMIN' }
      mockAdminService.updateUser.mockResolvedValue(mockUpdatedUser)

      const response = await request(app).patch('/admin/users/user2').send(updateData)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        message: 'User updated.',
        data: mockUpdatedUser,
      })
      expect(mockAdminService.updateUser).toHaveBeenCalledWith(
        { id: 'admin1', role: 'SUPER_ADMIN' }, // Extracted from mock auth
        'user2',
        updateData,
      )
    })

    it('should validate request body', async () => {
      const response = await request(app).patch('/admin/users/user2').send({ role: 'INVALID_ROLE' })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /admin/sales', () => {
    it('should return sales analytics', async () => {
      const mockSalesData = { totalRevenue: 1000 }
      mockAdminService.sales.mockResolvedValue(mockSalesData)

      const response = await request(app).get('/admin/sales?period=30d')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        message: 'Sales analytics retrieved.',
        data: mockSalesData,
      })
      expect(mockAdminService.sales).toHaveBeenCalledWith({ period: '30d' }) // Assuming period is valid
    })

    it('should validate query params', async () => {
      const response = await request(app).get('/admin/sales?period=unknown_period')

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })
})
