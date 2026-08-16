import { useEffect, useRef, useState } from 'react'

interface OrderPushPayload {
  title: string
  body: string
  url: string
  tag?: string
  orderId?: string
}

let audioContext: AudioContext | null = null

async function playOrderChime() {
  try {
    audioContext ??= new AudioContext()

    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    const context = audioContext
    const now = context.currentTime

    const gain = context.createGain()
    gain.connect(context.destination)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7)

    const first = context.createOscillator()
    first.type = 'sine'
    first.frequency.setValueAtTime(880, now)
    first.connect(gain)
    first.start(now)
    first.stop(now + 0.24)

    const second = context.createOscillator()
    second.type = 'sine'
    second.frequency.setValueAtTime(1174.66, now + 0.22)
    second.connect(gain)
    second.start(now + 0.22)
    second.stop(now + 0.7)
  } catch {
    // Some browsers can block audio until the user has interacted with the page.
    // The visual alert still remains available.
  }
}

function isOrderPushPayload(value: unknown): value is OrderPushPayload {
  if (!value || typeof value !== 'object') return false

  const payload = value as Record<string, unknown>

  return (
    typeof payload.title === 'string' &&
    typeof payload.body === 'string' &&
    typeof payload.url === 'string'
  )
}

export function OrderPushAlert() {
  const [notification, setNotification] =
    useState<OrderPushPayload | null>(null)

  const dismissTimer = useRef<number | null>(null)

  useEffect(() => {
    // Prepare audio after the first normal interaction with Campus Angadi.
    // This makes foreground notification sounds more reliable.
    const prepareAudio = () => {
      try {
        audioContext ??= new AudioContext()

        if (audioContext.state === 'suspended') {
          void audioContext.resume()
        }
      } catch {
        // Visual notifications still work if audio is unavailable.
      }
    }

    window.addEventListener('pointerdown', prepareAudio, { once: true })
    window.addEventListener('keydown', prepareAudio, { once: true })

    return () => {
      window.removeEventListener('pointerdown', prepareAudio)
      window.removeEventListener('keydown', prepareAudio)
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const handleMessage = (event: MessageEvent) => {
      const message = event.data as {
        type?: unknown
        payload?: unknown
      }

      if (
        message.type !== 'CAMPUS_ANGADI_ORDER_PUSH' ||
        !isOrderPushPayload(message.payload)
      ) {
        return
      }

      setNotification(message.payload)
      void playOrderChime()

      if (dismissTimer.current !== null) {
        window.clearTimeout(dismissTimer.current)
      }

      dismissTimer.current = window.setTimeout(() => {
        setNotification(null)
        dismissTimer.current = null
      }, 12_000)
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)

      if (dismissTimer.current !== null) {
        window.clearTimeout(dismissTimer.current)
      }
    }
  }, [])

  if (!notification) return null

  return (
    <div className="fixed inset-x-4 top-4 z-[200] mx-auto max-w-md sm:left-auto sm:right-5 sm:top-5 sm:mx-0">
      <div className="overflow-hidden rounded-2xl border border-amber-500/30 bg-[#202020] shadow-2xl shadow-black/50">
        <div className="h-1 bg-amber-500" />

        <div className="p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-amber-500/20 bg-white shadow-lg shadow-amber-500/10">
              <img
                src="/brand/campus-angadi-logo.png"
                alt="Campus Angadi"
                className="h-10 w-10 object-contain"
              />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-400">
                    Campus Angadi
                  </span>

                  <h2 className="mt-1 text-base font-extrabold text-white">
                    {notification.title}
                  </h2>
                </div>

                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => setNotification(null)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white"
                >
                  ×
                </button>
              </div>

              <p className="mt-2 text-sm leading-6 text-zinc-400">
                {notification.body}
              </p>

              <button
                type="button"
                onClick={() => {
                  setNotification(null)
                  window.location.assign(notification.url)
                }}
                className="mt-4 inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-extrabold text-zinc-950 transition hover:bg-amber-400"
              >
                View order →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
