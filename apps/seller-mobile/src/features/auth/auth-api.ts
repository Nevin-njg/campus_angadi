import { fetch } from 'expo/fetch'

import { mobileEnv } from '../../config/env'

export type SellerUser = {
  id: string
  email: string
  role: 'SELLER'
  status: string
  canSell: boolean
  profile?: {
    fullName?: string | null
    displayName?: string | null
    profileImageUrl?: string | null
    phoneNumber?: string | null
  } | null
}

export type SellerSession = {
  accessToken: string
  refreshToken: string
  user: SellerUser
}

type ApiSuccess<T> = {
  success: true
  message: string
  data: T
}

type ApiFailure = {
  success: false
  error?: {
    code?: string
    message?: string
  }
}

export class SellerAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'SellerAuthError'
  }
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${mobileEnv.apiUrl}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new SellerAuthError('NETWORK_ERROR', 'Unable to connect to Campus Angadi.')
  }

  let raw = ''
  try {
    raw = await response.text()
  } catch {
    throw new SellerAuthError(
      'INVALID_RESPONSE',
      'Campus Angadi returned an invalid response.',
      response.status,
    )
  }

  let payload: ApiSuccess<T> | ApiFailure
  try {
    payload = JSON.parse(raw) as ApiSuccess<T> | ApiFailure
  } catch {
    if (__DEV__) {
      console.warn('Seller auth non-JSON response', {
        path,
        status: response.status,
        body: raw.slice(0, 160),
      })
    }
    throw new SellerAuthError(
      'INVALID_RESPONSE',
      'Campus Angadi returned an invalid response.',
      response.status,
    )
  }

  if (!response.ok || !payload.success) {
    const failure = payload as ApiFailure

    throw new SellerAuthError(
      failure.error?.code ?? 'REQUEST_FAILED',
      failure.error?.message ?? 'Something went wrong.',
      response.status,
    )
  }

  return payload.data
}

export const sellerAuthApi = {
  requestOtp(email: string) {
    return post<{ expiresInSeconds: number; resendAfterSeconds: number }>(
      '/auth/seller-mobile/request-otp',
      { email },
    )
  },

  verifyOtp(email: string, code: string) {
    return post<SellerSession>('/auth/seller-mobile/verify-otp', { email, code })
  },

  refresh(refreshToken: string) {
    return post<SellerSession>('/auth/seller-mobile/refresh', { refreshToken })
  },

  logout(refreshToken: string) {
    return post<null>('/auth/seller-mobile/logout', { refreshToken })
  },
}
