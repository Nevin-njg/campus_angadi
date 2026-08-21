import type {
  DynamicHomepageSectionType,
  HomepageSectionKey,
} from '@campusbaza/contracts'
import { Types } from 'mongoose'
import type {
  CreateDynamicHomepageSectionRecord,
  DynamicHomepageRepository,
  DynamicHomepageSectionRecord,
  HomepageRepository,
  HomepageSelectionRecord,
  UpdateDynamicHomepageSectionRecord,
} from '../domain/homepage.js'
import {
  HomepageSectionModel,
  HomepageSelectionModel,
} from './homepage.model.js'

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


function mapDynamicSection(
  document: Record<string, unknown>,
): DynamicHomepageSectionRecord {
  const objectId = (value: unknown): string | null => {
    if (typeof value === 'string') return value
    if (value instanceof Types.ObjectId) return value.toHexString()
    return value ? String(value) : null
  }

  return {
    id: String(document._id),
    type: document.type as DynamicHomepageSectionType,
    title: String(document.title),
    enabled: Boolean(document.enabled),
    displayOrder: Number(document.displayOrder),
    limit: Number(document.limit),
    departmentId: objectId(document.departmentId),
    productIds: ((document.productIds as unknown[]) ?? []).map(String),
    storeIds: ((document.storeIds as unknown[]) ?? []).map(String),
    createdAt: document.createdAt as Date,
    updatedAt: document.updatedAt as Date,
    updatedBy: objectId(document.updatedBy),
  }
}

export class MongooseDynamicHomepageRepository
  implements DynamicHomepageRepository
{
  async list(): Promise<DynamicHomepageSectionRecord[]> {
    const documents = await HomepageSectionModel.find()
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean<Record<string, unknown>[]>()

    return documents.map(mapDynamicSection)
  }

  async findById(
    id: string,
  ): Promise<DynamicHomepageSectionRecord | null> {
    const document = await HomepageSectionModel.findById(id)
      .lean<Record<string, unknown>>()

    return document ? mapDynamicSection(document) : null
  }

  async create(
    input: CreateDynamicHomepageSectionRecord,
  ): Promise<DynamicHomepageSectionRecord> {
    const document = await HomepageSectionModel.create(input)

    return mapDynamicSection(
      document.toObject() as unknown as Record<string, unknown>,
    )
  }

  async update(
    id: string,
    input: UpdateDynamicHomepageSectionRecord,
  ): Promise<DynamicHomepageSectionRecord | null> {
    const document = await HomepageSectionModel.findByIdAndUpdate(
      id,
      { $set: input },
      {
        new: true,
        runValidators: true,
      },
    ).lean<Record<string, unknown>>()

    return document ? mapDynamicSection(document) : null
  }

  async remove(id: string): Promise<boolean> {
    const result = await HomepageSectionModel.deleteOne({ _id: id })

    return result.deletedCount > 0
  }
}
