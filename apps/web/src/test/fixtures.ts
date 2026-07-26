import type { AuthUser, ProductDetail } from '@campusbaza/contracts'

export function authUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    email: 'student@campus.edu',
    emailVerified: true,
    role: 'USER',
    status: 'ACTIVE',
    canSell: true,
    canMediateOrders: false,
    profileCompleted: true,
    profile: {
      fullName: 'Campus Student',
      displayName: 'Student',
      profileImageUrl: null,
      phoneNumber: '9876543210',
      department: 'Computer Science',
      graduationYear: 2027,
      campusRole: 'Student',
      preferredPickupLocation: 'Main Gate',
      bio: null,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    lastLoginAt: '2026-07-18T00:00:00.000Z',
    ...overrides,
  }
}

export function productDetail(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return {
    id: 'product-1',
    slug: 'campus-notebook',
    title: 'Campus Notebook',
    description: 'A durable notebook for campus classes.',
    category: { id: 'category-1', name: 'Stationery', slug: 'stationery' },
    price: 120,
    originalPrice: 150,
    stock: 5,
    condition: 'NEW',
    productType: 'NEW',
    sellerType: 'ADMIN',
    status: 'APPROVED',
    published: true,
    isFeatured: false,
    pickupLocation: 'Main Gate',
    primaryImage: null,
    images: [],
    tags: [],
    seller: null,
    viewCount: 10,
    completedOrderCount: 2,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}
