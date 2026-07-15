import type {
  AdminProductListQuery,
  Category,
  CreateCategoryInput,
  CreateOfficialProductInput,
  HomepagePayload,
  HomepageSection,
  HomepageSectionKey,
  PaginationMeta,
  ProductDetail,
  ProductSummary,
  UpdateCategoryInput,
  UpdateOfficialProductInput,
} from '@campusbaza/contracts'
import { apiRequest, apiRequestEnvelope } from '../../../lib/api-client'

function queryString(input: Partial<AdminProductListQuery>) {
  const params = new URLSearchParams()
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  const value = params.toString()
  return value ? `?${value}` : ''
}

export interface AdminHomepagePayload extends HomepagePayload {
  configuration: Array<{
    key: HomepageSectionKey
    limit: number
    manualProductIds: string[]
  }>
}

export const adminCatalogApi = {
  categories: () => apiRequest<Category[]>('/admin/categories'),
  createCategory: (input: CreateCategoryInput) =>
    apiRequest<Category>('/admin/categories', { method: 'POST', body: input }),
  updateCategory: (id: string, input: UpdateCategoryInput) =>
    apiRequest<Category>(`/admin/categories/${id}`, { method: 'PATCH', body: input }),
  removeCategory: (id: string) => apiRequest<null>(`/admin/categories/${id}`, { method: 'DELETE' }),
  async products(query: Partial<AdminProductListQuery>) {
    const result = await apiRequestEnvelope<ProductSummary[]>(
      `/admin/products${queryString(query)}`,
    )
    return { items: result.data, meta: result.meta as PaginationMeta }
  },
  product: (id: string) => apiRequest<ProductDetail>(`/admin/products/${id}`),
  createProduct: (input: CreateOfficialProductInput) =>
    apiRequest<ProductDetail>('/admin/products', { method: 'POST', body: input }),
  updateProduct: (id: string, input: UpdateOfficialProductInput) =>
    apiRequest<ProductDetail>(`/admin/products/${id}`, { method: 'PATCH', body: input }),
  homepage: () => apiRequest<AdminHomepagePayload>('/admin/homepage'),
  saveHomepage: (key: HomepageSectionKey, productIds: string[]) =>
    apiRequest<HomepageSection>(`/admin/homepage/${key}`, {
      method: 'PUT',
      body: { productIds },
    }),
  resetHomepage: (key: HomepageSectionKey) =>
    apiRequest<HomepageSection>(`/admin/homepage/${key}`, { method: 'DELETE' }),
}
