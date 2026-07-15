import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary'
import type { ImageStorageProvider, StoredImage } from '../domain/image-storage.js'

export class CloudinaryImageStorage implements ImageStorageProvider {
  constructor(
    cloudName: string,
    apiKey: string,
    apiSecret: string,
    private readonly folder: string,
  ) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    })
  }

  upload(input: {
    buffer: Buffer
    mimeType: string
    ownerId: string
    originalName: string
  }): Promise<StoredImage> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder: `${this.folder}/${input.ownerId}`,
          unique_filename: true,
          overwrite: false,
          use_filename: false,
          type: 'upload',
        },
        (error, result) => {
          if (error || !result) {
            reject(
              error instanceof Error
                ? error
                : new Error('Cloudinary did not return an upload result'),
            )
            return
          }
          resolve(this.mapResult(result, input.mimeType))
        },
      )
      stream.end(input.buffer)
    })
  }

  async delete(publicId: string): Promise<void> {
    const rawResult: unknown = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true,
    })
    const outcome =
      typeof rawResult === 'object' &&
      rawResult !== null &&
      'result' in rawResult &&
      typeof rawResult.result === 'string'
        ? rawResult.result
        : null
    if (!outcome || !['ok', 'not found'].includes(outcome)) {
      throw new Error(`Cloudinary delete failed: ${outcome ?? 'unknown response'}`)
    }
  }

  private mapResult(result: UploadApiResponse, mimeType: string): StoredImage {
    return {
      publicId: result.public_id,
      url: result.secure_url,
      mimeType,
      bytes: result.bytes,
      width: result.width ?? null,
      height: result.height ?? null,
    }
  }
}
