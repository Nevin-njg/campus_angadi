import { describe, it, expect, vi, beforeEach } from 'vitest'
import express, { type Request, type Response, type NextFunction } from 'express'
import request from 'supertest'
import { createNotificationRouter, createAdminNotificationRouter } from './notification.routes.js'
import type { NotificationService } from '../application/notification.service.js'

describe('Notification Routes', () => {
  let app: express.Express
  let mockService: vitest.Mocked<NotificationService>

  beforeEach(() => {
    mockService = {
      list: vi.fn(),
      unreadCount: vi.fn(),
      markRead: vi.fn(),
      markAllRead: vi.fn(),
      send: vi.fn(),
    } as any

    const mockAuthenticate = (req: Request, res: Response, next: NextFunction) => {
      // @ts-expect-error Mocking auth object
      req.auth = { user: { id: 'user-1', role: 'USER' } }
      next()
    }

    const mockAdminAuthenticate = (req: Request, res: Response, next: NextFunction) => {
      // @ts-expect-error Mocking auth object
      req.auth = { user: { id: 'admin-1', role: 'ADMIN' } }
      next()
    }

    app = express()
    app.use(express.json())
    app.use('/notifications', createNotificationRouter(mockService as any, mockAuthenticate))
    app.use(
      '/admin/notifications',
      createAdminNotificationRouter(mockService as any, mockAdminAuthenticate),
    )

    // Add error handler so Express doesn't print HTML errors
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message,
        details: err.details,
        code: err.code,
      })
    })
  })

  describe('GET /notifications', () => {
    it('should return a list of notifications', async () => {
      mockService.list.mockResolvedValue({
        items: [{ id: 'notif-1', title: 'Test' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      } as any)

      const response = await request(app)
        .get('/notifications')
        .query({ page: '1', limit: '10' })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(1)
      expect(response.body.meta.total).toBe(1)
      expect(mockService.list).toHaveBeenCalledWith('user-1', { page: 1, limit: 10 })
    })

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/notifications')
        .query({ page: 'invalid' })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('GET /notifications/unread-count', () => {
    it('should return the unread count', async () => {
      mockService.unreadCount.mockResolvedValue(5)

      const response = await request(app).get('/notifications/unread-count').expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.count).toBe(5)
      expect(mockService.unreadCount).toHaveBeenCalledWith('user-1')
    })
  })

  describe('PATCH /notifications/read-all', () => {
    it('should mark all as read', async () => {
      mockService.markAllRead.mockResolvedValue(undefined)

      const response = await request(app).patch('/notifications/read-all').expect(200)

      expect(response.body.success).toBe(true)
      expect(mockService.markAllRead).toHaveBeenCalledWith('user-1')
    })
  })

  describe('PATCH /notifications/:id/read', () => {
    it('should mark a specific notification as read', async () => {
      mockService.markRead.mockResolvedValue({ id: 'notif-1', read: true } as any)

      const response = await request(app).patch('/notifications/notif-1/read').expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBe('notif-1')
      expect(mockService.markRead).toHaveBeenCalledWith('user-1', 'notif-1')
    })
  })

  describe('POST /admin/notifications', () => {
    it('should send a notification', async () => {
      mockService.send.mockResolvedValue(10)

      const payload = {
        title: 'System update',
        message: 'Downtime expected',
        audience: 'ALL',
        type: 'SYSTEM',
      }

      const response = await request(app).post('/admin/notifications').send(payload).expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.recipientCount).toBe(10)
      expect(mockService.send).toHaveBeenCalledWith(payload)
    })

    it('should return 400 for invalid body', async () => {
      const response = await request(app)
        .post('/admin/notifications')
        .send({ title: 'A' }) // too short, missing message, etc
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.code).toBe('VALIDATION_ERROR')
    })

    it('should block non-admin users', async () => {
      const nonAdminApp = express()
      nonAdminApp.use(express.json())

      const mockNonAdminAuthenticate = (req: Request, res: Response, next: NextFunction) => {
        // @ts-expect-error Mocking auth object
        req.auth = { user: { id: 'user-1', role: 'USER' } }
        next()
      }

      nonAdminApp.use(
        '/admin/notifications',
        createAdminNotificationRouter(mockService as any, mockNonAdminAuthenticate),
      )

      nonAdminApp.use((err: any, req: Request, res: Response, next: NextFunction) => {
        res.status(err.statusCode || 500).json({
          success: false,
          code: err.code,
        })
      })

      const response = await request(nonAdminApp)
        .post('/admin/notifications')
        .send({ title: 'Test', message: 'Hello', audience: 'ALL' })
        .expect(403)

      expect(response.body.code).toBe('INSUFFICIENT_PERMISSION')
    })
  })
})
