import { apiRequest } from '../../../lib/api-client'

export interface StoreCategory {
  id: string
  name: string
  slug: string
  description: string | null
  displayOrder: number
  isActive: boolean
}

export interface Store {
  id: string
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  bannerUrl: string | null
  sellerId: string
  commissionPercent: number
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'
  campusLocation: string | null
  deliveryTimeMinutes: number
  minimumOrderAmount: number
  categories: StoreCategory[]
}

export interface StoreProduct {
  id: string
  slug: string
  title: string
  description: string
  price: number
  originalPrice: number | null
  stock: number
  status: string
  published: boolean
  storeCategoryId: string | null
  primaryImage: string | null
  createdAt: string
  updatedAt: string
}

export interface MarketplaceSearchStore extends Store {
  matchingProductCount: number
  inStockProductCount: number
  lowestMatchingPrice: number | null
  highestDiscountPercent: number
}

export interface MarketplaceSearchProduct extends StoreProduct {
  discountPercent: number
  savings: number
  storeCategoryName: string | null
  store: {
    id: string
    name: string
    slug: string
    logoUrl: string | null
    campusLocation: string | null
    deliveryTimeMinutes: number
    minimumOrderAmount: number
  } | null
}

export interface MarketplaceSearchResult {
  query: string
  stores: MarketplaceSearchStore[]
  products: MarketplaceSearchProduct[]
  meta: {
    storeCount: number
    productCount: number
    inStockCount: number
  }
}

export interface SellerOrderItem {
  id: string
  productName: string
  productImageUrl: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface SellerOrder {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  itemCount: number
  fullName: string
  phoneNumber: string
  pickupLocation: string
  preferredPickupTime: string | null
  notes: string | null
  createdAt: string
  items: SellerOrderItem[]
}

export interface SellerAnalytics {
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

export interface SellerOverview {
  store: Store
  analytics: SellerAnalytics
  recentOrders: SellerOrder[]
}

export interface StoreFinanceOverview {
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

export interface StoreMonthlySettlement {
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

export interface StoreFinance {
  storeId: string
  month: string
  currentMonth: string
  periodClosed: boolean
  canSettle: boolean
  overview: StoreFinanceOverview
  monthly: StoreMonthlySettlement
}

export interface CreateSellerProductInput {
  title: string
  description: string
  price: number
  stock: number
  storeCategoryId: string
  imageUrl?: string
  imageUploadId?: string
  published?: boolean
  tags?: string[]
}

export interface SellerUploadedImage {
  id: string
  url: string
  width: number | null
  height: number | null
  bytes: number
  mimeType: string
  createdAt: string
}

export const storesApi = {
  list: (query = '') =>
    apiRequest<Store[]>(`/stores${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  browse: (slug: string, query = '') =>
    apiRequest<{ store: Store; products: StoreProduct[] }>(
      `/stores/${encodeURIComponent(slug)}${query ? `?q=${encodeURIComponent(query)}` : ''}`,
    ),
  searchMarketplace: (query = '') =>
    apiRequest<MarketplaceSearchResult>(
      `/stores/search${query ? `?q=${encodeURIComponent(query)}` : ''}`,
    ),
  adminList: () => apiRequest<Store[]>('/admin/stores'),
  adminFinance: (id: string, month: string) =>
    apiRequest<StoreFinance>(
      `/admin/stores/${encodeURIComponent(id)}/finance?month=${encodeURIComponent(month)}`,
    ),
  create: (body: Record<string, unknown>) =>
    apiRequest<Store>('/admin/stores', { method: 'POST', body }),
  update: (id: string, body: Record<string, unknown>) =>
    apiRequest<Store>(`/admin/stores/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
  settleMonth: (id: string, month: string) =>
    apiRequest<StoreMonthlySettlement>(
      `/admin/stores/${encodeURIComponent(id)}/settlements/${encodeURIComponent(month)}/settle`,
      { method: 'POST' },
    ),
  remove: (id: string) =>
    apiRequest<{ id: string }>(`/admin/stores/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  seller: () => apiRequest<SellerOverview>('/seller/store'),
  sellerProducts: (query = '') =>
    apiRequest<StoreProduct[]>(
      `/seller/store/products${query ? `?q=${encodeURIComponent(query)}` : ''}`,
    ),
  createSellerProduct: (body: CreateSellerProductInput) =>
    apiRequest<StoreProduct>('/seller/store/products', { method: 'POST', body }),
  updateSellerProduct: (id: string, body: Partial<CreateSellerProductInput>) =>
    apiRequest<StoreProduct>(`/seller/store/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body,
    }),
  deleteSellerProduct: (id: string) =>
    apiRequest<{ id: string }>(`/seller/store/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  uploadSellerProductImage: async (file: File) => {
    const body = new FormData()
    body.append('images', file)
    const images = await apiRequest<SellerUploadedImage[]>('/uploads/product-images', {
      method: 'POST',
      body,
    })
    const image = images[0]
    if (!image) throw new Error('The image upload did not return a usable image.')
    return image
  },
  removeSellerProductUpload: (id: string) =>
    apiRequest<null>(`/uploads/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  createSellerCategory: (body: { name: string; description?: string }) =>
    apiRequest<Store>('/seller/store/categories', { method: 'POST', body }),
  updateSellerCategory: (
    id: string,
    body: Partial<Pick<StoreCategory, 'name' | 'description' | 'displayOrder' | 'isActive'>>,
  ) =>
    apiRequest<Store>(`/seller/store/categories/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body,
    }),
  sellerOrders: (status = '') =>
    apiRequest<SellerOrder[]>(
      `/seller/store/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    ),
  updateSellerOrderStatus: (id: string, status: string, note = '') =>
    apiRequest<SellerOrder>(`/seller/store/orders/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: { status, note },
    }),
  applySellerOffer: (body: {
    scope: 'PRODUCT' | 'CATEGORY'
    targetId: string
    discountPercent: number
  }) =>
    apiRequest<{ updatedCount: number; discountPercent: number }>('/seller/store/offers', {
      method: 'POST',
      body,
    }),
}
