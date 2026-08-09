import type { AccessRequestInput, ReviewAccessRequestInput } from '@campusbaza/contracts'
import { isEmailDomainAllowed, normalizeEmail } from '@campusbaza/validation'
import { AppError } from '../../../core/errors/app-error.js'
import type { UserRepository } from '../../users/domain/user.js'
import type { EmailSender } from '../domain/otp.js'
import type { GoogleIdentityVerifier } from '../domain/google-identity.js'
import { AccessRequestModel } from '../infrastructure/access-request.model.js'
import { Types } from 'mongoose'

interface AccessRequestViewSource {
  _id: unknown
  email: string
  fullName: string
  affiliation: string
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewedBy?: unknown
  reviewNote?: string | null
  createdAt: Date
  updatedAt: Date
}

const view = (document: AccessRequestViewSource) => ({
  id: String(document._id),
  email: document.email,
  fullName: document.fullName,
  affiliation: document.affiliation,
  reason: document.reason,
  status: document.status,
  reviewedBy:
    typeof document.reviewedBy === 'string'
      ? document.reviewedBy
      : document.reviewedBy instanceof Types.ObjectId
        ? document.reviewedBy.toHexString()
        : null,
  reviewNote: document.reviewNote ?? null,
  createdAt: document.createdAt.toISOString(),
  updatedAt: document.updatedAt.toISOString(),
})

export class AccessRequestService {
  constructor(
    private readonly google: GoogleIdentityVerifier,
    private readonly users: UserRepository,
    private readonly email: EmailSender,
    private readonly allowedDomains: readonly string[],
    private readonly appName: string,
  ) {}

  async request(input: AccessRequestInput) {
    let identity
    try {
      identity = await this.google.verify(input.credential)
    } catch {
      throw new AppError(401, 'GOOGLE_TOKEN_INVALID', 'Google identity could not be verified.')
    }
    if (!identity.emailVerified) {
      throw new AppError(403, 'GOOGLE_EMAIL_NOT_VERIFIED', 'Your Google email must be verified.')
    }
    const email = normalizeEmail(identity.email)
    if (isEmailDomainAllowed(email, this.allowedDomains)) {
      throw new AppError(409, 'ACCESS_REQUEST_NOT_REQUIRED', 'This email can sign in directly.')
    }
    if (await this.users.findByEmail(email)) {
      throw new AppError(409, 'ACCESS_ALREADY_APPROVED', 'This email can already sign in.')
    }
    const document = await AccessRequestModel.findOneAndUpdate(
      { email },
      {
        $set: {
          fullName: input.fullName,
          affiliation: input.affiliation,
          reason: input.reason,
          status: 'PENDING',
          reviewedBy: null,
          reviewNote: null,
          reviewedAt: null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean()
    return view(document)
  }

  async list(status = '') {
    const documents = await AccessRequestModel.find(status ? { status } : {})
      .sort({ createdAt: -1 })
      .lean()
    return documents.map((document) => view(document as unknown as AccessRequestViewSource))
  }

  async review(id: string, actorId: string, input: ReviewAccessRequestInput) {
    const request = await AccessRequestModel.findById(id)
    if (!request) throw new AppError(404, 'ACCESS_REQUEST_NOT_FOUND', 'Request not found.')
    if (request.status !== 'PENDING') {
      throw new AppError(409, 'ACCESS_REQUEST_REVIEWED', 'This request was already reviewed.')
    }
    if (input.decision === 'APPROVED') {
      await this.users.findOrCreateByEmail(request.email, 'USER')
    }
    request.status = input.decision
    request.reviewedBy = new Types.ObjectId(actorId)
    request.reviewNote = input.note ?? null
    request.reviewedAt = new Date()
    await request.save()
    if (input.decision === 'APPROVED') {
      await this.email.sendAccessApproved({ recipient: request.email, appName: this.appName })
    }
    return view(request.toObject())
  }
}
