import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

type ConfirmationOptions = {
  title: string
  description: string
  confirmLabel?: string
  tone?: 'default' | 'danger'
}

type PendingConfirmation = ConfirmationOptions & { resolve: (value: boolean) => void }
const ConfirmationContext = createContext<((options: ConfirmationOptions) => Promise<boolean>) | null>(null)

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const confirm = useCallback(
    (options: ConfirmationOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  )
  const settle = useCallback((value: boolean) => {
    setPending((current) => {
      current?.resolve(value)
      return null
    })
  }, [])
  useEffect(() => {
    if (!pending) return
    confirmRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && settle(false)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pending, settle])

  return (
    <ConfirmationContext.Provider value={confirm}>
      {children}
      {pending ? (
        <div className="confirmation-backdrop" role="presentation" onMouseDown={() => settle(false)}>
          <section
            className="confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirmation-title"
            aria-describedby="confirmation-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="section-kicker">Please confirm</span>
            <h2 id="confirmation-title">{pending.title}</h2>
            <p id="confirmation-description">{pending.description}</p>
            <div className="confirmation-actions">
              <button className="button button-outline" onClick={() => settle(false)}>Cancel</button>
              <button
                ref={confirmRef}
                className={`button ${pending.tone === 'danger' ? 'button-danger' : 'button-primary'}`}
                onClick={() => settle(true)}
              >
                {pending.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </ConfirmationContext.Provider>
  )
}

export function useConfirmation() {
  const value = useContext(ConfirmationContext)
  if (!value) throw new Error('useConfirmation must be used inside ConfirmationProvider')
  return value
}
