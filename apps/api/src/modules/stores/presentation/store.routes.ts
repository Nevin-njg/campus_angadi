import { Router, type RequestHandler } from 'express'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { requireRoles } from '../../../core/middleware/authenticate.js'
import type { StoreService } from '../application/store.service.js'
import {
  getAdminStoreFinance,
  getSellerStoreFinance,
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
        data: await service.searchMarketplace(
          requestText(request.query, 'q'),
          requestText(request.query, 'department'),
        ),
      })
    }),
  )
  router.get(
    '/departments',
    asyncHandler(async (_request, response) => {
      response.json({
        success: true,
        message: 'Store departments retrieved.',
        data: await service.listDepartments(),
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
    '/departments',
    asyncHandler(async (_request, response) => {
      response.json({
        success: true,
        message: 'Store departments retrieved.',
        data: await service.adminListDepartments(),
      })
    }),
  )

  router.post(
    '/departments',
    asyncHandler(async (request, response) => {
      response.status(201).json({
        success: true,
        message: 'Store department created.',
        data: await service.createDepartment(request.body),
      })
    }),
  )

  router.patch(
    '/departments/:id',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Store department updated.',
        data: await service.updateDepartment(
          String(request.params.id),
          request.body,
        ),
      })
    }),
  )

  router.delete(
    '/departments/:id',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Store department deleted.',
        data: await service.removeDepartment(String(request.params.id)),
      })
    }),
  )

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
    '/finance',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Store finance retrieved.',
        data: await getSellerStoreFinance(
          request.auth!.user.id,
          requestText(request.query, 'month'),
        ),
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
    '/categories/reorder',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Categories reordered.',
        data: await service.reorderCategories(request.auth!.user.id, request.body),
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
  router.delete(
    '/categories/:id',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Category deleted.',
        data: await service.deleteCategory(
          request.auth!.user.id,
          String(request.params.id),
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
  router.post(
    '/orders/:id/decision',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Order decision saved.',
        data: await service.decideOrder(
          request.auth!.user.id,
          String(request.params.id),
          requestText(request.body, 'decision'),
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
  router.get(
    '/offers',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Offers retrieved.',
        data: await service.sellerOffers(request.auth!.user.id),
      })
    }),
  )
  router.post(
    '/offers',
    asyncHandler(async (request, response) => {
      response.status(201).json({
        success: true,
        message: 'Offer created.',
        data: await service.createOffer(request.auth!.user.id, request.body),
      })
    }),
  )
  router.patch(
    '/offers/:id',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Offer updated.',
        data: await service.updateOffer(
          request.auth!.user.id,
          String(request.params.id),
          request.body,
        ),
      })
    }),
  )
  router.delete(
    '/offers/:id',
    asyncHandler(async (request, response) => {
      response.json({
        success: true,
        message: 'Offer deleted.',
        data: await service.deleteOffer(
          request.auth!.user.id,
          String(request.params.id),
        ),
      })
    }),
  )

  return router
}
