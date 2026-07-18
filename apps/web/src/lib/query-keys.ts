/**
 * One source of truth for server-state cache keys.
 *
 * Feature code must use these factories when reading, writing, or invalidating
 * React Query data so that mutations cannot leave another screen stale.
 */
export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  cart: (userId: string) => ['cart', userId] as const,
  orders: {
    all: (userId: string) => ['orders', userId] as const,
    list: (userId: string, status: string | undefined, page: number) =>
      ['orders', userId, status ?? 'all', page] as const,
    detail: (orderId: string) => ['order', orderId] as const,
  },
  notifications: {
    all: (userId: string) => ['notifications', userId] as const,
    unread: (userId: string) => ['notifications', userId, 'unread'] as const,
    adminInbox: (userId: string) => ['notifications', userId, 'admin-inbox'] as const,
  },
  product: (slug: string) => ['product', slug] as const,
}
