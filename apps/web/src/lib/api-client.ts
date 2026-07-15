import type { ApiErrorBody, ApiSuccess } from '@campusbaza/contracts'
import { webEnv } from '../config/env'
import { getAccessToken, notifyUnauthorized, setAccessToken } from './session'

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  retryOnUnauthorized?: boolean
}

async function parseResponse<T>(response: Response): Promise<ApiSuccess<T>> {
  let payload: ApiSuccess<T> | ApiErrorBody | null = null
  try {
    payload = (await response.json()) as ApiSuccess<T> | ApiErrorBody
  } catch {
    throw new ApiClientError(
      response.status,
      'INVALID_API_RESPONSE',
      response.ok
        ? 'The server returned an unreadable response. Please try again.'
        : 'The server could not complete this request. Please try again.',
    )
  }
  if (!response.ok || !payload.success) {
    const errorPayload = payload as ApiErrorBody
    throw new ApiClientError(
      response.status,
      errorPayload.error?.code ?? 'REQUEST_FAILED',
      errorPayload.error?.message ?? 'The request failed.',
      errorPayload.error?.details,
    )
  }
  return payload
}

let refreshInFlight: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${webEnv.apiUrl}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
        if (!response.ok) return false
        const payload = await parseResponse<{ accessToken: string }>(response)
        setAccessToken(payload.data.accessToken)
        return true
      } catch {
        return false
      } finally {
        refreshInFlight = null
      }
    })()
  }
  return refreshInFlight
}

export async function apiRequestEnvelope<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiSuccess<T>> {
  const { body, retryOnUnauthorized = true, headers, ...requestInit } = options
  const token = getAccessToken()
  const isFormData = body instanceof FormData
  let response: Response
  try {
    response = await fetch(`${webEnv.apiUrl}${path}`, {
      ...requestInit,
      credentials: 'include',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: isFormData ? body : JSON.stringify(body) }),
    })
  } catch {
    throw new ApiClientError(0, 'NETWORK_ERROR', 'Unable to reach the server. Check your connection.')
  }

  if (
    response.status === 401 &&
    retryOnUnauthorized &&
    !path.startsWith('/auth/refresh') &&
    !path.startsWith('/auth/otp')
  ) {
    const refreshed = await refreshAccessToken().catch(() => false)
    if (refreshed) {
      return apiRequestEnvelope<T>(path, { ...options, retryOnUnauthorized: false })
    }
    setAccessToken(null)
    notifyUnauthorized()
  }

  return parseResponse<T>(response)
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await apiRequestEnvelope<T>(path, options)).data
}
