import type {
  CreateReportInput,
  PaginatedResult,
  Report,
  ReportListQuery,
  UpdateReportInput,
} from '@campusbaza/contracts'
import { Types } from 'mongoose'
import { AppError } from '../../../core/errors/app-error.js'
import { ProductModel } from '../../products/infrastructure/product.models.js'
import { UserModel, UserProfileModel } from '../../users/infrastructure/user.models.js'
import { ReportModel } from '../infrastructure/report.model.js'
import type { NotificationRepository } from '../../notifications/domain/notification.js'

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
async function labels(documents: Record<string, unknown>[]): Promise<Map<string, string>> {
  const userIds = documents.flatMap((d) => [
    String(d.reporterId),
    ...(String(d.targetType) === 'USER' ? [String(d.targetId)] : []),
  ])
  const productIds = documents
    .filter((d) => String(d.targetType) === 'PRODUCT')
    .map((d) => String(d.targetId))
  const [profiles, products] = await Promise.all([
    UserProfileModel.find({ userId: { $in: userIds } }).lean<Record<string, unknown>[]>(),
    ProductModel.find({ _id: { $in: productIds } })
      .select({ title: 1 })
      .lean<Record<string, unknown>[]>(),
  ])
  const map = new Map<string, string>()
  profiles.forEach((p) => {
    const name =
      typeof p.displayName === 'string' && p.displayName
        ? p.displayName
        : typeof p.fullName === 'string' && p.fullName
          ? p.fullName
          : 'Campus user'
    map.set(objectIdToString(p.userId) ?? '', name)
  })
  products.forEach((p) => map.set(String(p._id), String(p.title)))
  return map
}
function objectIdToString(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value instanceof Types.ObjectId) return value.toHexString()
  return null
}
async function mapReports(documents: Record<string, unknown>[]): Promise<Report[]> {
  const map = await labels(documents)
  return documents.map((d) => ({
    id: String(d._id),
    reporterId: String(d.reporterId),
    reporterName: map.get(String(d.reporterId)) ?? 'Campus user',
    targetType: d.targetType as Report['targetType'],
    targetId: String(d.targetId),
    targetLabel: map.get(String(d.targetId)) ?? 'Unavailable target',
    type: d.type as Report['type'],
    description: String(d.description),
    status: d.status as Report['status'],
    assignedAdminId: objectIdToString(d.assignedAdminId),
    resolution: (d.resolution as string | null) ?? null,
    createdAt: (d.createdAt as Date).toISOString(),
    updatedAt: (d.updatedAt as Date).toISOString(),
    resolvedAt: d.resolvedAt ? (d.resolvedAt as Date).toISOString() : null,
  }))
}

export class ReportService {
  constructor(private readonly notifications: NotificationRepository) {}
  async create(reporterId: string, input: CreateReportInput) {
    const target =
      input.targetType === 'PRODUCT'
        ? await ProductModel.exists({ _id: input.targetId, deletedAt: null })
        : await UserModel.exists({ _id: input.targetId, status: { $ne: 'DELETED' } })
    if (!target)
      throw new AppError(
        404,
        'REPORT_TARGET_NOT_FOUND',
        'The item you are reporting could not be found.',
      )
    if (input.targetType === 'USER' && input.targetId === reporterId)
      throw new AppError(400, 'CANNOT_REPORT_SELF', 'You cannot report your own account.')
    const duplicate = await ReportModel.exists({
      reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      status: { $in: ['OPEN', 'IN_REVIEW'] },
    })
    if (duplicate)
      throw new AppError(
        409,
        'REPORT_ALREADY_OPEN',
        'You already have an open report for this item.',
      )
    const document = await ReportModel.create({ reporterId, ...input })
    return (await mapReports([document.toObject()]))[0]!
  }
  async listMine(reporterId: string, query: ReportListQuery): Promise<PaginatedResult<Report>> {
    return this.list({ ...query }, { reporterId })
  }
  async listAdmin(query: ReportListQuery): Promise<PaginatedResult<Report>> {
    return this.list(query, {})
  }
  private async list(
    query: ReportListQuery,
    base: Record<string, unknown>,
  ): Promise<PaginatedResult<Report>> {
    const filter = { ...base } as Record<string, unknown>
    if (query.status) filter.status = query.status
    if (query.targetType) filter.targetType = query.targetType
    if (query.q) {
      const regex = new RegExp(escapeRegex(query.q), 'i')
      filter.$or = [{ description: regex }, { resolution: regex }]
    }
    const [docs, total] = await Promise.all([
      ReportModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean<Record<string, unknown>[]>(),
      ReportModel.countDocuments(filter),
    ])
    return {
      items: await mapReports(docs),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    }
  }
  async getAdmin(id: string) {
    const doc = await ReportModel.findById(id).lean<Record<string, unknown>>()
    if (!doc) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found.')
    return (await mapReports([doc]))[0]!
  }
  async update(id: string, actorId: string, input: UpdateReportInput) {
    const now = new Date()
    const doc = await ReportModel.findByIdAndUpdate(
      id,
      {
        $set: {
          ...input,
          assignedAdminId: input.assignedAdminId === undefined ? actorId : input.assignedAdminId,
          resolvedAt: ['RESOLVED', 'DISMISSED'].includes(input.status) ? now : null,
        },
      },
      { new: true },
    ).lean<Record<string, unknown>>()
    if (!doc) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found.')
    await this.notifications.sendToUser(String(doc.reporterId), {
      type: 'REPORT',
      title: 'Report updated',
      message: `Your report is now ${input.status.toLowerCase().replace('_', ' ')}.`,
      referenceType: 'REPORT',
      referenceId: id,
    })
    return (await mapReports([doc]))[0]!
  }
}
