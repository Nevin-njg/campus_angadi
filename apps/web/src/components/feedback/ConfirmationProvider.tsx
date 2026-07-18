import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ConfirmationContext, type ConfirmationOptions } from './confirmation-context'

type PendingConfirmation = ConfirmationOptions & {
  resolve: (value: boolean) => void
}

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
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
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    confirmRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        settle(false)
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const controls = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (!controls.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [pending, settle])

  return (
    <ConfirmationContext.Provider value={confirm}>
      {children}
      {pending ? (
        <div
          className="confirmation-backdrop"
          role="presentation"
          onMouseDown={() => settle(false)}
        >
          <section
            ref={dialogRef}
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
              <button type="button" className="button button-outline" onClick={() => settle(false)}>
                Cancel
              </button>
              <button
                type="button"
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
