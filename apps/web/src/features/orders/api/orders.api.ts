import type {
  AdminOrderListQuery,
  AssignOrderDealerInput,
  AssignOrderModeratorInput,
  CancelOrderInput,
  CheckoutInput,
  CheckoutResult,
  OrderDetail,
  OrderListQuery,
  PaginatedResult,
  UpdateOrderStatusInput,
} from '@campusbaza/contracts'
import { apiRequest, apiRequestEnvelope } from '../../../lib/api-client'

function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const value = params.toString()
  return value ? `?${value}` : ''
}

export const ordersApi = {
  checkout: (input: CheckoutInput) =>
    apiRequest<CheckoutResult>('/orders/checkout', { method: 'POST', body: input }),
  async mine(query: OrderListQuery): Promise<PaginatedResult<OrderDetail>> {
    const envelope = await apiRequestEnvelope<OrderDetail[]>(`/orders${queryString(query)}`)
    return { items: envelope.data, meta: envelope.meta! }
  },
  detail: (id: string) => apiRequest<OrderDetail>(`/orders/${id}`),
  cancel: (id: string, input: CancelOrderInput) =>
    apiRequest<OrderDetail>(`/orders/${id}/cancel`, { method: 'POST', body: input }),
  async adminList(query: AdminOrderListQuery): Promise<PaginatedResult<OrderDetail>> {
    const envelope = await apiRequestEnvelope<OrderDetail[]>(`/admin/orders${queryString(query)}`)
    return { items: envelope.data, meta: envelope.meta! }
  },
  adminDetail: (id: string) => apiRequest<OrderDetail>(`/admin/orders/${id}`),
  assignDealer: (id: string, input: AssignOrderDealerInput) =>
    apiRequest<OrderDetail>(`/admin/orders/${id}/dealer`, { method: 'PATCH', body: input }),
  assignModerator: (id: string, input: AssignOrderModeratorInput) =>
    apiRequest<OrderDetail>(`/admin/orders/${id}/moderator`, { method: 'PATCH', body: input }),
  updateStatus: (id: string, input: UpdateOrderStatusInput) =>
    apiRequest<OrderDetail>(`/admin/orders/${id}/status`, { method: 'PATCH', body: input }),
}
