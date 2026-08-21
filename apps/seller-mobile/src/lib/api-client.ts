import { mobileEnv } from '../config/env'

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
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

export async function apiRequest<T>(path: string): Promise<T> {
  const url = `${mobileEnv.apiUrl}${path}`

  console.log('[Seller Mobile] Requesting:', url)

  let response: Response

  try {
    response = await fetch(url)
  } catch (error) {
    console.error('[Seller Mobile] Network error:', error)

    const detail =
      error instanceof Error ? error.message : String(error)

    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      `Network error: ${detail}`,
    )
  }

  console.log('[Seller Mobile] Response:', response.status, url)

  const payload = (await response.json()) as ApiSuccess<T> | ApiFailure

  if (!response.ok || !payload.success) {
    const failure = payload as ApiFailure

    throw new ApiClientError(
      response.status,
      failure.error?.code ?? 'REQUEST_FAILED',
      failure.error?.message ?? `Request failed with ${response.status}`,
    )
  }

  return payload.data
}
