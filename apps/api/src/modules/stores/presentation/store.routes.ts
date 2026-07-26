import { Router, type RequestHandler } from 'express'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { requireRoles } from '../../../core/middleware/authenticate.js'
import type { StoreService } from '../application/store.service.js'

export function createStoreRouter(service: StoreService) {
  const router = Router()
  router.get(
    '/',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Stores retrieved.',
        data: await service.list(String(request.query.q || '')),
      })
    }),
  )
  router.get(
    '/search',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Marketplace search completed.',
        data: await service.searchMarketplace(String(request.query.q || '')),
      })
    }),
  )
  router.get(
    '/:slug',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Store retrieved.',
        data: await service.browse(String(request.params.slug), String(request.query.q || '')),
      })
    }),
  )
  return router
}

export function createAdminStoreRouter(service: StoreService, authenticate: RequestHandler) {
  const router = Router()
  router.use(authenticate, requireRoles('ADMIN', 'SUPER_ADMIN'))
  router.get(
    '/',
    asyncHandler(async (_request, response) => {
      response.json({ success: true, message: 'Stores retrieved.', data: await service.adminList() })
    }),
  )
  router.post(
    '/',
    asyncHandler(async (request, response) => {
      response.status(201).json({
        success: true,
        message: 'Store created.',
        data: await service.create(request.body),
      })
    }),
  )
  router.patch(
    '/:id',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Store updated.',
        data: await service.update(String(request.params.id), request.body),
      })
    }),
  )
  return router
}

export function createSellerStoreRouter(service: StoreService, authenticate: RequestHandler) {
  const router = Router()
  router.use(authenticate, requireRoles('SELLER'))

  router.get(
    '/',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Seller store retrieved.',
        data: await service.sellerStore(request.auth!.user.id),
      })
    }),
  )
  router.get(
    '/products',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Products retrieved.',
        data: await service.sellerProducts(request.auth!.user.id, String(request.query.q || '')),
      })
    }),
  )
  router.post(
    '/products',
    asyncHandler(async (request, response) => {
      response.status(201).json({
        success: true,
        message: 'Product created.',
        data: await service.createProduct(request.auth!.user.id, request.body),
      })
    }),
  )
  router.patch(
    '/products/:id',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Product updated.',
        data: await service.updateProduct(request.auth!.user.id, String(request.params.id), request.body),
      })
    }),
  )
  router.delete(
    '/products/:id',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Product deleted.',
        data: await service.deleteProduct(request.auth!.user.id, String(request.params.id)),
      })
    }),
  )
  router.post(
    '/categories',
    asyncHandler(async (request, response) => {
      response.status(201).json({
        success: true,
        message: 'Category created.',
        data: await service.addCategory(request.auth!.user.id, request.body),
      })
    }),
  )
  router.patch(
    '/categories/:id',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Category updated.',
        data: await service.updateCategory(
          request.auth!.user.id,
          String(request.params.id),
          request.body,
        ),
      })
    }),
  )
  router.get(
    '/orders',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Orders retrieved.',
        data: await service.sellerOrders(request.auth!.user.id, String(request.query.status || '')),
      })
    }),
  )
  router.patch(
    '/orders/:id/status',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Order status updated.',
        data: await service.updateOrderStatus(
          request.auth!.user.id,
          String(request.params.id),
          String(request.body.status || ''),
          String(request.body.note || ''),
        ),
      })
    }),
  )
  router.post(
    '/offers',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Offer applied.',
        data: await service.applyOffer(request.auth!.user.id, request.body),
      })
    }),
  )

  return router
}
