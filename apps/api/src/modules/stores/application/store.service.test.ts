import { describe, expect, it } from 'vitest'
import type { ImageUploadService } from '../../uploads/application/image-upload.service.js'
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
    const service = new StoreService({} as ImageUploadService)

    await expect(service.remove(String(store._id), String(seller._id))).resolves.toEqual({
      id: String(store._id),
    })

    expect((await StoreModel.findById(store._id))?.status).toBe('ARCHIVED')
    expect((await UserModel.findById(seller._id))?.role).toBe('USER')
  })
})
