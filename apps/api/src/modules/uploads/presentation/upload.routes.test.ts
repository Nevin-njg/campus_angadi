import { describe, it, expect, vi, beforeEach } from 'vitest'
import express, { type NextFunction, type Request, type Response } from 'express'
import request from 'supertest'
import { createUploadRouter } from './upload.routes.js'
import type { ImageUploadService } from '../application/image-upload.service.js'
import type { RateLimitStoreFactory } from '../../../core/rate-limit/rate-limit-store.factory.js'
import { AppError } from '../../../core/errors/app-error.js'

describe('UploadRoutes', () => {
  let app: express.Express
  let mockService: ReturnType<typeof vi.mocked<ImageUploadService>>
  let mockAuthUser: any

  beforeEach(() => {
    mockService = {
      uploadProductImages: vi.fn(),
      removeTemporary: vi.fn(),
    } as any

    mockAuthUser = {
      id: 'user-1',
      role: 'USER',
      profileCompleted: true,
      canSell: true,
    }

    const mockAuthMiddleware = (req: Request, _res: Response, next: NextFunction) => {
      ;(req as any).auth = { user: mockAuthUser }
      next()
    }

    const mockStoreFactory: RateLimitStoreFactory = vi.fn(() => undefined)

    app = express()
    app.use(express.json())

    const router = createUploadRouter(
      mockService as unknown as ImageUploadService,
      mockAuthMiddleware,
      { maxBytes: 1024 * 1024, maxCount: 2 }, // 1MB, 2 files
      mockStoreFactory
    )

    app.use('/uploads', router)

    const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err instanceof AppError ? err.statusCode : 500
      res.status(status).json({
        success: false,
        code: err instanceof AppError ? err.code : 'INTERNAL_ERROR',
        message: err.message,
      })
    }
    app.use(errorHandler)
  })

  describe('POST /uploads/product-images', () => {
    it('should fail if user is USER and profile is not completed', async () => {
      mockAuthUser.profileCompleted = false

      const response = await request(app)
        .post('/uploads/product-images')
        .attach('images', Buffer.from('fake image data'), 'image1.png')

      expect(response.status).toBe(409)
      expect(response.body).toEqual({
        success: false,
        code: 'PROFILE_COMPLETION_REQUIRED',
        message: 'Complete your profile before uploading product images.',
      })
      expect(mockService.uploadProductImages).not.toHaveBeenCalled()
    })

    it('should fail if user is USER and cannot sell', async () => {
      mockAuthUser.canSell = false

      const response = await request(app)
        .post('/uploads/product-images')
        .attach('images', Buffer.from('fake image data'), 'image1.png')

      expect(response.status).toBe(403)
      expect(response.body).toEqual({
        success: false,
        code: 'SELLING_SUSPENDED',
        message: 'Your selling permission is suspended.',
      })
      expect(mockService.uploadProductImages).not.toHaveBeenCalled()
    })

    it('should fail if too many files are uploaded', async () => {
      const response = await request(app)
        .post('/uploads/product-images')
        .attach('images', Buffer.from('fake 1'), 'image1.png')
        .attach('images', Buffer.from('fake 2'), 'image2.png')
        .attach('images', Buffer.from('fake 3'), 'image3.png')

      expect(response.status).toBe(400)
      expect(response.body.code).toBe('PRODUCT_IMAGE_UPLOAD_FAILED')
      expect(mockService.uploadProductImages).not.toHaveBeenCalled()
    })

    it('should fail if file size exceeds limit', async () => {
      const largeBuffer = Buffer.alloc(2 * 1024 * 1024, 'a') // 2MB
      const response = await request(app)
        .post('/uploads/product-images')
        .attach('images', largeBuffer, 'image1.png')

      expect(response.status).toBe(400)
      expect(response.body.code).toBe('PRODUCT_IMAGE_UPLOAD_FAILED')
      expect(mockService.uploadProductImages).not.toHaveBeenCalled()
    })

    it('should successfully upload product images', async () => {
      const mockResult = [
        { id: 'img-1', url: 'http://example.com/img1.png' },
      ]
      mockService.uploadProductImages.mockResolvedValue(mockResult as any)

      const response = await request(app)
        .post('/uploads/product-images')
        .attach('images', Buffer.from('fake data'), 'image1.png')

      expect(response.status).toBe(201)
      expect(response.body).toEqual({
        success: true,
        message: 'Product images uploaded.',
        data: mockResult,
      })
      expect(mockService.uploadProductImages).toHaveBeenCalledWith('user-1', expect.any(Array))
      expect(mockService.uploadProductImages.mock.calls[0][1][0].originalname).toBe('image1.png')
    })
  })

  describe('DELETE /uploads/:id', () => {
    it('should successfully remove a temporary upload', async () => {
      mockService.removeTemporary.mockResolvedValue(undefined)

      const response = await request(app).delete('/uploads/temp-id-123')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        message: 'Temporary upload removed.',
        data: null,
      })
      expect(mockService.removeTemporary).toHaveBeenCalledWith('user-1', 'temp-id-123')
    })

    it('should handle errors from removeTemporary', async () => {
      mockService.removeTemporary.mockRejectedValue(new AppError(404, 'NOT_FOUND', 'Image not found'))

      const response = await request(app).delete('/uploads/temp-id-123')

      expect(response.status).toBe(404)
      expect(response.body).toEqual({
        success: false,
        code: 'NOT_FOUND',
        message: 'Image not found',
      })
    })
  })
})
