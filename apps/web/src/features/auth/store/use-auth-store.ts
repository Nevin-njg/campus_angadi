import type { AuthUser } from '@campusbaza/contracts'
import { create } from 'zustand'
import { authApi } from '../api/auth.api'
import { setAccessToken, setUnauthorizedHandler } from '../../../lib/session'

interface AuthState {
  user: AuthUser | null
  status: 'idle' | 'loading' | 'authenticated' | 'anonymous'
  bootstrap: () => Promise<void>
  establishSession: (accessToken: string, user: AuthUser) => void
  updateUser: (user: AuthUser) => void
  logout: () => Promise<void>
  logoutAll: () => Promise<void>
  clearSession: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'idle',
  async bootstrap() {
    if (get().status !== 'idle') return
    set({ status: 'loading' })
    try {
      const result = await authApi.refresh()
      setAccessToken(result.accessToken)
      set({ user: result.user, status: 'authenticated' })
    } catch {
      setAccessToken(null)
      set({ user: null, status: 'anonymous' })
    }
  },
  establishSession(accessToken, user) {
    setAccessToken(accessToken)
    set({ user, status: 'authenticated' })
  },
  updateUser(user) {
    set({ user })
  },
  async logout() {
    try {
      await authApi.logout()
    } finally {
      get().clearSession()
    }
  },
  async logoutAll() {
    try {
      await authApi.logoutAll()
    } finally {
      get().clearSession()
    }
  },
  clearSession() {
    setAccessToken(null)
    set({ user: null, status: 'anonymous' })
  },
}))

setUnauthorizedHandler(() => useAuthStore.getState().clearSession())
