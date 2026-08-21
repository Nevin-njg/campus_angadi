import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'

import {
  sellerAuthApi,
  SellerAuthError,
  type SellerSession,
} from './auth-api'
import { sellerSessionStorage } from './session-storage'

type SessionContextValue = {
  loading: boolean
  session: SellerSession | null
  verifyOtp: (email: string, code: string) => Promise<void>
  refreshSession: (staleAccessToken?: string) => Promise<SellerSession | null>
  logout: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

function isTransientAuthError(error: unknown) {
  return (
    error instanceof SellerAuthError &&
    (error.code === 'NETWORK_ERROR' || error.code === 'INVALID_RESPONSE')
  )
}

export function SellerSessionProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<SellerSession | null>(null)

  // Keep the newest tokens outside React render timing so simultaneous API
  // pollers do not rotate the same refresh token more than once.
  const latestSessionRef = useRef<SellerSession | null>(null)
  const refreshPromiseRef = useRef<Promise<SellerSession | null> | null>(null)

  const commitSession = useCallback(async (nextSession: SellerSession) => {
    latestSessionRef.current = nextSession
    await sellerSessionStorage.save(nextSession)
    setSession(nextSession)
  }, [])

  const clearSession = useCallback(async () => {
    latestSessionRef.current = null
    await sellerSessionStorage.clear()
    setSession(null)
  }, [])

  const refreshSession = useCallback(
    async (staleAccessToken?: string): Promise<SellerSession | null> => {
      // Another request may already have refreshed the token while this
      // caller was waiting on a 401. Reuse that newer session immediately.
      const latest = latestSessionRef.current
      if (latest && staleAccessToken && latest.accessToken !== staleAccessToken) {
        return latest
      }

      if (refreshPromiseRef.current) {
        return refreshPromiseRef.current
      }

      const refreshPromise = (async () => {
        const refreshToken = await sellerSessionStorage.getRefreshToken()

        if (!refreshToken) {
          await clearSession()
          return null
        }

        try {
          const refreshed = await sellerAuthApi.refresh(refreshToken)
          await commitSession(refreshed)
          return refreshed
        } catch (error) {
          // A flaky USB/network response must not log the seller out. Clear
          // credentials only when the backend actually rejects the session.
          if (!isTransientAuthError(error)) {
            await clearSession()
          }
          throw error
        }
      })()

      refreshPromiseRef.current = refreshPromise

      try {
        return await refreshPromise
      } finally {
        if (refreshPromiseRef.current === refreshPromise) {
          refreshPromiseRef.current = null
        }
      }
    },
    [clearSession, commitSession],
  )

  useEffect(() => {
    let active = true

    async function restoreSession() {
      try {
        const refreshed = await refreshSession()
        if (!active || !refreshed) return
      } catch {
        // refreshSession keeps stored credentials for transient transport
        // failures and clears them only for a genuinely invalid session.
      } finally {
        if (active) setLoading(false)
      }
    }

    void restoreSession()

    return () => {
      active = false
    }
  }, [refreshSession])

  async function verifyOtp(email: string, code: string) {
    const result = await sellerAuthApi.verifyOtp(email, code)
    await commitSession(result)
  }

  async function logout() {
    const refreshToken = await sellerSessionStorage.getRefreshToken()

    try {
      if (refreshToken) {
        await sellerAuthApi.logout(refreshToken)
      }
    } finally {
      await clearSession()
    }
  }

  const value = useMemo(
    () => ({
      loading,
      session,
      verifyOtp,
      refreshSession,
      logout,
    }),
    [loading, session, refreshSession],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSellerSession() {
  const context = useContext(SessionContext)

  if (!context) {
    throw new Error('useSellerSession must be used inside SellerSessionProvider')
  }

  return context
}
