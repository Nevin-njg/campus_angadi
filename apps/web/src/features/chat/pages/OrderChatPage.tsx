import type { ChatMessage, ChatMessagesPage } from '@campusbaza/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Socket } from 'socket.io-client'
import {
  ChevronLeftIcon,
  MessageIcon,
  MicIcon,
  PhoneIcon,
  PhoneOffIcon,
  SendIcon,
  ShieldIcon,
} from '../../../components/ui/icons'
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton'
import { webEnv } from '../../../config/env'
import { useAuthStore } from '../../auth/store/use-auth-store'
import { chatApi } from '../api/chat.api'
import { createChatSocket } from '../lib/chat-socket'
import { useConfirmation } from '../../../components/feedback/ConfirmationProvider'

type CallState = 'idle' | 'calling' | 'incoming' | 'connected'

export function UserOrderChatPage() {
  return <OrderChatPage admin={false} />
}
export function AdminOrderChatPage() {
  return <OrderChatPage admin />
}

function OrderChatPage({ admin }: { admin: boolean }) {
  const { id = '' } = useParams()
  const user = useAuthStore((state) => state.user)
  const client = useQueryClient()
  const confirm = useConfirmation()
  const [text, setText] = useState('')
  const [typingName, setTypingName] = useState('')
  const [connection, setConnection] = useState<'connecting' | 'online' | 'offline'>('connecting')
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [mediaError, setMediaError] = useState('')
  const [callState, setCallState] = useState<CallState>('idle')
  const [callRequestPending, setCallRequestPending] = useState(false)
  const [incomingOffer, setIncomingOffer] = useState<RTCSessionDescriptionInit | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const listEndRef = useRef<HTMLDivElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingStartedRef = useRef(0)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const typingTimerRef = useRef<number | null>(null)

  const conversation = useQuery({
    queryKey: ['chat', id],
    queryFn: () => chatApi.messages(id),
    enabled: Boolean(id),
    refetchInterval: connection === 'online' ? false : 10_000,
  })

  const appendMessage = (message: ChatMessage) => {
    client.setQueryData<ChatMessagesPage>(['chat', id], (current) => {
      if (!current || current.messages.some((item) => item.id === message.id)) return current
      return { ...current, messages: [...current.messages, message] }
    })
  }

  const uploadAudio = useMutation({
    mutationFn: ({ blob, duration }: { blob: Blob; duration: number }) =>
      chatApi.sendAudio(id, blob, duration),
    onSuccess: (message) => {
      appendMessage(message)
      socketRef.current?.emit('chat:announce', { orderId: id, messageId: message.id })
    },
    onError: (error) => setMediaError(error.message),
  })

  useEffect(() => {
    if (!id) return
    const socket = createChatSocket()
    socketRef.current = socket
    socket.on('connect', () => {
      setConnection('online')
      socket.emit('chat:join', { orderId: id })
      socket.emit('chat:read', { orderId: id })
    })
    socket.on('disconnect', () => setConnection('offline'))
    socket.on('connect_error', () => setConnection('offline'))
    socket.on('chat:message', (message: ChatMessage) => appendMessage(message))
    socket.on('chat:typing', (payload: { name?: string }) => {
      setTypingName(payload.name ?? 'Someone')
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current)
      typingTimerRef.current = window.setTimeout(() => setTypingName(''), 1800)
    })
    socket.on('call:offer', (payload: { signal?: RTCSessionDescriptionInit }) => {
      if (!payload.signal) return
      setIncomingOffer(payload.signal)
      setCallState('incoming')
    })
    socket.on('call:answer', (payload: { signal?: RTCSessionDescriptionInit }) => {
      if (payload.signal && peerRef.current) {
        void peerRef.current
          .setRemoteDescription(payload.signal)
          .then(() => setCallState('connected'))
      }
    })
    socket.on('call:ice', (payload: { signal?: RTCIceCandidateInit }) => {
      if (payload.signal && peerRef.current) void peerRef.current.addIceCandidate(payload.signal)
    })
    socket.on('call:end', () => endCall(false))
    return () => {
      socket.disconnect()
      stopLocalMedia()
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current)
    }
    // The socket is intentionally recreated only when the order room changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [conversation.data?.messages.length, typingName])

  useEffect(() => {
    if (!recording) return
    const interval = window.setInterval(
      () => setRecordingSeconds(Math.floor((Date.now() - recordingStartedRef.current) / 1000)),
      500,
    )
    return () => window.clearInterval(interval)
  }, [recording])

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = text.trim()
    if (!value || !socketRef.current) return
    const clientId = crypto.randomUUID()
    setText('')
    socketRef.current.emit(
      'chat:send',
      { orderId: id, text: value, clientId },
      (result: { ok: boolean; error?: string }) => {
        if (!result.ok) {
          setText(value)
          setMediaError(result.error ?? 'Message could not be sent.')
        }
      },
    )
  }

  function handleTyping(value: string) {
    setText(value)
    if (value.trim()) socketRef.current?.emit('chat:typing', { orderId: id })
  }

  async function toggleRecording() {
    setMediaError('')
    if (recording) {
      recorderRef.current?.stop()
      setRecording(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find(
        (type) => MediaRecorder.isTypeSupported(type),
      )
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const duration = Math.max(
          1,
          Math.min(300, (Date.now() - recordingStartedRef.current) / 1000),
        )
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        stream.getTracks().forEach((track) => track.stop())
        uploadAudio.mutate({ blob, duration })
        setRecordingSeconds(0)
      }
      recorderRef.current = recorder
      recordingStartedRef.current = Date.now()
      recorder.start(500)
      setRecording(true)
    } catch {
      setMediaError('Microphone access is required to record a voice note.')
    }
  }

  async function ensurePeer() {
    if (peerRef.current) return peerRef.current
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    localStreamRef.current = stream
    const peer = new RTCPeerConnection({ iceServers: webEnv.webrtcIceServers })
    stream.getTracks().forEach((track) => peer.addTrack(track, stream))
    peer.onicecandidate = (event) => {
      if (event.candidate)
        socketRef.current?.emit('call:ice', { orderId: id, signal: event.candidate.toJSON() })
    }
    peer.ontrack = (event) => {
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = event.streams[0] ?? null
    }
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') setCallState('connected')
      if (['failed', 'disconnected', 'closed'].includes(peer.connectionState)) endCall(false)
    }
    peerRef.current = peer
    return peer
  }

  async function startCall() {
    if (!admin) return
    setMediaError('')
    try {
      const peer = await ensurePeer()
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      socketRef.current?.emit('call:offer', { orderId: id, signal: offer })
      setCallState('calling')
    } catch {
      setMediaError('Microphone access is required to start an audio call.')
    }
  }

  async function requestCall() {
    if (admin || callRequestPending || !socketRef.current) return
    if (!(await confirm({
      title: 'Request an audio call?',
      description: 'Your assigned Campus Angadi mediator will be notified and can call you from this conversation.',
      confirmLabel: 'Request call',
    }))) return
    setMediaError('')
    setCallRequestPending(true)
    socketRef.current.emit(
      'call:request',
      { orderId: id },
      (result: { ok: boolean; error?: string }) => {
        setCallRequestPending(false)
        if (!result.ok) setMediaError(result.error ?? 'The call request could not be sent.')
      },
    )
  }

  async function acceptCall() {
    if (!incomingOffer) return
    try {
      const peer = await ensurePeer()
      await peer.setRemoteDescription(incomingOffer)
      const answer = await peer.createAnswer()
      await peer.setLocalDescription(answer)
      socketRef.current?.emit('call:answer', { orderId: id, signal: answer })
      setIncomingOffer(null)
      setCallState('connected')
    } catch {
      setMediaError('The audio call could not be connected.')
      endCall(true)
    }
  }

  function stopLocalMedia() {
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    localStreamRef.current = null
    peerRef.current?.close()
    peerRef.current = null
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null
  }

  function endCall(notify = true) {
    if (notify) socketRef.current?.emit('call:end', { orderId: id, signal: null })
    stopLocalMedia()
    setIncomingOffer(null)
    setCallState('idle')
  }

  if (conversation.isLoading)
    return <LoadingSkeleton variant="detail" label="Loading conversation" />
  if (!conversation.data || conversation.isError)
    return (
      <div className="chat-error-state">
        <MessageIcon />
        <strong>Conversation unavailable</strong>
        <p>This order chat could not be opened.</p>
      </div>
    )

  const data = conversation.data
  const backTo = admin ? `/admin/orders/${id}` : `/account/orders/${id}`
  return (
    <div className="chat-page">
      <Link className="back-link" to={backTo}>
        <ChevronLeftIcon /> Back to order
      </Link>
      <div className="chat-shell">
        <header className="chat-header">
          <div className="chat-team-avatar">
            <ShieldIcon />
          </div>
          <div>
            <strong>{data.assignedDealer?.displayName ?? 'Campus Angadi team'}</strong>
            <span>
              <i className={connection} />{' '}
              {connection === 'online' ? 'Live support channel' : 'Reconnecting…'}
            </span>
          </div>
          {admin ? (
            <button
              className="chat-call-button"
              disabled={!data.canChat || callState !== 'idle'}
              onClick={() => void startCall()}
            >
              <PhoneIcon /> <span>Start audio call</span>
            </button>
          ) : (
            <button
              className="chat-call-button"
              disabled={!data.canChat || callRequestPending || callState !== 'idle'}
              onClick={() => void requestCall()}
            >
              <PhoneIcon /> <span>{callRequestPending ? 'Requesting…' : 'Request a call'}</span>
            </button>
          )}
        </header>

        <div className="chat-privacy-note">
          <ShieldIcon />
          <span>
            This is a private conversation between the buyer and Campus Angadi team. Sellers cannot
            access it.
          </span>
        </div>

        {callState !== 'idle' ? (
          <div className={`chat-call-banner ${callState}`}>
            <span className="call-pulse">
              <PhoneIcon />
            </span>
            <div>
              <strong>
                {callState === 'incoming'
                  ? 'Incoming audio call'
                  : callState === 'connected'
                    ? 'Audio call connected'
                    : admin ? 'Calling buyer…' : 'Connecting to Campus Angadi team…'}
              </strong>
              <small>Browser-to-browser encrypted audio</small>
            </div>
            {callState === 'incoming' ? (
              <button className="button button-primary" onClick={() => void acceptCall()}>
                Accept
              </button>
            ) : null}
            <button className="chat-end-call" onClick={() => endCall(true)}>
              <PhoneOffIcon /> {callState === 'incoming' ? 'Decline' : 'End'}
            </button>
          </div>
        ) : null}
        <audio ref={remoteAudioRef} autoPlay playsInline />

        <div className="chat-messages" aria-live="polite">
          <div className="chat-day-marker">
            <span>Order support</span>
          </div>
          {!data.messages.length ? (
            <div className="chat-welcome">
              <MessageIcon />
              <strong>Start your order conversation</strong>
              <p>
                Ask about availability, pickup, payment, or anything else. A Campus Angadi dealer
                will reply here.
              </p>
            </div>
          ) : null}
          {data.messages.map((message) => {
            const mine = message.senderId === user?.id
            return (
              <article className={`chat-bubble-row ${mine ? 'mine' : ''}`} key={message.id}>
                {!mine ? <div className="chat-small-avatar">CA</div> : null}
                <div className={`chat-bubble ${message.type.toLowerCase()}`}>
                  {!mine ? <strong>{message.senderName}</strong> : null}
                  {message.type === 'AUDIO' && message.audioUrl ? (
                    <div className="chat-audio">
                      <MicIcon />
                      <audio controls preload="metadata" src={message.audioUrl} />
                    </div>
                  ) : (
                    <p>{message.text}</p>
                  )}
                  <small>
                    {new Date(message.createdAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {mine && message.readAt ? ' · Read' : ''}
                  </small>
                </div>
              </article>
            )
          })}
          {typingName ? (
            <div className="chat-typing">
              <span />
              <span />
              <span /> {typingName} is typing
            </div>
          ) : null}
          <div ref={listEndRef} />
        </div>

        {!data.canChat ? (
          <div className="chat-locked">
            <ShieldIcon />{' '}
            {data.assignedDealer
              ? 'This conversation is closed because the order is complete or cancelled.'
              : 'Chat will open as soon as a Campus Angadi dealer is assigned.'}
          </div>
        ) : null}
        {mediaError || uploadAudio.isError ? (
          <div className="chat-inline-error">{mediaError || uploadAudio.error?.message}</div>
        ) : null}
        <form className="chat-composer" onSubmit={submit}>
          <button
            type="button"
            className={`chat-record-button ${recording ? 'recording' : ''}`}
            disabled={!data.canChat || uploadAudio.isPending}
            onClick={() => void toggleRecording()}
            aria-label={recording ? 'Stop recording' : 'Record voice note'}
          >
            <MicIcon />
            {recording ? <span>{recordingSeconds}s</span> : null}
          </button>
          <input
            value={text}
            onChange={(event) => handleTyping(event.target.value)}
            disabled={!data.canChat || recording}
            placeholder={recording ? 'Recording voice note…' : 'Message the Campus Angadi team'}
            maxLength={2000}
            aria-label="Chat message"
          />
          <button
            className="chat-send-button"
            disabled={!data.canChat || !text.trim() || connection !== 'online'}
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  )
}
