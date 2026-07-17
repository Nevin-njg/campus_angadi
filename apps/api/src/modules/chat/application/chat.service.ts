import { fileTypeFromBuffer } from 'file-type'
import type { AuthUser, ChatMessage, ChatMessagesPage } from '@campusbaza/contracts'
import { AppError } from '../../../core/errors/app-error.js'
import { OrderModel } from '../../orders/infrastructure/order.models.js'
import {
  ChatMessageModel,
  type ChatMessageDocumentShape,
} from '../infrastructure/chat-message.model.js'
import type { CloudinaryAudioStorage } from '../infrastructure/cloudinary-audio-storage.js'
import { NotificationModel } from '../../notifications/infrastructure/notification.model.js'

const terminalStatuses = new Set(['COMPLETED', 'CANCELLED', 'REJECTED'])
// WebM/OGG containers may be detected as video even when they contain only an Opus audio track.
const audioTypes = new Set([
  'audio/webm',
  'video/webm',
  'audio/ogg',
  'video/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
])

export class ChatService {
  constructor(
    private readonly audioStorage: CloudinaryAudioStorage,
    private readonly maxAudioBytes: number,
  ) {}

  async list(
    orderId: string,
    actor: AuthUser,
    cursor?: string,
    limit = 50,
  ): Promise<ChatMessagesPage> {
    const order = await this.assertAccess(orderId, actor)
    const filter: Record<string, unknown> = { orderId }
    if (cursor) filter._id = { $lt: cursor }
    const documents = await ChatMessageModel.find(filter)
      .sort({ _id: -1 })
      .limit(Math.min(limit, 100))
    const messages = documents.reverse().map((document) => this.toContract(document))
    return {
      messages,
      nextCursor:
        documents.length === Math.min(limit, 100) ? String(documents[0]?._id ?? '') : null,
      assignedDealer: order.assignedDealerId
        ? { id: String(order.assignedDealerId), displayName: String(order.assignedDealerName) }
        : null,
      assignedModerator: order.assignedModeratorId
        ? {
            id: String(order.assignedModeratorId),
            displayName: String(order.assignedModeratorName),
          }
        : null,
      canChat: Boolean(order.assignedDealerId) && !terminalStatuses.has(String(order.status)),
    }
  }

  async sendText(
    orderId: string,
    actor: AuthUser,
    text: string,
    clientId?: string,
  ): Promise<ChatMessage> {
    await this.assertCanSend(orderId, actor)
    if (clientId) {
      const existing = await ChatMessageModel.findOne({ orderId, senderId: actor.id, clientId })
      if (existing) return this.toContract(existing)
    }
    const document = await ChatMessageModel.create({
      orderId,
      senderId: actor.id,
      senderKind: actor.role === 'USER' ? 'BUYER' : 'TEAM',
      senderName: this.senderName(actor),
      type: 'TEXT',
      text: text.trim(),
      clientId: clientId ?? null,
    })
    return this.toContract(document)
  }

