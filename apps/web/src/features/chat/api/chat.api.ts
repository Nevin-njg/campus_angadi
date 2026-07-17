import type { ChatMessage, ChatMessagesPage, SendChatMessageInput } from '@campusbaza/contracts'
import { apiRequest } from '../../../lib/api-client'

export const chatApi = {
  messages: (orderId: string, cursor?: string) =>
    apiRequest<ChatMessagesPage>(
      `/chat/orders/${orderId}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    ),
  send: (orderId: string, input: SendChatMessageInput) =>
    apiRequest<ChatMessage>(`/chat/orders/${orderId}/messages`, { method: 'POST', body: input }),
  sendAudio: (orderId: string, audio: Blob, durationSeconds: number) => {
    const body = new FormData()
    body.append('audio', audio, `voice-${Date.now()}.webm`)
    body.append('durationSeconds', String(durationSeconds))
    return apiRequest<ChatMessage>(`/chat/orders/${orderId}/audio`, { method: 'POST', body })
  },
  markRead: (orderId: string) =>
    apiRequest<null>(`/chat/orders/${orderId}/read`, { method: 'POST' }),
}
