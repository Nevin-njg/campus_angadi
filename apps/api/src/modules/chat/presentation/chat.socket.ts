import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { z } from 'zod'
import type { AuthUser } from '@campusbaza/contracts'
import type { Logger } from 'pino'
import { isOriginAllowed } from '../../../core/http/origin-policy.js'
import type { TokenService } from '../../../core/security/token-service.js'
import type { UserRepository } from '../../users/domain/user.js'
import { toAuthUser } from '../../users/domain/user.js'
import type { ChatService } from '../application/chat.service.js'

const joinSchema = z.object({ orderId: z.string().min(1) }).strict()
const sendSchema = z
  .object({
    orderId: z.string().min(1),
    text: z.string().trim().min(1).max(2000),
    clientId: z.string().min(1).max(100).optional(),
  })
  .strict()
const signalSchema = z.object({ orderId: z.string().min(1), signal: z.unknown() }).strict()
const announceSchema = z
  .object({ orderId: z.string().min(1), messageId: z.string().min(1) })
  .strict()
type Ack = (result: { ok: true; data?: unknown } | { ok: false; error: string }) => void
interface ClientEvents {
  'chat:join': (payload: unknown, ack?: Ack) => void
  'chat:send': (payload: unknown, ack?: Ack) => void
  'chat:typing': (payload: unknown) => void
  'chat:read': (payload: unknown) => void
  'chat:announce': (payload: unknown, ack?: Ack) => void
  'call:request': (payload: unknown, ack?: Ack) => void
  'call:offer': (payload: unknown, ack?: Ack) => void
  'call:answer': (payload: unknown, ack?: Ack) => void
  'call:ice': (payload: unknown, ack?: Ack) => void
  'call:end': (payload: unknown, ack?: Ack) => void
}
interface ServerEvents {
  'chat:presence': (payload: unknown) => void
  'chat:message': (payload: unknown) => void
  'chat:typing': (payload: unknown) => void
  'chat:read': (payload: unknown) => void
  'call:request': (payload: unknown) => void
  'call:offer': (payload: unknown) => void
  'call:answer': (payload: unknown) => void
  'call:ice': (payload: unknown) => void
  'call:end': (payload: unknown) => void
}
interface ChatSocketData {
  user?: AuthUser
}

