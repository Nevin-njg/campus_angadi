import { describe, expect, it } from 'vitest'
import type { ImageUploadService } from '../../uploads/application/image-upload.service.js'
import { ProductModel } from '../../products/infrastructure/product.models.js'
import { OrderModel } from '../../orders/infrastructure/order.models.js'
import { UserModel } from '../../users/infrastructure/user.models.js'
import { StoreModel } from '../infrastructure/store.model.js'
import { StoreService } from './store.service.js'

describe('StoreService administration', () => {
  it('removes a store from the marketplace and releases its seller account', async () => {
    const seller = await UserModel.create({
      email: 'seller@nitc.ac.in',
      role: 'SELLER',
      status: 'ACTIVE',
      emailVerified: true,
      canSell: true,
      profileCompleted: false,
    })
    const store = await StoreModel.create({
      name: 'Campus Supplies',
      slug: 'campus-supplies',
      sellerId: seller._id,
      commissionPercent: 5,
      status: 'ACTIVE',
    })
    const product = await ProductModel.create({
      title: 'Campus Notebook',
      slug: 'campus-notebook',
      description: 'A notebook sold by the campus store.',
      categoryId: store.categories.create({ name: 'Stationery', slug: 'stationery' })._id,
      price: 100,
      stock: 8,
      condition: 'NEW',
      productType: 'NEW',
      sellerType: 'ADMIN',
      storeId: store._id,
      sellerId: seller._id,
      status: 'APPROVED',
      published: true,
    })
    const service = new StoreService({} as ImageUploadService)

    await expect(service.remove(String(store._id), String(seller._id))).resolves.toEqual({
      id: String(store._id),
    })

    expect(await StoreModel.findById(store._id)).toBeNull()
    expect((await UserModel.findById(seller._id))?.role).toBe('USER')
    expect(await ProductModel.findById(product._id)).toMatchObject({
      status: 'DELETED',
      published: false,
    })
    expect((await ProductModel.findById(product._id))?.deletedAt).toBeInstanceOf(Date)
  })

  it('preserves a store when it still has an open order', async () => {
    const seller = await UserModel.create({
      email: 'open-order-seller@nitc.ac.in',
      role: 'SELLER',
      status: 'ACTIVE',
      emailVerified: true,
      canSell: true,
      profileCompleted: false,
    })
    const store = await StoreModel.create({
      name: 'Open Order Store',
      slug: 'open-order-store',
      sellerId: seller._id,
      commissionPercent: 5,
      status: 'ACTIVE',
    })
    await OrderModel.create({
      checkoutGroupId: 'checkout-open-order',
      orderNumber: 'CBZ-OPEN-ORDER',
      buyerId: seller._id,
      sellerType: 'ADMIN',
      sellerId: seller._id,
      storeId: store._id,
      status: 'PENDING',
      subtotal: 100,
      totalAmount: 100,
      itemCount: 1,
      fullName: 'Test Buyer',
      phoneNumber: '9999999999',
      pickupLocation: 'Main Gate',
    })
    const service = new StoreService({} as ImageUploadService)

    await expect(service.remove(String(store._id), String(seller._id))).rejects.toMatchObject({
      statusCode: 409,
      code: 'STORE_HAS_OPEN_ORDERS',
    })
    expect(await StoreModel.exists({ _id: store._id })).toBeTruthy()
    expect((await UserModel.findById(seller._id))?.role).toBe('SELLER')
  })
})
