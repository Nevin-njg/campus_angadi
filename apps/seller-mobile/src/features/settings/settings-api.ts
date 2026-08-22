import { fetch } from 'expo/fetch'

import { mobileEnv } from '../../config/env'

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

export class SellerSettingsError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'SellerSettingsError'
  }
}

async function request<T>(
  path: string,
  accessToken: string,
  method: 'POST' | 'PATCH' | 'DELETE',
): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${mobileEnv.apiUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })
  } catch {
    throw new SellerSettingsError(
      'NETWORK_ERROR',
      'Unable to connect to Campus Angadi.',
    )
  }

  const raw = await response.text()
  let payload: ApiSuccess<T> | ApiFailure

  try {
    payload = JSON.parse(raw) as ApiSuccess<T> | ApiFailure
  } catch {
    throw new SellerSettingsError(
      'INVALID_RESPONSE',
      'Campus Angadi returned an invalid response.',
      response.status,
    )
  }

  if (!response.ok || !payload.success) {
    const failure = payload as ApiFailure
    throw new SellerSettingsError(
      failure.error?.code ?? 'REQUEST_FAILED',
      failure.error?.message ?? 'Unable to update settings.',
      response.status,
    )
  }

  return payload.data
}

export function isSellerSettingsAuthError(error: unknown) {
  return (
    error instanceof SellerSettingsError &&
    (error.status === 401 ||
      error.code === 'UNAUTHORIZED' ||
      error.code === 'AUTH_REQUIRED' ||
      error.code === 'INVALID_ACCESS_TOKEN' ||
      error.code === 'TOKEN_EXPIRED')
  )
}

export const sellerSettingsApi = {
  permanentlyCloseStore(accessToken: string) {
    return request<{
      storeId: string
      status: 'ARCHIVED'
      manualOpenOverride: 'CLOSED'
    }>('/seller/store/permanently-close', accessToken, 'PATCH')
  },

  unregisterAllDevices(accessToken: string) {
    return request<{ removed: number }>(
      '/notifications/push/seller-mobile/unregister-all',
      accessToken,
      'DELETE',
    )
  },

  logoutAll(accessToken: string) {
    return request<null>('/auth/logout-all', accessToken, 'POST')
  },
}
