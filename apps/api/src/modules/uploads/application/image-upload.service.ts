import { fileTypeFromBuffer } from 'file-type'
import type { UploadedImageAsset } from '@campusbaza/contracts'
import { AppError } from '../../../core/errors/app-error.js'
import type {
  ImageStorageProvider,
  UploadAssetRecord,
  UploadAssetRepository,
} from '../domain/image-storage.js'

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export interface IncomingImageFile {
  buffer: Buffer
  mimetype: string
  originalname: string
  size: number
}

export class ImageUploadService {
  constructor(
    private readonly storage: ImageStorageProvider,
    private readonly assets: UploadAssetRepository,
    private readonly options: { maxBytes: number; maxCount: number },
  ) {}

  async uploadProductImages(
    ownerId: string,
    files: IncomingImageFile[],
  ): Promise<UploadedImageAsset[]> {
    if (!files.length) {
      throw new AppError(400, 'PRODUCT_IMAGES_REQUIRED', 'Choose at least one product image.')
    }
    if (files.length > this.options.maxCount) {
      throw new AppError(
        400,
        'TOO_MANY_PRODUCT_IMAGES',
        `You can upload at most ${this.options.maxCount} images.`,
      )
    }

    const validated: Array<IncomingImageFile & { detectedMimeType: string }> = []
    for (const file of files) {
      if (file.size > this.options.maxBytes) {
        throw new AppError(
          400,
          'PRODUCT_IMAGE_TOO_LARGE',
          `Each image must be smaller than ${Math.floor(this.options.maxBytes / 1_000_000)} MB.`,
        )
      }
      const detected = await fileTypeFromBuffer(file.buffer)
      if (!detected || !allowedMimeTypes.has(detected.mime)) {
        throw new AppError(
          400,
          'INVALID_PRODUCT_IMAGE',
          'Only genuine JPEG, PNG and WebP images are accepted.',
        )
      }
      if (!allowedMimeTypes.has(file.mimetype)) {
        throw new AppError(400, 'INVALID_PRODUCT_IMAGE', 'Unsupported product image type.')
      }
      validated.push({ ...file, detectedMimeType: detected.mime })
    }

    const uploaded: Awaited<ReturnType<ImageStorageProvider['upload']>>[] = []
    try {
      for (const file of validated) {
        uploaded.push(
          await this.storage.upload({
            buffer: file.buffer,
            mimeType: file.detectedMimeType,
            ownerId,
            originalName: file.originalname,
          }),
        )
      }
      const records = await this.assets.createMany(ownerId, uploaded)
      return records.map((record) => this.toContract(record))
    } catch (error) {
      await Promise.allSettled(uploaded.map((image) => this.storage.delete(image.publicId)))
      throw error
    }
  }

  async assertOwnedTemporary(ownerId: string, ids: string[]): Promise<UploadAssetRecord[]> {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length !== ids.length) {
      throw new AppError(
        400,
        'DUPLICATE_IMAGE_UPLOAD',
        'The same uploaded image was selected twice.',
      )
    }
    const records = await this.assets.findOwnedTemporary(ownerId, uniqueIds)
    if (records.length !== uniqueIds.length) {
      throw new AppError(
        400,
        'INVALID_IMAGE_UPLOAD',
        'One or more images are unavailable or do not belong to your account.',
      )
    }
    return records
  }

  attachToProduct(ownerId: string, ids: string[], productId: string) {
    return this.assets.attachToProduct(ownerId, ids, productId)
  }

  releaseFromProduct(ownerId: string, ids: string[], productId: string) {
    return this.assets.releaseFromProduct(ownerId, ids, productId)
  }

  async cleanupStaleTemporary(before: Date, limit: number): Promise<number> {
    const assets = await this.assets.findStaleTemporary(before, limit)
    let deleted = 0
    for (const asset of assets) {
      try {
        await this.storage.delete(asset.publicId)
        await this.assets.markDeleted(asset.id)
        deleted += 1
      } catch {
        // Leave the record temporary so a later cleanup run can retry provider deletion.
      }
    }
    return deleted
  }

  async removeTemporary(ownerId: string, id: string): Promise<void> {
    const asset = await this.assets.findOwnedTemporaryById(ownerId, id)
    if (!asset) throw new AppError(404, 'UPLOAD_NOT_FOUND', 'Temporary upload not found.')
    await this.storage.delete(asset.publicId)
    await this.assets.markDeleted(id)
  }

  async deleteStoredImages(publicIds: string[]): Promise<void> {
    const values = publicIds.filter(Boolean)
    await Promise.allSettled(values.map((publicId) => this.storage.delete(publicId)))
    await this.assets.markDeletedByPublicIds(values)
  }

  private toContract(record: UploadAssetRecord): UploadedImageAsset {
    return {
      id: record.id,
      url: record.url,
      width: record.width,
      height: record.height,
      bytes: record.bytes,
      mimeType: record.mimeType,
      createdAt: record.createdAt.toISOString(),
    }
  }
}
