import { fetch } from 'expo/fetch'

import { mobileEnv } from '../../config/env'

export type StoreCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  displayOrder: number
  isActive: boolean
}

export type SellerStore = {
  id: string
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  bannerUrl: string | null
  sellerId: string
  commissionPercent: number
  status: string
  campusLocation: string | null
  deliveryTimeMinutes: number
  minimumOrderAmount: number
  categories: StoreCategory[]
}

export type UpdateSellerStoreInformationInput = {
  name: string
  description: string
  campusLocation: string
  deliveryTimeMinutes: number
  minimumOrderAmount: number
}

export type StoreAnalytics = {
  productCount: number
  orderCount: number
  activeOrderCount: number
  completedOrderCount: number
  lowStockCount: number
  grossSales: number
  pendingRevenue: number
  commissionAmount: number
  netEarnings: number
}

export type SellerOrderItem = {
  id: string
  productName: string
  productImageUrl: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
}

export type SellerOrder = {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  itemCount: number
  fullName: string
  phoneNumber: string | null
  pickupLocation: string
  preferredPickupTime: string | null
  notes: string | null
  createdAt: string
  completedAt: string | null
  cancelledAt: string | null
  items: SellerOrderItem[]
}

export type SellerStoreDashboard = {
  store: SellerStore
  analytics: StoreAnalytics
  recentOrders: SellerOrder[]
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

export class SellerStoreError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'SellerStoreError'
  }
}

async function requestOnce<T>(
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
    throw new SellerStoreError('NETWORK_ERROR', 'Unable to connect to Campus Angadi.')
  }

  let raw = ''
  try {
    raw = await response.text()
  } catch {
    throw new SellerStoreError('INVALID_RESPONSE', 'Campus Angadi returned an invalid response.')
  }

  let payload: ApiSuccess<T> | ApiFailure
  try {
    payload = JSON.parse(raw) as ApiSuccess<T> | ApiFailure
  } catch {
    if (__DEV__) {
      console.warn('Seller API non-JSON response', {
        path,
        status: response.status,
        body: raw.slice(0, 160),
      })
    }
    throw new SellerStoreError('INVALID_RESPONSE', 'Campus Angadi returned an invalid response.')
  }

  if (!response.ok || !payload.success) {
    const failure = payload as ApiFailure

    throw new SellerStoreError(
      failure.error?.code ?? 'REQUEST_FAILED',
      failure.error?.message ?? 'Unable to complete the request.',
      response.status,
    )
  }

  return payload.data
}

async function request<T>(
  path: string,
  accessToken: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: Record<string, unknown>,
): Promise<T> {
  try {
    return await requestOnce<T>(path, accessToken, method, body)
  } catch (error) {
    // Expo Go + USB development can occasionally yield an empty/non-JSON
    // response while several polling requests overlap. Retry safe GETs once.
    if (
      method === 'GET' &&
      error instanceof SellerStoreError &&
      (error.code === 'INVALID_RESPONSE' || error.code === 'NETWORK_ERROR')
    ) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      return requestOnce<T>(path, accessToken, method, body)
    }

    throw error
  }
}

export function isSellerStoreAuthError(error: unknown) {
  return (
    error instanceof SellerStoreError &&
    (error.status === 401 ||
      error.code === 'UNAUTHORIZED' ||
      error.code === 'AUTH_REQUIRED' ||
      error.code === 'INVALID_ACCESS_TOKEN' ||
      error.code === 'TOKEN_EXPIRED')
  )
}

export const sellerStoreApi = {
  dashboard(accessToken: string) {
    return request<SellerStoreDashboard>('/seller/store', accessToken)
  },

  orders(accessToken: string) {
    return request<SellerOrder[]>('/seller/store/orders', accessToken)
  },

  updateStoreInformation(
    accessToken: string,
    input: UpdateSellerStoreInformationInput,
  ) {
    return request<SellerStore>(
      '/seller/store',
      accessToken,
      'PATCH',
      input,
    )
  },

  createCategory(
    accessToken: string,
    input: { name: string; description?: string },
  ) {
    return request<SellerStore>(
      '/seller/store/categories',
      accessToken,
      'POST',
      input,
    )
  },

  updateCategory(
    accessToken: string,
    categoryId: string,
    input: {
      name?: string
      description?: string
      isActive?: boolean
      displayOrder?: number
    },
  ) {
    return request<SellerStore>(
      `/seller/store/categories/${encodeURIComponent(categoryId)}`,
      accessToken,
      'PATCH',
      input,
    )
  },

  reorderCategories(accessToken: string, categoryIds: string[]) {
    return request<SellerStore>(
      '/seller/store/categories/reorder',
      accessToken,
      'PATCH',
      { categoryIds },
    )
  },

  deleteCategory(accessToken: string, categoryId: string) {
    return request<SellerStore>(
      `/seller/store/categories/${encodeURIComponent(categoryId)}`,
      accessToken,
      'DELETE',
    )
  },

  decideOrder(accessToken: string, orderId: string, decision: 'ACCEPT' | 'REJECT') {
    return request<SellerOrder>(
      `/seller/store/orders/${encodeURIComponent(orderId)}/decision`,
      accessToken,
      'POST',
      { decision },
    )
  },
}