  async sendAudio(
    orderId: string,
    actor: AuthUser,
    file: { buffer: Buffer; mimetype: string; size: number },
    durationSeconds: number,
  ): Promise<ChatMessage> {
    await this.assertCanSend(orderId, actor)
    if (file.size > this.maxAudioBytes) {
      throw new AppError(413, 'CHAT_AUDIO_TOO_LARGE', 'Voice notes must be smaller than 8 MB.')
    }
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 300) {
      throw new AppError(
        400,
        'INVALID_AUDIO_DURATION',
        'Voice notes can be up to five minutes long.',
      )
    }
    const detected = await fileTypeFromBuffer(file.buffer)
    if (!detected || !audioTypes.has(detected.mime) || !file.mimetype.startsWith('audio/')) {
      throw new AppError(
        400,
        'INVALID_CHAT_AUDIO',
        'Record a supported WebM, OGG, MP3 or M4A voice note.',
      )
    }
    const uploaded = await this.audioStorage.upload(orderId, file.buffer)
    const document = await ChatMessageModel.create({
      orderId,
      senderId: actor.id,
      senderKind: actor.role === 'USER' ? 'BUYER' : 'TEAM',
      senderName: this.senderName(actor),
      type: 'AUDIO',
      audioUrl: uploaded.url,
      audioPublicId: uploaded.publicId,
      audioDurationSeconds: durationSeconds,
    })
    return this.toContract(document)
  }

  async requestCall(orderId: string, actor: AuthUser): Promise<ChatMessage> {
    const order = await this.assertCanSend(orderId, actor)
    if (String(order.buyerId) !== actor.id)
      throw new AppError(403, 'CALL_REQUEST_BUYER_ONLY', 'Only the buyer can request a call.')
    const recent = await ChatMessageModel.findOne({
      orderId,
      senderId: actor.id,
      type: 'SYSTEM',
      text: 'Buyer requested an audio call from the Campus Angadi team.',
      createdAt: { $gte: new Date(Date.now() - 5 * 60_000) },
    })
    if (recent) return this.toContract(recent)
    const document = await ChatMessageModel.create({
      orderId,
      senderId: actor.id,
      senderKind: 'BUYER',
      senderName: this.senderName(actor),
      type: 'SYSTEM',
      text: 'Buyer requested an audio call from the Campus Angadi team.',
    })
    if (order.assignedModeratorId) {
      await NotificationModel.create({
        userId: order.assignedModeratorId,
        type: 'ORDER',
        title: 'Buyer requested a call',
        message: `${this.senderName(actor)} requested an audio call for order ${String(order.orderNumber)}.`,
        referenceType: 'ORDER',
        referenceId: orderId,
      })
    }
    return this.toContract(document)
  }

  async markRead(orderId: string, actor: AuthUser): Promise<void> {
    await this.assertAccess(orderId, actor)
    await ChatMessageModel.updateMany(
      { orderId, senderId: { $ne: actor.id }, readAt: null },
      { $set: { readAt: new Date() } },
    )
  }

  async getMessage(orderId: string, messageId: string, actor: AuthUser): Promise<ChatMessage> {
    await this.assertAccess(orderId, actor)
    const document = await ChatMessageModel.findOne({ _id: messageId, orderId })
    if (!document) throw new AppError(404, 'CHAT_MESSAGE_NOT_FOUND', 'Message not found.')
    return this.toContract(document)
  }

  async assertAccess(orderId: string, actor: AuthUser) {
    const order = await OrderModel.findById(orderId).select(
      'buyerId assignedDealerId assignedDealerName assignedModeratorId assignedModeratorName status orderNumber',
    )
    if (!order) throw new AppError(404, 'ORDER_NOT_FOUND', 'This order could not be found.')
    const isAdmin = actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN'
    const isAssignedModerator =
      actor.role === 'MODERATOR' && String(order.assignedModeratorId) === actor.id
    if (!isAdmin && !isAssignedModerator && String(order.buyerId) !== actor.id) {
      throw new AppError(403, 'CHAT_ACCESS_DENIED', 'You do not have access to this conversation.')
    }
    return order
  }

  async assertBuyer(orderId: string, actor: AuthUser) {
    const order = await this.assertAccess(orderId, actor)
    if (String(order.buyerId) !== actor.id)
      throw new AppError(403, 'BUYER_REQUIRED', 'Only the buyer can complete this call action.')
    return order
  }

  private async assertCanSend(orderId: string, actor: AuthUser) {
    const order = await this.assertAccess(orderId, actor)
    if (!order.assignedDealerId) {
      throw new AppError(
        409,
        'DEALER_NOT_ASSIGNED',
        'A Campus Angadi dealer must be assigned before chat starts.',
      )
    }
    if (terminalStatuses.has(String(order.status))) {
      throw new AppError(409, 'CHAT_CLOSED', 'This order conversation is closed.')
    }
    return order
  }

  private senderName(actor: AuthUser): string {
    return (
      actor.profile.displayName ??
      actor.profile.fullName ??
      actor.email.split('@')[0] ??
      'Campus user'
    )
  }

  private toContract(
    document: ChatMessageDocumentShape & { _id: unknown; createdAt: Date },
  ): ChatMessage {
    return {
      id: String(document._id),
      orderId: String(document.orderId),
      senderId: String(document.senderId),
      senderKind: document.senderKind,
      senderName: document.senderName,
      type: document.type,
      text: document.text ?? null,
      audioUrl: document.audioUrl ?? null,
      audioDurationSeconds: document.audioDurationSeconds ?? null,
      clientId: document.clientId ?? null,
      readAt: document.readAt ? document.readAt.toISOString() : null,
      createdAt: document.createdAt.toISOString(),
    }
  }
}
