export interface StoredImage {
  publicId: string
  url: string
  mimeType: string
  bytes: number
  width: number | null
  height: number | null
}

export interface ImageStorageProvider {
  upload(input: {
    buffer: Buffer
    mimeType: string
    ownerId: string
    originalName: string
  }): Promise<StoredImage>
  delete(publicId: string): Promise<void>
}

export interface UploadAssetRecord extends StoredImage {
  id: string
  ownerId: string
  status: 'TEMPORARY' | 'ATTACHED' | 'DELETED'
  productId: string | null
  createdAt: Date
}

export interface UploadAssetRepository {
  createMany(ownerId: string, images: StoredImage[]): Promise<UploadAssetRecord[]>
  findOwnedTemporary(ownerId: string, ids: string[]): Promise<UploadAssetRecord[]>
  attachToProduct(ownerId: string, ids: string[], productId: string): Promise<UploadAssetRecord[]>
  releaseFromProduct(ownerId: string, ids: string[], productId: string): Promise<void>
  findOwnedTemporaryById(ownerId: string, id: string): Promise<UploadAssetRecord | null>
  findStaleTemporary(before: Date, limit: number): Promise<UploadAssetRecord[]>
  markDeleted(id: string): Promise<void>
  markDeletedByPublicIds(publicIds: string[]): Promise<void>
}
