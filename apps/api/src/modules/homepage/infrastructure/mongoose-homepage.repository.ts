import type { HomepageSectionKey } from '@campusbaza/contracts'
import { Types } from 'mongoose'
import type { HomepageRepository, HomepageSelectionRecord } from '../domain/homepage.js'
import { HomepageSelectionModel } from './homepage.model.js'

function map(document: Record<string, unknown>): HomepageSelectionRecord {
  return {
    key: document.key as HomepageSectionKey,
    productIds: ((document.productIds as unknown[]) ?? []).map(String),
    updatedAt: document.updatedAt as Date,
    updatedBy:
      typeof document.updatedBy === 'string'
        ? document.updatedBy
        : document.updatedBy instanceof Types.ObjectId
          ? document.updatedBy.toHexString()
          : null,
  }
}

export class MongooseHomepageRepository implements HomepageRepository {
  async list(): Promise<HomepageSelectionRecord[]> {
    const docs = await HomepageSelectionModel.find().lean<Record<string, unknown>[]>()
    return docs.map(map)
  }

  async find(key: HomepageSectionKey): Promise<HomepageSelectionRecord | null> {
    const doc = await HomepageSelectionModel.findOne({ key }).lean<Record<string, unknown>>()
    return doc ? map(doc) : null
  }

  async save(
    key: HomepageSectionKey,
    productIds: string[],
    adminId: string,
  ): Promise<HomepageSelectionRecord> {
    const doc = await HomepageSelectionModel.findOneAndUpdate(
      { key },
      { $set: { productIds, updatedBy: adminId } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean<Record<string, unknown>>()
    if (!doc) throw new Error('Unable to save homepage selection')
    return map(doc)
  }

  async reset(key: HomepageSectionKey, adminId: string): Promise<void> {
    await HomepageSelectionModel.findOneAndUpdate(
      { key },
      { $set: { productIds: [], updatedBy: adminId } },
      { upsert: true, setDefaultsOnInsert: true },
    )
  }
}
