import type {
  CreateDealerInput,
  Dealer,
  DealerListQuery,
  PaginatedResult,
  UpdateDealerInput,
} from '@campusbaza/contracts'
import type { DealerRepository } from '../domain/dealer.js'
import { DealerModel } from './dealer.models.js'

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function mapDealer(document: Record<string, unknown>): Dealer {
  const hours = document.workingHours as Record<string, unknown>
  return {
    id: String(document._id),
    mediatorUserId: document.mediatorUserId ? String(document.mediatorUserId) : null,
    mediatorEmail: document.mediatorEmail ? String(document.mediatorEmail) : null,
    displayName: String(document.displayName),
    phoneNumber: String(document.phoneNumber),
    isActive: Boolean(document.isActive),
    maxOpenOrders: Number(document.maxOpenOrders),
    currentOpenOrders: Number(document.currentOpenOrders),
    completedOrders: Number(document.completedOrders),
    lastAssignedAt: document.lastAssignedAt
      ? (document.lastAssignedAt as Date).toISOString()
      : null,
    workingHours: {
      timeZone: String(hours.timeZone),
      startTime: String(hours.startTime),
      endTime: String(hours.endTime),
      days: (hours.days as number[]).map(Number),
    },
    notes: (document.notes as string | null) ?? null,
    createdAt: (document.createdAt as Date).toISOString(),
    updatedAt: (document.updatedAt as Date).toISOString(),
    deletedAt: document.deletedAt ? (document.deletedAt as Date).toISOString() : null,
  }
}

export class MongooseDealerRepository implements DealerRepository {
  async list(query: DealerListQuery): Promise<PaginatedResult<Dealer>> {
    const filter: Record<string, unknown> = { deletedAt: null }
    if (query.isActive !== undefined) filter.isActive = query.isActive
    if (query.q) {
      const regex = new RegExp(escapeRegex(query.q), 'i')
      filter.$or = [{ displayName: regex }, { phoneNumber: regex }]
    }
    const skip = (query.page - 1) * query.limit
    const [documents, total] = await Promise.all([
      DealerModel.find(filter)
        .sort({ isActive: -1, currentOpenOrders: 1, displayName: 1 })
        .skip(skip)
        .limit(query.limit)
        .lean<Record<string, unknown>[]>(),
      DealerModel.countDocuments(filter),
    ])
    return {
      items: documents.map(mapDealer),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    }
  }

  async findById(id: string): Promise<Dealer | null> {
    const document = await DealerModel.findOne({ _id: id, deletedAt: null }).lean<
      Record<string, unknown>
    >()
    return document ? mapDealer(document) : null
  }

  async findByMediatorUserId(userId: string): Promise<Dealer | null> {
    const document = await DealerModel.findOne({ mediatorUserId: userId, deletedAt: null }).lean<
      Record<string, unknown>
    >()
    return document ? mapDealer(document) : null
  }

  async create(input: CreateDealerInput & { mediatorEmail: string }): Promise<Dealer> {
    const document = await DealerModel.create({ ...input, notes: input.notes ?? null })
    return mapDealer(document.toObject())
  }

  async update(
    id: string,
    input: UpdateDealerInput & { mediatorEmail?: string },
  ): Promise<Dealer | null> {
    const document = await DealerModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: input },
      { new: true, runValidators: true },
    ).lean<Record<string, unknown>>()
    return document ? mapDealer(document) : null
  }

  async softDelete(id: string): Promise<'DELETED' | 'IN_USE' | 'NOT_FOUND'> {
    const dealer = await DealerModel.findOne({ _id: id, deletedAt: null }).lean<
      Record<string, unknown>
    >()
    if (!dealer) return 'NOT_FOUND'
    if (Number(dealer.currentOpenOrders) > 0) return 'IN_USE'
    const result = await DealerModel.updateOne(
      { _id: id, deletedAt: null, currentOpenOrders: 0 },
      { $set: { deletedAt: new Date(), isActive: false } },
    )
    return result.modifiedCount === 1 ? 'DELETED' : 'IN_USE'
  }
}
