import type { Cart, ProductSummary } from '@campusbaza/contracts'

export interface CartRecordItem {
  productId: string
  quantity: number
  priceAtAddition: number
}

export interface CartRecord {
  id: string
  userId: string
  items: CartRecordItem[]
  updatedAt: Date
}

export interface CheckoutProduct {
  summary: ProductSummary
  sellerId: string
  categoryActive: boolean
  sellerActive: boolean
}

export interface CartRepository {
  findOrCreate(userId: string): Promise<CartRecord>
  setItem(
    userId: string,
    productId: string,
    quantity: number,
    priceAtAddition: number,
  ): Promise<CartRecord>
  removeItem(userId: string, productId: string): Promise<CartRecord>
  clear(userId: string): Promise<CartRecord>
}

export interface CheckoutCatalogRepository {
  findProducts(productIds: string[]): Promise<CheckoutProduct[]>
}

export interface CartMapper {
  map(record: CartRecord, products: CheckoutProduct[], currentUserId: string): Cart
}
