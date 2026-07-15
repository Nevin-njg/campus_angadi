import { useEffect, type ReactNode } from 'react'
import { useAuthStore } from '../store/use-auth-store'

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const bootstrap = useAuthStore((state) => state.bootstrap)
  const status = useAuthStore((state) => state.status)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="app-loading" role="status" aria-live="polite">
        <div className="brand-loader">CA</div>
        <span>Preparing Campus Angaadi…</span>
      </div>
    )
  }

  return children
}
