import { Types } from 'mongoose'
import type {
  StoredImage,
  UploadAssetRecord,
  UploadAssetRepository,
} from '../domain/image-storage.js'
import { UploadAssetModel } from './upload-asset.model.js'

function optionalObjectIdToString(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value instanceof Types.ObjectId) return value.toHexString()
  return null
}

function mapAsset(document: Record<string, unknown>): UploadAssetRecord {
  return {
    id: String(document._id),
    ownerId: String(document.ownerId),
    publicId: String(document.publicId),
    url: String(document.url),
    mimeType: String(document.mimeType),
    bytes: Number(document.bytes),
    width: typeof document.width === 'number' ? document.width : null,
    height: typeof document.height === 'number' ? document.height : null,
    status: document.status as UploadAssetRecord['status'],
    productId: optionalObjectIdToString(document.productId),
    createdAt: document.createdAt as Date,
  }
}

export class MongooseUploadAssetRepository implements UploadAssetRepository {
  async createMany(ownerId: string, images: StoredImage[]): Promise<UploadAssetRecord[]> {
    const documents = await UploadAssetModel.insertMany(
      images.map((image) => ({
        ownerId,
        provider: 'CLOUDINARY',
        ...image,
        status: 'TEMPORARY',
      })),
    )
    return documents.map((document) => mapAsset(document.toObject()))
  }

  async findOwnedTemporary(ownerId: string, ids: string[]): Promise<UploadAssetRecord[]> {
    if (!ids.length) return []
    const documents = await UploadAssetModel.find({
      _id: { $in: ids },
      ownerId,
      status: 'TEMPORARY',
      deletedAt: null,
    }).lean<Record<string, unknown>[]>()
    return documents.map(mapAsset)
  }

  async attachToProduct(
    ownerId: string,
    ids: string[],
    productId: string,
  ): Promise<UploadAssetRecord[]> {
    if (!ids.length) return []
    const result = await UploadAssetModel.updateMany(
      { _id: { $in: ids }, ownerId, status: 'TEMPORARY', deletedAt: null },
      { $set: { status: 'ATTACHED', productId } },
    )
    if (result.modifiedCount !== ids.length) {
      throw new Error('Unable to attach all uploaded assets')
    }
    const documents = await UploadAssetModel.find({ _id: { $in: ids }, ownerId, productId })
      .sort({ createdAt: 1 })
      .lean<Record<string, unknown>[]>()
    return documents.map(mapAsset)
  }

  async releaseFromProduct(ownerId: string, ids: string[], productId: string): Promise<void> {
    if (!ids.length) return
    await UploadAssetModel.updateMany(
      { _id: { $in: ids }, ownerId, productId, status: 'ATTACHED' },
      { $set: { status: 'TEMPORARY', productId: null } },
    )
  }

  async findStaleTemporary(before: Date, limit: number): Promise<UploadAssetRecord[]> {
    const documents = await UploadAssetModel.find({
      status: 'TEMPORARY',
      deletedAt: null,
      createdAt: { $lt: before },
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean<Record<string, unknown>[]>()
    return documents.map(mapAsset)
  }

  async findOwnedTemporaryById(ownerId: string, id: string): Promise<UploadAssetRecord | null> {
    const document = await UploadAssetModel.findOne({
      _id: id,
      ownerId,
      status: 'TEMPORARY',
      deletedAt: null,
    }).lean<Record<string, unknown>>()
    return document ? mapAsset(document) : null
  }

  async markDeleted(id: string): Promise<void> {
    await UploadAssetModel.updateOne(
      { _id: id, status: 'TEMPORARY' },
      { $set: { status: 'DELETED', deletedAt: new Date() } },
    )
  }

  async markDeletedByPublicIds(publicIds: string[]): Promise<void> {
    if (!publicIds.length) return
    await UploadAssetModel.updateMany(
      { publicId: { $in: publicIds }, status: { $ne: 'DELETED' } },
      { $set: { status: 'DELETED', deletedAt: new Date() } },
    )
  }
}
