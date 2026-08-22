import { fetch } from 'expo/fetch'
import { mobileEnv } from '../../config/env'

export type SellerFinanceOverview = {
  orderValue: number
  confirmedValue: number
  completedSales: number
  cancelledValue: number
  activeOrderValue: number
  orderCount: number
  activeOrderCount: number
  completedOrderCount: number
  cancelledOrderCount: number
  averageCompletedOrder: number
  commissionPercent: number
  commissionAmount: number
  storeEarnings: number
}

export type SellerMonthlySettlement = {
  month: string
  grossSales: number
  completedOrderCount: number
  averageOrder: number
  commissionPercent: number
  commissionAmount: number
  payableToStore: number
  status: 'PENDING' | 'SETTLED'
  settledAt: string | null
  usesSnapshot: boolean
}

export type SellerFinance = {
  storeId: string
  month: string
  currentMonth: string
  periodClosed: boolean
  canSettle: boolean
  overview: SellerFinanceOverview
  monthly: SellerMonthlySettlement
}

type ApiSuccess<T> = { success: true; message: string; data: T }
type ApiFailure = { success: false; error?: { code?: string; message?: string } }

export class SellerFinanceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'SellerFinanceError'
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
    throw new SellerFinanceError('NETWORK_ERROR', 'Unable to connect to Campus Angadi.')
  }

  const raw = await response.text()
  let payload: ApiSuccess<T> | ApiFailure

  try {
    payload = JSON.parse(raw) as ApiSuccess<T> | ApiFailure
  } catch {
    throw new SellerFinanceError(
      'INVALID_RESPONSE',
      'Campus Angadi returned an invalid response.',
      response.status,
    )
  }

  if (!response.ok || !payload.success) {
    const failure = payload as ApiFailure
    throw new SellerFinanceError(
      failure.error?.code ?? 'REQUEST_FAILED',
      failure.error?.message ?? 'Unable to load finance data.',
      response.status,
    )
  }

  return payload.data
}

export function isSellerFinanceAuthError(error: unknown) {
  return (
    error instanceof SellerFinanceError &&
    (error.status === 401 ||
      error.code === 'UNAUTHORIZED' ||
      error.code === 'AUTH_REQUIRED' ||
      error.code === 'INVALID_ACCESS_TOKEN' ||
      error.code === 'TOKEN_EXPIRED')
  )
}

export const sellerFinanceApi = {
  get(accessToken: string, month: string) {
    return request<SellerFinance>(
      `/seller/store/finance?month=${encodeURIComponent(month)}`,
      accessToken,
    )
  },
}
