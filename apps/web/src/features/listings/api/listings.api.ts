import type {
  Category,
  CreateSecondHandListingInput,
  PaginationMeta,
  ProductStatus,
  ProductSummary,
  UpdateSecondHandListingInput,
  UploadedImageAsset,
  UserListing,
} from '@campusbaza/contracts'
import { apiRequest, apiRequestEnvelope } from '../../../lib/api-client'

function queryString(input: { status?: ProductStatus; q?: string; page?: number; limit?: number }) {
  const params = new URLSearchParams()
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  return params.toString() ? `?${params.toString()}` : ''
}

export const listingsApi = {
  categories: () => apiRequest<Category[]>('/categories'),
  uploadImages(files: File[]) {
    const body = new FormData()
    files.forEach((file) => body.append('images', file))
    return apiRequest<UploadedImageAsset[]>('/uploads/product-images', { method: 'POST', body })
  },
  removeUpload: (id: string) => apiRequest<null>(`/uploads/${id}`, { method: 'DELETE' }),
  async list(input: { status?: ProductStatus; q?: string; page?: number; limit?: number } = {}) {
    const response = await apiRequestEnvelope<ProductSummary[]>(`/listings${queryString(input)}`)
    return { items: response.data, meta: response.meta as PaginationMeta }
  },
  get: (id: string) => apiRequest<UserListing>(`/listings/${id}`),
  create: (input: CreateSecondHandListingInput) =>
    apiRequest<UserListing>('/listings', { method: 'POST', body: input }),
  update: (id: string, input: UpdateSecondHandListingInput) =>
    apiRequest<UserListing>(`/listings/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => apiRequest<UserListing>(`/listings/${id}`, { method: 'DELETE' }),
  markSold: (id: string) =>
    apiRequest<UserListing>(`/listings/${id}/mark-sold`, { method: 'POST' }),
}
