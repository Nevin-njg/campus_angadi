import { Router, type RequestHandler } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { sendChatMessageInputSchema, type SendChatMessageInput } from '@campusbaza/contracts'
import { asyncHandler } from '../../../core/http/async-handler.js'
import { validateBody, validateParams } from '../../../core/middleware/validate.js'
import { AppError } from '../../../core/errors/app-error.js'
import type { ChatService } from '../application/chat.service.js'

const orderParams = z.object({ orderId: z.string().min(1) }).strict()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8_000_000, files: 1 },
})

export function createChatRouter(service: ChatService, authenticate: RequestHandler) {
  const router = Router()
  router.use(authenticate)
  router.get(
    '/orders/:orderId/messages',
    validateParams(orderParams),
    asyncHandler(async (request, response) => {
      const cursor =
        new URL(request.originalUrl, 'http://localhost').searchParams.get('cursor') ?? undefined
      const data = await service.list(String(request.params.orderId), request.auth!.user, cursor)
      response.json({ success: true, message: 'Conversation retrieved.', data })
    }),
  )
  router.post(
    '/orders/:orderId/messages',
    validateParams(orderParams),
    validateBody(sendChatMessageInputSchema),
    asyncHandler(async (request, response) => {
      const input = request.body as SendChatMessageInput
      const data = await service.sendText(
        String(request.params.orderId),
        request.auth!.user,
        input.text,
        input.clientId,
      )
      response.status(201).json({ success: true, message: 'Message sent.', data })
    }),
  )
  router.post(
    '/orders/:orderId/audio',
    validateParams(orderParams),
    upload.single('audio'),
    asyncHandler(async (request, response) => {
      if (!request.file)
        throw new AppError(400, 'CHAT_AUDIO_REQUIRED', 'Record a voice note first.')
      const body = request.body as Record<string, unknown>
      const duration = Number(body['durationSeconds'])
      const data = await service.sendAudio(
        String(request.params.orderId),
        request.auth!.user,
        request.file,
        duration,
      )
      response.status(201).json({ success: true, message: 'Voice note sent.', data })
    }),
  )
  router.post(
    '/orders/:orderId/read',
    validateParams(orderParams),
    asyncHandler(async (request, response) => {
      await service.markRead(String(request.params.orderId), request.auth!.user)
      response.json({ success: true, message: 'Conversation marked as read.', data: null })
    }),
  )
  return router
}
