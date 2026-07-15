import type {
  CreateDealerInput,
  Dealer,
  DealerListQuery,
  PaginatedResult,
  UpdateDealerInput,
} from '@campusbaza/contracts'
import { apiRequest, apiRequestEnvelope } from '../../../lib/api-client'

function queryString(query: DealerListQuery) {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.isActive !== undefined) params.set('isActive', String(query.isActive))
  params.set('page', String(query.page))
  params.set('limit', String(query.limit))
  return `?${params.toString()}`
}

export const dealersApi = {
  async list(query: DealerListQuery): Promise<PaginatedResult<Dealer>> {
    const response = await apiRequestEnvelope<Dealer[]>(`/admin/dealers${queryString(query)}`)
    return { items: response.data, meta: response.meta! }
  },
  get: (id: string) => apiRequest<Dealer>(`/admin/dealers/${id}`),
  create: (input: CreateDealerInput) =>
    apiRequest<Dealer>('/admin/dealers', { method: 'POST', body: input }),
  update: (id: string, input: UpdateDealerInput) =>
    apiRequest<Dealer>(`/admin/dealers/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => apiRequest<null>(`/admin/dealers/${id}`, { method: 'DELETE' }),
}
