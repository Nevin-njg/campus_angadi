import { useEffect, useRef, useState } from 'react'

const GOOGLE_SCRIPT_ID = 'google-identity-services'
const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client'

let scriptPromise: Promise<void> | null = null
let initializedClientId: string | null = null
let activeCredentialHandler: ((response: GoogleCredentialResponse) => void) | null = null

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener(
        'error',
        () => reject(new Error('Google Sign-In failed to load.')),
        {
          once: true,
        },
      )
      return
    }

    const script = document.createElement('script')
    script.id = GOOGLE_SCRIPT_ID
    script.src = GOOGLE_SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Sign-In failed to load.'))
    document.head.appendChild(script)
  }).catch((error) => {
    scriptPromise = null
    throw error
  })

  return scriptPromise
}

interface GoogleSignInButtonProps {
  clientId: string
  disabled?: boolean
  onCredential: (credential: string) => void
  onError: (message: string) => void
}

export function GoogleSignInButton({
  clientId,
  disabled = false,
  onCredential,
  onError,
}: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    if (!clientId) {
      onError('Google Sign-In is not configured. Add VITE_GOOGLE_CLIENT_ID.')
      return () => {
        active = false
      }
    }

    void loadGoogleIdentityScript()
      .then(() => {
        if (!active || !containerRef.current || !window.google?.accounts.id) return

        const credentialHandler = (response: GoogleCredentialResponse) => {
          if (!active) return
          if (!response.credential) {
            onError('Google did not return a sign-in credential. Please try again.')
            return
          }
          onCredential(response.credential)
        }
        activeCredentialHandler = credentialHandler

        if (initializedClientId !== clientId) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response) => {
              activeCredentialHandler?.(response)
            },
            auto_select: false,
            cancel_on_tap_outside: true,
            use_fedcm_for_prompt: true,
          })
          initializedClientId = clientId
        }

        containerRef.current.replaceChildren()
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: Math.min(360, Math.max(240, containerRef.current.clientWidth || 320)),
        })
        setReady(true)
      })
      .catch(() => {
        if (active) onError('Unable to load Google Sign-In. Check your connection and try again.')
      })

    return () => {
      active = false
      activeCredentialHandler = null
    }
  }, [clientId, onCredential, onError])

  return (
    <div
      className={`google-sign-in-container${disabled ? ' is-disabled' : ''}`}
      aria-busy={!ready || disabled}
    >
      <div ref={containerRef} />
      {!ready ? <span className="google-sign-in-loading">Loading Google Sign-In…</span> : null}
      {disabled ? <div className="google-sign-in-blocker" aria-hidden="true" /> : null}
    </div>
  )
}
