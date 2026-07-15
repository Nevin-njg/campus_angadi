import type { AddCartItemInput, Cart, UpdateCartItemInput } from '@campusbaza/contracts'
import { apiRequest } from '../../../lib/api-client'

export const cartApi = {
  get: () => apiRequest<Cart>('/cart'),
  add: (input: AddCartItemInput) =>
    apiRequest<Cart>('/cart/items', { method: 'POST', body: input }),
  update: (productId: string, input: UpdateCartItemInput) =>
    apiRequest<Cart>(`/cart/items/${productId}`, { method: 'PATCH', body: input }),
  remove: (productId: string) => apiRequest<Cart>(`/cart/items/${productId}`, { method: 'DELETE' }),
  review: () => apiRequest<Cart>('/cart/review', { method: 'POST' }),
  clear: () => apiRequest<Cart>('/cart', { method: 'DELETE' }),
}
