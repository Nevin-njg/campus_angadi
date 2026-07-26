import { io, type Socket } from 'socket.io-client'
import { webEnv } from '../../../config/env'
import { getAccessToken } from '../../../lib/session'

export function createChatSocket(): Socket {
  const origin = webEnv.apiUrl.startsWith('http')
    ? new URL(webEnv.apiUrl).origin
    : window.location.origin
  return io(origin, {
    path: '/socket.io',
    auth: { token: getAccessToken() },
    transports: ['websocket', 'polling'],
    reconnectionDelayMax: 5000,
  })
}
