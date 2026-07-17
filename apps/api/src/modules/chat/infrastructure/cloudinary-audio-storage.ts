import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary'

export class CloudinaryAudioStorage {
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

  upload(
    orderId: string,
    buffer: Buffer,
  ): Promise<{ url: string; publicId: string; bytes: number }> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder: `${this.folder}/chat-audio/${orderId}`,
          unique_filename: true,
          overwrite: false,
          type: 'upload',
        },
        (error, result) => {
          if (error || !result) {
            reject(error instanceof Error ? error : new Error('Audio upload failed'))
            return
          }
          const uploaded: UploadApiResponse = result
          resolve({ url: uploaded.secure_url, publicId: uploaded.public_id, bytes: uploaded.bytes })
        },
      )
      stream.end(buffer)
    })
  }
}
