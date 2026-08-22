import { fetch } from 'expo/fetch'

import { mobileEnv } from '../../config/env'

export type SellerLoggedInDevice = {
  deviceId: string
  deviceName: string
  platform: 'android' | 'ios'
  pushEnabled: boolean
  lastActiveAt: string
  firstSeenAt: string
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

export class SellerDevicesError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'SellerDevicesError'
  }
}

async function request<T>(path: string, accessToken: string): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${mobileEnv.apiUrl}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })
  } catch {
    throw new SellerDevicesError(
      'NETWORK_ERROR',
      'Unable to connect to Campus Angadi.',
    )
  }

  const raw = await response.text()
  let payload: ApiSuccess<T> | ApiFailure

  try {
    payload = JSON.parse(raw) as ApiSuccess<T> | ApiFailure
  } catch {
    throw new SellerDevicesError(
      'INVALID_RESPONSE',
      'Campus Angadi returned an invalid response.',
      response.status,
    )
  }

  if (!response.ok || !payload.success) {
    const failure = payload as ApiFailure

    throw new SellerDevicesError(
      failure.error?.code ?? 'REQUEST_FAILED',
      failure.error?.message ?? 'Unable to load logged-in devices.',
      response.status,
    )
  }

  return payload.data
}

export function isSellerDevicesAuthError(error: unknown) {
  return (
    error instanceof SellerDevicesError &&
    (error.status === 401 ||
      error.code === 'UNAUTHORIZED' ||
      error.code === 'AUTH_REQUIRED' ||
      error.code === 'INVALID_ACCESS_TOKEN' ||
      error.code === 'TOKEN_EXPIRED')
  )
}

export const sellerDevicesApi = {
  list(accessToken: string) {
    return request<SellerLoggedInDevice[]>(
      '/notifications/push/seller-mobile/devices',
      accessToken,
    )
  },
}