export function attachChatSocket(
  server: HttpServer,
  dependencies: {
    chat: ChatService
    tokens: TokenService
    users: UserRepository
    logger: Logger
    allowedOrigins: string[]
    environment: 'development' | 'test' | 'production'
  },
) {
  const io = new Server<ClientEvents, ServerEvents, Record<string, never>, ChatSocketData>(server, {
    path: '/socket.io',
    cors: {
      origin(origin, callback) {
        if (
          !origin ||
          isOriginAllowed(origin, dependencies.allowedOrigins, dependencies.environment)
        ) {
          callback(null, true)
          return
        }
        callback(new Error('This origin is not allowed.'))
      },
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 32_000,
    pingInterval: 25_000,
    pingTimeout: 20_000,
  })

  io.use(async (socket, next) => {
    try {
      const token =
        typeof socket.handshake.auth.token === 'string' ? socket.handshake.auth.token : ''
      const payload = dependencies.tokens.verifyAccessToken(token)
      const value = await dependencies.users.findById(payload.sub)
      if (!value || value.user.status !== 'ACTIVE') throw new Error('Account is not active')
      socket.data.user = toAuthUser(value)
      next()
    } catch {
      next(new Error('Authentication required'))
    }
  })

  io.on('connection', (socket) => {
    const actor = socket.data.user
    if (!actor) {
      socket.disconnect(true)
      return
    }
    let messageWindowStarted = Date.now()
    let messageCount = 0

    socket.on('chat:join', async (payload: unknown, ack?: Ack) => {
      try {
        const { orderId } = joinSchema.parse(payload)
        await dependencies.chat.assertAccess(orderId, actor)
        await socket.join(room(orderId))
        socket.to(room(orderId)).emit('chat:presence', { userId: actor.id, online: true })
        ack?.({ ok: true })
      } catch (error) {
        ack?.({ ok: false, error: message(error) })
      }
    })

    socket.on('chat:send', async (payload: unknown, ack?: Ack) => {
      try {
        if (Date.now() - messageWindowStarted > 60_000) {
          messageWindowStarted = Date.now()
          messageCount = 0
        }
        if (++messageCount > 30) throw new Error('Please slow down before sending another message.')
        const input = sendSchema.parse(payload)
        const data = await dependencies.chat.sendText(
          input.orderId,
          actor,
          input.text,
          input.clientId,
        )
        io.to(room(input.orderId)).emit('chat:message', data)
        ack?.({ ok: true, data })
      } catch (error) {
        ack?.({ ok: false, error: message(error) })
      }
    })

    socket.on('chat:typing', async (payload: unknown) => {
      try {
        const { orderId } = joinSchema.parse(payload)
        await dependencies.chat.assertAccess(orderId, actor)
        socket.to(room(orderId)).emit('chat:typing', {
          userId: actor.id,
          name: actor.profile.displayName ?? 'Team member',
        })
      } catch {
        /* Invalid presence events are intentionally ignored. */
      }
    })

    socket.on('chat:read', async (payload: unknown) => {
      try {
        const { orderId } = joinSchema.parse(payload)
        await dependencies.chat.markRead(orderId, actor)
        socket
          .to(room(orderId))
          .emit('chat:read', { userId: actor.id, readAt: new Date().toISOString() })
      } catch {
        /* Invalid read receipts are intentionally ignored. */
      }
    })

    socket.on('chat:announce', async (payload: unknown, ack?: Ack) => {
      try {
        const input = announceSchema.parse(payload)
        const data = await dependencies.chat.getMessage(input.orderId, input.messageId, actor)
        io.to(room(input.orderId)).emit('chat:message', data)
        ack?.({ ok: true })
      } catch (error) {
        ack?.({ ok: false, error: message(error) })
      }
    })

    socket.on('call:request', async (payload: unknown, ack?: Ack) => {
      try {
        const { orderId } = joinSchema.parse(payload)
        const data = await dependencies.chat.requestCall(orderId, actor)
        io.to(room(orderId)).emit('chat:message', data)
        socket.to(room(orderId)).emit('call:request', {
          from: actor.id,
          name: actor.profile.displayName ?? actor.profile.fullName ?? 'Buyer',
        })
        ack?.({ ok: true, data })
      } catch (error) {
        ack?.({ ok: false, error: message(error) })
      }
    })

    for (const event of ['call:offer', 'call:answer', 'call:ice', 'call:end'] as const) {
      socket.on(event, async (payload: unknown, ack?: Ack) => {
        try {
          const input = signalSchema.parse(payload)
          const order = await dependencies.chat.assertAccess(input.orderId, actor)
          if (event === 'call:offer' && String(order.buyerId) === actor.id)
            throw new Error('Buyers can request a call; only the Campus Angadi team can start one.')
          if (event === 'call:answer' && String(order.buyerId) !== actor.id)
            throw new Error('Only the buyer can answer a team-initiated call.')
          socket.to(room(input.orderId)).emit(event, {
            signal: input.signal,
            from: actor.id,
            name: actor.profile.displayName ?? 'Campus Angadi team',
          })
          ack?.({ ok: true })
        } catch (error) {
          ack?.({ ok: false, error: message(error) })
        }
      })
    }

    socket.on('disconnecting', () => {
      for (const joinedRoom of socket.rooms) {
        if (joinedRoom.startsWith('order:'))
          socket.to(joinedRoom).emit('chat:presence', { userId: actor.id, online: false })
      }
    })
  })

  return io
}

function room(orderId: string) {
  return `order:${orderId}`
}
function message(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to complete the real-time action.'
}
