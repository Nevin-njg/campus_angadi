import type {
  Category,
  HomepagePayload,
  PaginationMeta,
  ProductDetail,
  ProductListQuery,
  ProductSummary,
} from '@campusbaza/contracts'
import { apiRequest, apiRequestEnvelope } from '../../../lib/api-client'

function queryString(input: Partial<ProductListQuery>) {
  const params = new URLSearchParams()
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  const value = params.toString()
  return value ? `?${value}` : ''
}

export const catalogApi = {
  homepage: () => apiRequest<HomepagePayload>('/homepage'),
  categories: () => apiRequest<Category[]>('/categories'),
  async products(query: Partial<ProductListQuery>) {
    const result = await apiRequestEnvelope<ProductSummary[]>(`/products${queryString(query)}`)
    return {
      items: result.data,
      meta: result.meta as PaginationMeta,
    }
  },
  product: (slug: string) => apiRequest<ProductDetail>(`/products/${encodeURIComponent(slug)}`),
}
