import { fetch } from 'expo/fetch'
import { mobileEnv } from '../../config/env'

export type StoreDay =
  | 'SUNDAY'
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'

export type StoreManualOpenOverride = 'AUTO' | 'OPEN' | 'CLOSED'

export type StoreOpeningHour = {
  day: StoreDay
  isOpen: boolean
  openTime: string
  closeTime: string
}

export type StoreAvailability = {
  isOpen: boolean
  status: 'OPEN' | 'CLOSED'
  source: 'STATUS' | 'MANUAL' | 'SCHEDULE'
  manualOpenOverride: StoreManualOpenOverride
  timeZone: string
  today: StoreOpeningHour
  message: string
}

export type SellerStoreTimings = {
  storeId: string
  storeName: string
  openingHours: StoreOpeningHour[]
  manualOpenOverride: StoreManualOpenOverride
  availability: StoreAvailability
}

type ApiSuccess<T> = { success: true; message: string; data: T }
type ApiFailure = { success: false; error?: { code?: string; message?: string } }

export class StoreTimingsError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'StoreTimingsError'
  }
}

async function request<T>(
  path: string,
  accessToken: string,
  init?: {
    method?: 'GET' | 'PUT' | 'PATCH'
    body?: unknown
  },
): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${mobileEnv.apiUrl}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    })
  } catch {
    throw new StoreTimingsError('NETWORK_ERROR', 'Unable to connect to Campus Angadi.')
  }

  const raw = await response.text()
  let payload: ApiSuccess<T> | ApiFailure

  try {
    payload = JSON.parse(raw) as ApiSuccess<T> | ApiFailure
  } catch {
    throw new StoreTimingsError(
      'INVALID_RESPONSE',
      'Campus Angadi returned an invalid response.',
      response.status,
    )
  }

  if (!response.ok || !payload.success) {
    const failure = payload as ApiFailure
    throw new StoreTimingsError(
      failure.error?.code ?? 'REQUEST_FAILED',
      failure.error?.message ?? 'Unable to update store timings.',
      response.status,
    )
  }

  return payload.data
}

export function isStoreTimingsAuthError(error: unknown) {
  return (
    error instanceof StoreTimingsError &&
    (error.status === 401 ||
      error.code === 'UNAUTHORIZED' ||
      error.code === 'AUTH_REQUIRED' ||
      error.code === 'INVALID_ACCESS_TOKEN' ||
      error.code === 'TOKEN_EXPIRED')
  )
}

export const storeTimingsApi = {
  get(accessToken: string) {
    return request<SellerStoreTimings>('/seller/store/timings', accessToken)
  },

  updateHours(accessToken: string, openingHours: StoreOpeningHour[]) {
    return request<SellerStoreTimings>('/seller/store/timings', accessToken, {
      method: 'PUT',
      body: { openingHours },
    })
  },

  setOverride(accessToken: string, override: StoreManualOpenOverride) {
    return request<SellerStoreTimings>('/seller/store/availability', accessToken, {
      method: 'PATCH',
      body: { override },
    })
  },
}
