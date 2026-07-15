import { Router, type RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import multer from 'multer'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { AppError } from '../../../core/errors/app-error.js'
import {
  rateLimitStoreOption,
  type RateLimitStoreFactory,
} from '../../../core/rate-limit/rate-limit-store.factory.js'
import type { ImageUploadService } from '../application/image-upload.service.js'

export function createUploadRouter(
  service: ImageUploadService,
  authenticate: RequestHandler,
  options: { maxBytes: number; maxCount: number },
  storeFactory: RateLimitStoreFactory,
): Router {
  const router = Router()
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { files: options.maxCount, fileSize: options.maxBytes, fields: 4 },
  })
  const limiter = rateLimit({
    windowMs: 60 * 60_000,
    limit: 30,
    ...rateLimitStoreOption(storeFactory, 'uploads'),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })

  router.use(authenticate, limiter)
  router.post(
    '/product-images',
    (request, _response, next) => {
      const user = request.auth!.user
      if (user.role === 'USER' && !user.profileCompleted) {
        next(
          new AppError(
            409,
            'PROFILE_COMPLETION_REQUIRED',
            'Complete your profile before uploading product images.',
          ),
        )
        return
      }
      if (user.role === 'USER' && !user.canSell) {
        next(new AppError(403, 'SELLING_SUSPENDED', 'Your selling permission is suspended.'))
        return
      }
      next()
    },
    (request, response, next) => {
      upload.array('images', options.maxCount)(request, response, (error) => {
        if (error instanceof multer.MulterError) {
          next(new AppError(400, 'PRODUCT_IMAGE_UPLOAD_FAILED', error.message))
          return
        }
        next(error)
      })
    },
    asyncHandler(async (request, response) => {
      const files = (request.files ?? []) as Express.Multer.File[]
      const data = await service.uploadProductImages(request.auth!.user.id, files)
      response.status(201).json({ success: true, message: 'Product images uploaded.', data })
    }),
  )
  router.delete(
    '/:id',
    asyncHandler(async (request, response) => {
      await service.removeTemporary(request.auth!.user.id, String(request.params.id))
      response.json({ success: true, message: 'Temporary upload removed.', data: null })
    }),
  )
  return router
}
