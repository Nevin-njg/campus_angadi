import type {
  AuthUser,
  RequestOtpInput,
  UpdateProfileInput,
  VerifyOtpInput,
} from '@campusbaza/contracts'
import { apiRequest } from '../../../lib/api-client'

export const authApi = {
  requestOtp(input: RequestOtpInput) {
    return apiRequest<{
      maskedEmail: string
      expiresInSeconds: number
      resendAfterSeconds: number
    }>('/auth/otp/request', { method: 'POST', body: input, retryOnUnauthorized: false })
  },
  verifyOtp(input: VerifyOtpInput) {
    return apiRequest<{ accessToken: string; user: AuthUser }>('/auth/otp/verify', {
      method: 'POST',
      body: input,
      retryOnUnauthorized: false,
    })
  },
  refresh() {
    return apiRequest<{ accessToken: string; user: AuthUser }>('/auth/refresh', {
      method: 'POST',
      retryOnUnauthorized: false,
    })
  },
  me() {
    return apiRequest<{ user: AuthUser }>('/auth/me')
  },
  logout() {
    return apiRequest<null>('/auth/logout', { method: 'POST', retryOnUnauthorized: false })
  },
  logoutAll() {
    return apiRequest<null>('/auth/logout-all', { method: 'POST' })
  },
  getProfile() {
    return apiRequest<{ user: AuthUser }>('/profile')
  },
  updateProfile(input: UpdateProfileInput) {
    return apiRequest<{ user: AuthUser }>('/profile', { method: 'PATCH', body: input })
  },
}
