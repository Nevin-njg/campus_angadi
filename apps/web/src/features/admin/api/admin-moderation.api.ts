import type {
  AdminModerationProduct,
  AdminModerationQuery,
  ModerateProductInput,
  PaginationMeta,
  ProductSummary,
} from '@campusbaza/contracts'
import { apiRequest, apiRequestEnvelope } from '../../../lib/api-client'

function queryString(input: Partial<AdminModerationQuery>) {
  const params = new URLSearchParams()
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  return params.toString() ? `?${params.toString()}` : ''
}

export const adminModerationApi = {
  async list(query: Partial<AdminModerationQuery>) {
    const response = await apiRequestEnvelope<ProductSummary[]>(
      `/admin/moderation/products${queryString(query)}`,
    )
    return { items: response.data, meta: response.meta as PaginationMeta }
  },
  get: (id: string) => apiRequest<AdminModerationProduct>(`/admin/moderation/products/${id}`),
  decide: (id: string, input: ModerateProductInput) =>
    apiRequest<AdminModerationProduct>(`/admin/moderation/products/${id}/decision`, {
      method: 'POST',
      body: input,
    }),
}
