import { describe, expect, it } from 'vitest'
import type {
  ImageStorageProvider,
  StoredImage,
  UploadAssetRecord,
  UploadAssetRepository,
} from '../domain/image-storage.js'
import { ImageUploadService } from './image-upload.service.js'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z8u8AAAAASUVORK5CYII=',
  'base64',
)

class FakeStorage implements ImageStorageProvider {
  uploaded: Array<{ mimeType: string }> = []
  deleted: string[] = []
  async upload(input: { buffer: Buffer; mimeType: string; ownerId: string; originalName: string }) {
    this.uploaded.push({ mimeType: input.mimeType })
    return {
      publicId: `asset-${this.uploaded.length}`,
      url: `https://res.cloudinary.com/test/image/upload/asset-${this.uploaded.length}.png`,
      mimeType: input.mimeType,
      bytes: input.buffer.length,
      width: 1,
      height: 1,
    }
  }
  async delete(publicId: string) {
    this.deleted.push(publicId)
  }
}

class FakeAssets implements UploadAssetRepository {
  records: UploadAssetRecord[] = []
  async createMany(ownerId: string, images: StoredImage[]) {
    this.records = images.map((image, index) => ({
      id: `upload-${index + 1}`,
      ownerId,
      ...image,
      status: 'TEMPORARY' as const,
      productId: null,
      createdAt: new Date(0),
    }))
    return this.records
  }
  async findOwnedTemporary(ownerId: string, ids: string[]) {
    return this.records.filter(
      (record) =>
        record.ownerId === ownerId && ids.includes(record.id) && record.status === 'TEMPORARY',
    )
  }
  async attachToProduct(ownerId: string, ids: string[], productId: string) {
    const values = await this.findOwnedTemporary(ownerId, ids)
    values.forEach((value) => {
      value.status = 'ATTACHED'
      value.productId = productId
    })
    return values
  }
  async releaseFromProduct(ownerId: string, ids: string[], productId: string) {
    this.records
      .filter(
        (record) =>
          record.ownerId === ownerId && ids.includes(record.id) && record.productId === productId,
      )
      .forEach((record) => {
        record.status = 'TEMPORARY'
        record.productId = null
      })
  }
  async findStaleTemporary(before: Date, limit: number) {
    return this.records
      .filter((record) => record.status === 'TEMPORARY' && record.createdAt < before)
      .slice(0, limit)
  }
  async findOwnedTemporaryById(ownerId: string, id: string) {
    return (await this.findOwnedTemporary(ownerId, [id]))[0] ?? null
  }
  async markDeleted(id: string) {
    const record = this.records.find((value) => value.id === id)
    if (record) record.status = 'DELETED'
  }
  async markDeletedByPublicIds(publicIds: string[]) {
    this.records
      .filter((record) => publicIds.includes(record.publicId))
      .forEach((record) => {
        record.status = 'DELETED'
      })
  }
}

describe('ImageUploadService', () => {
  it('accepts a genuine PNG and stores only the server-detected MIME type', async () => {
    const storage = new FakeStorage()
    const service = new ImageUploadService(storage, new FakeAssets(), {
      maxBytes: 5_000_000,
      maxCount: 8,
    })

    const result = await service.uploadProductImages('user-1', [
      { buffer: png, mimetype: 'image/png', originalname: 'item.png', size: png.length },
    ])

    expect(result).toHaveLength(1)
    expect(result[0]?.mimeType).toBe('image/png')
    expect(storage.uploaded).toEqual([{ mimeType: 'image/png' }])
  })

  it('rejects a spoofed image before sending anything to Cloudinary', async () => {
    const storage = new FakeStorage()
    const service = new ImageUploadService(storage, new FakeAssets(), {
      maxBytes: 5_000_000,
      maxCount: 8,
    })

    await expect(
      service.uploadProductImages('user-1', [
        {
          buffer: Buffer.from('this is not an image'),
          mimetype: 'image/jpeg',
          originalname: 'fake.jpg',
          size: 20,
        },
      ]),
    ).rejects.toMatchObject({ code: 'INVALID_PRODUCT_IMAGE' })
    expect(storage.uploaded).toHaveLength(0)
  })
})
