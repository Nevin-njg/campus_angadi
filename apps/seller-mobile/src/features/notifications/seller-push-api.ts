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

export class SellerPushError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'SellerPushError'
  }
}

async function request<T>(
  path: string,
  accessToken: string,
  method: 'POST' | 'DELETE',
  body: Record<string, unknown>,
): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${mobileEnv.apiUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new SellerPushError(
      'NETWORK_ERROR',
      'Unable to connect to Campus Angadi.',
    )
  }

  let payload: ApiSuccess<T> | ApiFailure

  try {
    payload = (await response.json()) as ApiSuccess<T> | ApiFailure
  } catch {
    throw new SellerPushError(
      'INVALID_RESPONSE',
      'Campus Angadi returned an invalid response.',
      response.status,
    )
  }

  if (!response.ok || !payload.success) {
    const failure = payload as ApiFailure
    throw new SellerPushError(
      failure.error?.code ?? 'REQUEST_FAILED',
      failure.error?.message ?? 'Unable to configure push notifications.',
      response.status,
    )
  }

  return payload.data
}

export function isSellerPushAuthError(error: unknown) {
  return error instanceof SellerPushError && error.status === 401
}

export const sellerPushApi = {
  register(
    accessToken: string,
    input: {
      deviceId: string
      expoPushToken: string
      deviceName: string
      platform: 'android' | 'ios'
    },
  ) {
    return request<{ registered: true; deviceId: string }>(
      '/notifications/push/seller-mobile/register',
      accessToken,
      'POST',
      input,
    )
  },

  unregister(
    accessToken: string,
    deviceId: string,
  ) {
    return request<{ registered: false; deviceId: string }>(
      '/notifications/push/seller-mobile/unregister',
      accessToken,
      'DELETE',
      { deviceId },
    )
  },
}
