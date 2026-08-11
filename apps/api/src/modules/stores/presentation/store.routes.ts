import { Router, type RequestHandler } from 'express'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { requireRoles } from '../../../core/middleware/authenticate.js'
import type { StoreService } from '../application/store.service.js'
import {
  getAdminStoreFinance,
  settleAdminStoreMonth,
} from '../application/store-finance.service.js'

function requestText(value: unknown, key: string): string {
  if (typeof value !== 'object' || value === null) return ''
  const entry = (value as Record<string, unknown>)[key]
  return typeof entry === 'string' ? entry : ''
}

export function createStoreRouter(service: StoreService) {
  const router = Router()
  router.get(
    '/',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Stores retrieved.',
        data: await service.list(requestText(request.query, 'q')),
      })
    }),
  )
  router.get(
    '/search',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Marketplace search completed.',
        data: await service.searchMarketplace(requestText(request.query, 'q')),
      })
    }),
  )
  router.get(
    '/:slug',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Store retrieved.',
        data: await service.browse(String(request.params.slug), requestText(request.query, 'q')),
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
      response.json({
        success: true,
        message: 'Stores retrieved.',
        data: await service.adminList(),
      })
    }),
  )
  router.get(
    '/:id/finance',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Store finance retrieved.',
        data: await getAdminStoreFinance(
          String(request.params.id),
          requestText(request.query, 'month'),
        ),
      })
    }),
  )
  router.post(
    '/:id/settlements/:month/settle',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Store month settled.',
        data: await settleAdminStoreMonth(
          String(request.params.id),
          String(request.params.month),
          request.auth!.user.id,
        ),
      })
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
  router.delete(
    '/:id',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Store removed from the marketplace.',
        data: await service.remove(String(request.params.id), request.auth!.user.id),
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
        data: await service.sellerProducts(request.auth!.user.id, requestText(request.query, 'q')),
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
        data: await service.updateProduct(
          request.auth!.user.id,
          String(request.params.id),
          request.body,
        ),
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
        data: await service.sellerOrders(
          request.auth!.user.id,
          requestText(request.query, 'status'),
        ),
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
          requestText(request.body, 'status'),
          requestText(request.body, 'note'),
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
