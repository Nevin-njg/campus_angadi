import { fetch } from 'expo/fetch'
import { mobileEnv } from '../../config/env'

export type SellerOfferStatus = 'SCHEDULED' | 'ACTIVE' | 'EXPIRED'
export type SellerOfferDiscountType = 'PERCENTAGE' | 'FLAT'

export type SellerOffer = {
  id: string
  storeId: string
  productId: string
  productTitle: string
  productImage: string | null
  discountType: SellerOfferDiscountType
  discountValue: number
  basePrice: number
  discountedPrice: number
  startsAt: string
  endsAt: string
  status: SellerOfferStatus
  isCurrent: boolean
  createdAt: string
  updatedAt: string
}

export type SaveSellerOfferInput = {
  productId: string
  discountType: SellerOfferDiscountType
  discountValue: number
  startsAt: string
  endsAt: string
}

type ApiSuccess<T> = { success: true; message: string; data: T }
type ApiFailure = { success: false; error?: { code?: string; message?: string } }

export class SellerOfferError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'SellerOfferError'
  }
}

async function request<T>(
  path: string,
  accessToken: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: Record<string, unknown>,
): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${mobileEnv.apiUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch {
    throw new SellerOfferError('NETWORK_ERROR', 'Unable to connect to Campus Angadi.')
  }

  const raw = await response.text()
  let payload: ApiSuccess<T> | ApiFailure

  try {
    payload = JSON.parse(raw) as ApiSuccess<T> | ApiFailure
  } catch {
    throw new SellerOfferError(
      'INVALID_RESPONSE',
      'Campus Angadi returned an invalid response.',
      response.status,
    )
  }

  if (!response.ok || !payload.success) {
    const failure = payload as ApiFailure
    throw new SellerOfferError(
      failure.error?.code ?? 'REQUEST_FAILED',
      failure.error?.message ?? 'Unable to complete the request.',
      response.status,
    )
  }

  return payload.data
}

export function isSellerOfferAuthError(error: unknown) {
  return (
    error instanceof SellerOfferError &&
    (error.status === 401 ||
      error.code === 'UNAUTHORIZED' ||
      error.code === 'AUTH_REQUIRED' ||
      error.code === 'INVALID_ACCESS_TOKEN' ||
      error.code === 'TOKEN_EXPIRED')
  )
}

export const sellerOfferApi = {
  list(accessToken: string) {
    return request<SellerOffer[]>('/seller/store/offers', accessToken)
  },

  create(accessToken: string, input: SaveSellerOfferInput) {
    return request<SellerOffer>('/seller/store/offers', accessToken, 'POST', input)
  },

  update(
    accessToken: string,
    offerId: string,
    input: Omit<SaveSellerOfferInput, 'productId'>,
  ) {
    return request<SellerOffer>(
      `/seller/store/offers/${encodeURIComponent(offerId)}`,
      accessToken,
      'PATCH',
      input,
    )
  },

  remove(accessToken: string, offerId: string) {
    return request<{ id: string }>(
      `/seller/store/offers/${encodeURIComponent(offerId)}`,
      accessToken,
      'DELETE',
    )
  },
}
