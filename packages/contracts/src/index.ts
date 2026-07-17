import { z } from 'zod'

export const userRoleSchema = z.enum(['USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'])
export const userStatusSchema = z.enum(['ACTIVE', 'BLOCKED', 'DELETED'])

export const userProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(80).nullable(),
  displayName: z.string().trim().min(2).max(40).nullable(),
  profileImageUrl: z.string().url().nullable(),
  phoneNumber: z.string().trim().min(7).max(20).nullable(),
  department: z.string().trim().max(80).nullable(),
  graduationYear: z.number().int().min(2000).max(2100).nullable(),
  campusRole: z.string().trim().max(50).nullable(),
  preferredPickupLocation: z.string().trim().max(120).nullable(),
  bio: z.string().trim().max(240).nullable(),
})

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  role: userRoleSchema,
  status: userStatusSchema,
  canSell: z.boolean(),
  canMediateOrders: z.boolean(),
  profileCompleted: z.boolean(),
  profile: userProfileSchema,
  createdAt: z.string(),
  lastLoginAt: z.string().nullable(),
})

export const requestOtpInputSchema = z
  .object({ email: z.string().trim().email().max(254) })
  .strict()
export const verifyOtpInputSchema = z
  .object({ email: z.string().trim().email().max(254), code: z.string().regex(/^\d{6,8}$/) })
  .strict()
export const updateProfileInputSchema = z
  .object({
    fullName: z.string().trim().min(2).max(80).optional(),
    displayName: z.string().trim().min(2).max(40).optional(),
    profileImageUrl: z.string().url().nullable().optional(),
    phoneNumber: z.string().trim().min(7).max(20).nullable().optional(),
    department: z.string().trim().max(80).nullable().optional(),
    graduationYear: z.number().int().min(2000).max(2100).nullable().optional(),
    campusRole: z.string().trim().max(50).nullable().optional(),
    preferredPickupLocation: z.string().trim().max(120).nullable().optional(),
    bio: z.string().trim().max(240).nullable().optional(),
  })
  .strict()

export const productTypeSchema = z.enum(['NEW', 'SECOND_HAND'])
export const sellerTypeSchema = z.enum(['ADMIN', 'USER'])
export const productConditionSchema = z.enum([
  'NEW',
  'LIKE_NEW',
  'GOOD',
  'FAIR',
  'USED',
  'OPEN_BOX',
])
export const productStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
  'HIDDEN',
  'SOLD',
  'OUT_OF_STOCK',
  'DELETED',
])
export const productSortSchema = z.enum(['latest', 'oldest', 'price_asc', 'price_desc', 'popular'])
export const homepageSectionKeySchema = z.enum(['FEATURED', 'OFFICIAL', 'SECOND_HAND', 'RECENT'])

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  isActive: z.boolean(),
  displayOrder: z.number().int(),
  productCount: z.number().int().nonnegative().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const productImageSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  altText: z.string(),
  displayOrder: z.number().int().nonnegative(),
  isPrimary: z.boolean(),
})

export const productSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  category: categorySchema.pick({ id: true, name: true, slug: true }),
  price: z.number().nonnegative(),
  originalPrice: z.number().nonnegative().nullable(),
  stock: z.number().int().nonnegative(),
  condition: productConditionSchema,
  productType: productTypeSchema,
  sellerType: sellerTypeSchema,
  status: productStatusSchema,
  published: z.boolean(),
  isFeatured: z.boolean(),
  pickupLocation: z.string().nullable(),
  primaryImage: productImageSchema.nullable(),
  viewCount: z.number().int().nonnegative(),
  completedOrderCount: z.number().int().nonnegative(),
  createdAt: z.string(),
})

export const productDetailSchema = productSummarySchema.extend({
  description: z.string(),
  tags: z.array(z.string()),
  images: z.array(productImageSchema),
  seller: z.object({ id: z.string(), displayName: z.string(), verified: z.boolean() }).nullable(),
  updatedAt: z.string(),
})

export const imageInputSchema = z
  .object({
    url: z.string().url(),
    altText: z.string().trim().max(140).optional().default(''),
    displayOrder: z.number().int().min(0).max(20).optional().default(0),
    isPrimary: z.boolean().optional().default(false),
  })
  .strict()

export const createCategoryInputSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    description: z.string().trim().max(240).nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
    isActive: z.boolean().optional().default(true),
    displayOrder: z.number().int().min(0).max(999).optional().default(0),
  })
  .strict()

export const updateCategoryInputSchema = createCategoryInputSchema.partial().strict()

const officialProductInputBaseSchema = z
  .object({
    title: z.string().trim().min(3).max(140),
    description: z.string().trim().min(10).max(5000),
    categoryId: z.string().min(1),
    price: z.number().nonnegative().max(10_000_000),
    originalPrice: z.number().nonnegative().max(10_000_000).nullable().optional(),
    stock: z.number().int().min(0).max(1_000_000),
    pickupLocation: z.string().trim().max(160).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
    isFeatured: z.boolean().optional().default(false),
    publish: z.boolean().optional().default(true),
    images: z.array(imageInputSchema).max(8).optional().default([]),
  })
  .strict()

export const createOfficialProductInputSchema = officialProductInputBaseSchema.superRefine(
  (value, context) => {
    if (
      value.originalPrice !== null &&
      value.originalPrice !== undefined &&
      value.originalPrice < value.price
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['originalPrice'],
        message: 'Original price cannot be lower than the selling price.',
      })
    }
    if (value.images.filter((image) => image.isPrimary).length > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['images'],
        message: 'Only one image can be primary.',
      })
    }
  },
)

export const updateOfficialProductInputSchema = officialProductInputBaseSchema
  .partial()
  .strict()
  .superRefine((value, context) => {
    if (
      value.price !== undefined &&
      value.originalPrice !== null &&
      value.originalPrice !== undefined &&
      value.originalPrice < value.price
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['originalPrice'],
        message: 'Original price cannot be lower than the selling price.',
      })
    }
    if ((value.images ?? []).filter((image) => image.isPrimary).length > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['images'],
        message: 'Only one image can be primary.',
      })
    }
  })

const productListQueryBaseSchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    category: z.string().trim().max(80).optional(),
    productType: productTypeSchema.optional(),
    sellerType: sellerTypeSchema.optional(),
    dealerId: z.string().optional(),
    assignment: z.enum(['ASSIGNED', 'UNASSIGNED']).optional(),
    condition: productConditionSchema.optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    sort: productSortSchema.optional().default('latest'),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(48).optional().default(12),
  })
  .strict()

export const productListQuerySchema = productListQueryBaseSchema.superRefine((value, context) => {
  if (
    value.minPrice !== undefined &&
    value.maxPrice !== undefined &&
    value.minPrice > value.maxPrice
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['minPrice'],
      message: 'Minimum price cannot exceed maximum price.',
    })
  }
})

export const adminProductListQuerySchema = productListQueryBaseSchema
  .extend({ status: productStatusSchema.optional() })
  .strict()
  .superRefine((value, context) => {
    if (
      value.minPrice !== undefined &&
      value.maxPrice !== undefined &&
      value.minPrice > value.maxPrice
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minPrice'],
        message: 'Minimum price cannot exceed maximum price.',
      })
    }
  })

export const homepageSelectionInputSchema = z
  .object({ productIds: z.array(z.string().min(1)).max(48) })
  .strict()

export const homepageSectionSchema = z.object({
  key: homepageSectionKeySchema,
  limit: z.number().int().positive(),
  manualProductIds: z.array(z.string()),
  products: z.array(productSummarySchema),
  manualCount: z.number().int().nonnegative(),
  automaticCount: z.number().int().nonnegative(),
})

export const homepagePayloadSchema = z.object({
  categories: z.array(categorySchema),
  sections: z.object({
    FEATURED: homepageSectionSchema,
    OFFICIAL: homepageSectionSchema,
    SECOND_HAND: homepageSectionSchema,
    RECENT: homepageSectionSchema,
  }),
})

export const uploadedImageAssetSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  bytes: z.number().int().nonnegative(),
  mimeType: z.string(),
  createdAt: z.string(),
})

export const secondHandConditionSchema = z.enum(['LIKE_NEW', 'GOOD', 'FAIR', 'USED', 'OPEN_BOX'])

const secondHandListingBaseSchema = z
  .object({
    title: z.string().trim().min(3).max(140),
    description: z.string().trim().min(10).max(5000),
    categoryId: z.string().min(1),
    price: z.number().positive().max(10_000_000),
    originalPrice: z.number().positive().max(10_000_000).nullable().optional(),
    condition: secondHandConditionSchema,
    productAge: z.string().trim().max(80).nullable().optional(),
    stock: z.number().int().min(1).max(20).default(1),
    pickupLocation: z.string().trim().min(2).max(160),
    reasonForSelling: z.string().trim().max(500).nullable().optional(),
    additionalDetails: z.string().trim().max(1500).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
    imageUploadIds: z.array(z.string().min(1)).max(8).optional().default([]),
    keepImageIds: z.array(z.string().min(1)).max(8).optional().default([]),
  })
  .strict()

function validateSecondHandPrice(
  value: { price?: number | undefined; originalPrice?: number | null | undefined },
  context: z.RefinementCtx,
) {
  if (
    value.price !== undefined &&
    value.originalPrice !== null &&
    value.originalPrice !== undefined &&
    value.originalPrice < value.price
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['originalPrice'],
      message: 'Original price cannot be lower than the selling price.',
    })
  }
}

export const createSecondHandListingInputSchema = secondHandListingBaseSchema.superRefine(
  (value, context) => {
    validateSecondHandPrice(value, context)
    if (value.imageUploadIds.length < 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['imageUploadIds'],
        message: 'Upload at least one product image.',
      })
    }
  },
)

export const updateSecondHandListingInputSchema = secondHandListingBaseSchema
  .partial()
  .strict()
  .superRefine(validateSecondHandPrice)

export const userListingQuerySchema = z
  .object({
    status: productStatusSchema.optional(),
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(48).default(12),
  })
  .strict()

export const moderationActionSchema = z.enum([
  'SUBMITTED',
  'RESUBMITTED',
  'APPROVED',
  'REJECTED',
  'CHANGES_REQUESTED',
  'HIDDEN',
  'RESTORED',
  'MARKED_SOLD',
  'DELETED',
])

export const moderationDecisionSchema = z.enum([
  'APPROVE',
  'REJECT',
  'REQUEST_CHANGES',
  'HIDE',
  'RESTORE',
])

export const moderateProductInputSchema = z
  .object({
    decision: moderationDecisionSchema,
    reason: z.string().trim().max(1000).nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (['REJECT', 'REQUEST_CHANGES', 'HIDE'].includes(value.decision) && !value.reason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'A reason is required for this moderation decision.',
      })
    }
  })

export const moderationHistoryEntrySchema = z.object({
  id: z.string(),
  action: moderationActionSchema,
  fromStatus: productStatusSchema.nullable(),
  toStatus: productStatusSchema,
  reason: z.string().nullable(),
  actor: z.object({ id: z.string(), displayName: z.string() }).nullable(),
  createdAt: z.string(),
})

export const sellerSnapshotSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  profileCompleted: z.boolean(),
  canSell: z.boolean(),
  status: userStatusSchema,
})

export const userListingSchema = productDetailSchema.extend({
  productAge: z.string().nullable(),
  reasonForSelling: z.string().nullable(),
  additionalDetails: z.string().nullable(),
  moderationMessage: z.string().nullable(),
  submittedAt: z.string().nullable(),
  moderationHistory: z.array(moderationHistoryEntrySchema),
})

export const adminModerationProductSchema = userListingSchema.extend({
  sellerSnapshot: sellerSnapshotSchema,
})

export const adminModerationQuerySchema = z
  .object({
    status: productStatusSchema.optional().default('PENDING_APPROVAL'),
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(48).default(12),
  })
  .strict()

export const cartIssueCodeSchema = z.enum([
  'PRODUCT_UNAVAILABLE',
  'PRICE_CHANGED',
  'INSUFFICIENT_STOCK',
  'OWN_PRODUCT',
])

export const cartIssueSchema = z.object({
  productId: z.string(),
  code: cartIssueCodeSchema,
  message: z.string(),
})

export const cartItemSchema = z.object({
  product: productSummarySchema,
  quantity: z.number().int().positive(),
  lineTotal: z.number().nonnegative(),
})

export const cartSchema = z.object({
  id: z.string(),
  userId: z.string(),
  items: z.array(cartItemSchema),
  totalItems: z.number().int().nonnegative(),
  subtotal: z.number().nonnegative(),
  issues: z.array(cartIssueSchema),
  updatedAt: z.string(),
})

export const addCartItemInputSchema = z
  .object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1).max(20).default(1),
  })
  .strict()

export const updateCartItemInputSchema = z
  .object({ quantity: z.number().int().min(1).max(20) })
  .strict()

export const checkoutInputSchema = z
  .object({
    fullName: z.string().trim().min(2).max(80),
    phoneNumber: z.string().trim().min(7).max(20),
    campusId: z.string().trim().max(60).nullable().optional(),
    department: z.string().trim().max(80).nullable().optional(),
    building: z.string().trim().max(100).nullable().optional(),
    pickupLocation: z.string().trim().min(2).max(160),
    preferredPickupTime: z.string().trim().max(100).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict()

export const dealerWorkingHoursSchema = z
  .object({
    timeZone: z.string().trim().min(1).max(80).default('Asia/Kolkata'),
    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .default('00:00'),
    endTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .default('23:59'),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0, 1, 2, 3, 4, 5, 6]),
  })
  .strict()

export const dealerSchema = z.object({
  id: z.string(),
  mediatorUserId: z.string().nullable(),
  mediatorEmail: z.string().email().nullable(),
  displayName: z.string(),
  phoneNumber: z.string(),
  isActive: z.boolean(),
  maxOpenOrders: z.number().int().positive(),
  currentOpenOrders: z.number().int().nonnegative(),
  completedOrders: z.number().int().nonnegative(),
  lastAssignedAt: z.string().nullable(),
  workingHours: dealerWorkingHoursSchema,
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
})

export const assignedDealerSchema = dealerSchema.pick({
  id: true,
  displayName: true,
})

export const assignedModeratorSchema = z.object({
  id: z.string(),
  displayName: z.string(),
})

export const createDealerInputSchema = z
  .object({
    mediatorUserId: z.string().trim().regex(/^[a-f\d]{24}$/i),
    displayName: z.string().trim().min(2).max(80),
    phoneNumber: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{7,14}$/),
    isActive: z.boolean().optional().default(true),
    maxOpenOrders: z.number().int().min(1).max(500).default(10),
    workingHours: dealerWorkingHoursSchema.optional().default({
      timeZone: 'Asia/Kolkata',
      startTime: '00:00',
      endTime: '23:59',
      days: [0, 1, 2, 3, 4, 5, 6],
    }),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict()

export const updateDealerInputSchema = z
  .object({
    mediatorUserId: z.string().trim().regex(/^[a-f\d]{24}$/i).optional(),
    displayName: z.string().trim().min(2).max(80).optional(),
    phoneNumber: z
      .string()
      .trim()
      .regex(/^\+?[1-9]\d{7,14}$/)
      .optional(),
    isActive: z.boolean().optional(),
    maxOpenOrders: z.number().int().min(1).max(500).optional(),
    workingHours: dealerWorkingHoursSchema.optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict()

export const dealerListQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    isActive: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()

export const dealerAssignmentHistorySchema = z.object({
  id: z.string(),
  previousDealer: assignedDealerSchema.nullable(),
  newDealer: assignedDealerSchema.nullable(),
  reason: z.string(),
  mode: z.enum(['AUTO', 'MANUAL']),
  actorId: z.string().nullable(),
  createdAt: z.string(),
})

export const assignOrderDealerInputSchema = z
  .object({
    dealerId: z.string().nullable().optional(),
    mode: z.enum(['AUTO', 'MANUAL']).default('MANUAL'),
    reason: z.string().trim().min(2).max(500).default('Dealer reassigned by administrator.'),
  })
  .strict()

export const assignOrderModeratorInputSchema = z.object({ moderatorId: z.string().min(1) }).strict()

export const chatMessageTypeSchema = z.enum(['TEXT', 'AUDIO', 'SYSTEM'])

export const chatMessageSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  senderId: z.string(),
  senderKind: z.enum(['BUYER', 'TEAM']),
  senderName: z.string(),
  type: chatMessageTypeSchema,
  text: z.string().nullable(),
  audioUrl: z.string().url().nullable(),
  audioDurationSeconds: z.number().nonnegative().nullable(),
  clientId: z.string().nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
})

export const chatMessagesPageSchema = z.object({
  messages: z.array(chatMessageSchema),
  nextCursor: z.string().nullable(),
  assignedDealer: assignedDealerSchema.nullable(),
  assignedModerator: assignedModeratorSchema.nullable(),
  canChat: z.boolean(),
})

export const sendChatMessageInputSchema = z
  .object({
    text: z.string().trim().min(1).max(2000),
    clientId: z.string().trim().min(1).max(100).optional(),
  })
  .strict()

export const orderStatusSchema = z.enum([
  'PENDING',
  'WAITING_FOR_DEALER_ASSIGNMENT',
  'AWAITING_TEAM_CONFIRMATION',
  'CONTACTED',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
])

export const orderItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  productSlug: z.string(),
  productImageUrl: z.string().url().nullable(),
  sellerId: z.string(),
  productType: productTypeSchema,
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative(),
})

export const orderStatusHistorySchema = z.object({
  id: z.string(),
  fromStatus: orderStatusSchema.nullable(),
  toStatus: orderStatusSchema,
  note: z.string().nullable(),
  actorId: z.string().nullable(),
  createdAt: z.string(),
})

export const orderSummarySchema = z.object({
  id: z.string(),
  checkoutGroupId: z.string(),
  orderNumber: z.string(),
  buyerId: z.string(),
  sellerType: sellerTypeSchema,
  sellerId: z.string().nullable(),
  status: orderStatusSchema,
  subtotal: z.number().nonnegative(),
  totalAmount: z.number().nonnegative(),
  itemCount: z.number().int().positive(),
  productPreview: z.array(orderItemSchema).max(3),
  pickupLocation: z.string(),
  assignedDealerId: z.string().nullable(),
  assignedDealer: assignedDealerSchema.nullable(),
  assignedModeratorId: z.string().nullable(),
  assignedModerator: assignedModeratorSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const orderDetailSchema = orderSummarySchema.extend({
  fullName: z.string(),
  phoneNumber: z.string(),
  campusId: z.string().nullable(),
  department: z.string().nullable(),
  building: z.string().nullable(),
  preferredPickupTime: z.string().nullable(),
  notes: z.string().nullable(),
  internalNotes: z.string().nullable(),
  items: z.array(orderItemSchema),
  statusHistory: z.array(orderStatusHistorySchema),
  dealerAssignmentHistory: z.array(dealerAssignmentHistorySchema),
  cancelledAt: z.string().nullable(),
  completedAt: z.string().nullable(),
})

export const orderListQuerySchema = z
  .object({
    status: orderStatusSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict()

export const adminOrderListQuerySchema = orderListQuerySchema
  .extend({
    q: z.string().trim().max(100).optional(),
    sellerType: sellerTypeSchema.optional(),
    dealerId: z.string().optional(),
    assignment: z.enum(['ASSIGNED', 'UNASSIGNED']).optional(),
  })
  .strict()

export const updateOrderStatusInputSchema = z
  .object({
    status: orderStatusSchema,
    note: z.string().trim().max(1000).nullable().optional(),
  })
  .strict()

export const cancelOrderInputSchema = z
  .object({ reason: z.string().trim().max(500).nullable().optional() })
  .strict()

export const checkoutResultSchema = z.object({
  checkoutGroupId: z.string(),
  orders: z.array(orderSummarySchema).min(1),
})

export const adminDashboardSchema = z.object({
  users: z.object({
    total: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    blocked: z.number().int().nonnegative(),
    newThisMonth: z.number().int().nonnegative(),
  }),
  products: z.object({
    total: z.number().int().nonnegative(),
    official: z.number().int().nonnegative(),
    secondHand: z.number().int().nonnegative(),
    pendingApproval: z.number().int().nonnegative(),
    sold: z.number().int().nonnegative(),
  }),
  orders: z.object({
    today: z.number().int().nonnegative(),
    thisWeek: z.number().int().nonnegative(),
    thisMonth: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
    waitingForDealer: z.number().int().nonnegative(),
  }),
  sales: z.object({
    completedValue: z.number().nonnegative(),
    thisMonthValue: z.number().nonnegative(),
    officialValue: z.number().nonnegative(),
    secondHandValue: z.number().nonnegative(),
  }),
  dealers: z.object({
    active: z.number().int().nonnegative(),
    atCapacity: z.number().int().nonnegative(),
    openAssignments: z.number().int().nonnegative(),
  }),
  reports: z.object({
    open: z.number().int().nonnegative(),
    inReview: z.number().int().nonnegative(),
  }),
  recentOrders: z.array(orderSummarySchema),
  recentUsers: z.array(
    z.object({
      id: z.string(),
      email: z.string().email(),
      displayName: z.string(),
      role: userRoleSchema,
      status: userStatusSchema,
      createdAt: z.string(),
    }),
  ),
})

export const adminUserSummarySchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  fullName: z.string().nullable(),
  role: userRoleSchema,
  status: userStatusSchema,
  canSell: z.boolean(),
  canMediateOrders: z.boolean(),
  profileCompleted: z.boolean(),
  listingCount: z.number().int().nonnegative(),
  orderCount: z.number().int().nonnegative(),
  completedSalesCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  lastActiveAt: z.string().nullable(),
})

export const adminUserDetailSchema = adminUserSummarySchema.extend({
  phoneNumber: z.string().nullable(),
  department: z.string().nullable(),
  graduationYear: z.number().int().nullable(),
  campusRole: z.string().nullable(),
  bio: z.string().nullable(),
  internalNotes: z.string().nullable(),
})

export const adminUserListQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    role: userRoleSchema.optional(),
    status: userStatusSchema.optional(),
    canSell: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    canMediateOrders: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()

export const updateAdminUserInputSchema = z
  .object({
    status: userStatusSchema.optional(),
    canSell: z.boolean().optional(),
    canMediateOrders: z.boolean().optional(),
    role: userRoleSchema.optional(),
    internalNotes: z.string().trim().max(2000).nullable().optional(),
    reason: z.string().trim().min(2).max(500),
  })
  .strict()

export const enrollMediatorInputSchema = z
  .object({
    email: z.string().trim().email().max(254),
    access: z.enum(['MEDIATOR', 'ADMIN_MEDIATOR']),
    reason: z.string().trim().min(2).max(500),
  })
  .strict()

export const salesPeriodSchema = z.enum(['7d', '30d', '90d', '12m'])
export const salesAnalyticsQuerySchema = z
  .object({ period: salesPeriodSchema.default('30d') })
  .strict()
export const salesAnalyticsSchema = z.object({
  period: salesPeriodSchema,
  startDate: z.string(),
  endDate: z.string(),
  totals: z.object({
    orderValue: z.number().nonnegative(),
    confirmedValue: z.number().nonnegative(),
    completedValue: z.number().nonnegative(),
    cancelledValue: z.number().nonnegative(),
    completedOrders: z.number().int().nonnegative(),
    averageOrderValue: z.number().nonnegative(),
  }),
  bySellerType: z.object({
    official: z.number().nonnegative(),
    secondHand: z.number().nonnegative(),
  }),
  timeline: z.array(
    z.object({
      label: z.string(),
      orderCount: z.number().int().nonnegative(),
      completedCount: z.number().int().nonnegative(),
      completedValue: z.number().nonnegative(),
    }),
  ),
  topProducts: z.array(
    z.object({
      productId: z.string(),
      name: z.string(),
      quantity: z.number().int().nonnegative(),
      value: z.number().nonnegative(),
    }),
  ),
  dealerPerformance: z.array(
    z.object({
      dealerId: z.string(),
      name: z.string(),
      completedOrders: z.number().int().nonnegative(),
      completedValue: z.number().nonnegative(),
    }),
  ),
})

export const reportTargetTypeSchema = z.enum(['PRODUCT', 'USER'])
export const reportTypeSchema = z.enum([
  'MISLEADING_PRODUCT',
  'PROHIBITED_ITEM',
  'FRAUD',
  'DUPLICATE_LISTING',
  'INAPPROPRIATE_CONTENT',
  'INCORRECT_CONDITION',
  'SELLER_ISSUE',
  'OTHER',
])
export const reportStatusSchema = z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'])
export const createReportInputSchema = z
  .object({
    targetType: reportTargetTypeSchema,
    targetId: z.string().min(1),
    type: reportTypeSchema,
    description: z.string().trim().min(10).max(2000),
  })
  .strict()
export const updateReportInputSchema = z
  .object({
    status: reportStatusSchema,
    resolution: z.string().trim().min(2).max(2000).nullable().optional(),
    assignedAdminId: z.string().nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (['RESOLVED', 'DISMISSED'].includes(value.status) && !value.resolution) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resolution'],
        message: 'Resolution is required when closing a report.',
      })
    }
  })
export const reportListQuerySchema = z
  .object({
    status: reportStatusSchema.optional(),
    targetType: reportTargetTypeSchema.optional(),
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
export const reportSchema = z.object({
  id: z.string(),
  reporterId: z.string(),
  reporterName: z.string(),
  targetType: reportTargetTypeSchema,
  targetId: z.string(),
  targetLabel: z.string(),
  type: reportTypeSchema,
  description: z.string(),
  status: reportStatusSchema,
  assignedAdminId: z.string().nullable(),
  resolution: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable(),
})

export const notificationTypeSchema = z.enum(['SYSTEM', 'PRODUCT', 'ORDER', 'ACCOUNT', 'REPORT'])
export const notificationSchema = z.object({
  id: z.string(),
  type: notificationTypeSchema,
  title: z.string(),
  message: z.string(),
  referenceType: z.string().nullable(),
  referenceId: z.string().nullable(),
  read: z.boolean(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
})
export const notificationListQuerySchema = z
  .object({
    unreadOnly: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
export const sendNotificationInputSchema = z
  .object({
    userId: z.string().nullable().optional(),
    audience: z.enum(['USER', 'MODERATOR', 'ADMIN', 'ALL']).optional(),
    type: notificationTypeSchema.default('SYSTEM'),
    title: z.string().trim().min(2).max(120),
    message: z.string().trim().min(2).max(1000),
    referenceType: z.string().trim().max(50).nullable().optional(),
    referenceId: z.string().nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.userId && !value.audience)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['audience'],
        message: 'Choose a user or an audience.',
      })
  })

export const auditLogSchema = z.object({
  id: z.string(),
  actorId: z.string(),
  actorLabel: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  requestMethod: z.string(),
  requestPath: z.string(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string(),
})
export const auditLogQuerySchema = z
  .object({
    actorId: z.string().optional(),
    entityType: z.string().trim().max(80).optional(),
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .strict()

export const publicSettingsSchema = z.object({
  appName: z.string(),
  brandMark: z.string(),
  campusDisplayName: z.string(),
  supportEmail: z.string().email().nullable(),
  supportPhone: z.string().nullable(),
  defaultPickupLocations: z.array(z.string()),
  listingExpirationDays: z.number().int().positive(),
  maxActiveListingsPerUser: z.number().int().positive(),
  termsUrl: z.string().url().nullable(),
  privacyUrl: z.string().url().nullable(),
})
export const platformSettingsSchema = publicSettingsSchema.extend({
  allowNewListings: z.boolean(),
  allowOrders: z.boolean(),
  maintenanceMessage: z.string().nullable(),
})
export const updatePlatformSettingsInputSchema = platformSettingsSchema.partial().strict()

export const cleanupResultSchema = z.object({
  staleUploads: z.number().int().nonnegative(),
  readNotifications: z.number().int().nonnegative(),
  revokedSessions: z.number().int().nonnegative(),
  auditLogs: z.number().int().nonnegative(),
  expiredListings: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative(),
  success: z.boolean(),
  completedAt: z.string(),
})

export const indexDriftSchema = z.object({
  model: z.string(),
  toCreate: z.array(z.string()),
  toDrop: z.array(z.string()),
})

export const operationsStatusSchema = z.object({
  mongoReady: z.boolean(),
  redisReady: z.boolean(),
  redisRequired: z.boolean(),
  cleanupEnabled: z.boolean(),
  cleanupRunning: z.boolean(),
  cleanupIntervalMinutes: z.number().int().positive(),
  lastCleanup: cleanupResultSchema.nullable(),
  indexDriftCount: z.number().int().nonnegative(),
})

export interface ApiSuccess<T> {
  success: true
  message: string
  data: T
  meta?: PaginationMeta
}
export interface ApiErrorBody {
  success: false
  error: { code: string; message: string; requestId?: string; details?: unknown }
}
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}
export interface PaginatedResult<T> {
  items: T[]
  meta: PaginationMeta
}

export type UserRole = z.infer<typeof userRoleSchema>
export type UserStatus = z.infer<typeof userStatusSchema>
export type UserProfile = z.infer<typeof userProfileSchema>
export type AuthUser = z.infer<typeof authUserSchema>
export type RequestOtpInput = z.infer<typeof requestOtpInputSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpInputSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>
export type ProductType = z.infer<typeof productTypeSchema>
export type SellerType = z.infer<typeof sellerTypeSchema>
export type ProductCondition = z.infer<typeof productConditionSchema>
export type ProductStatus = z.infer<typeof productStatusSchema>
export type ProductSort = z.infer<typeof productSortSchema>
export type HomepageSectionKey = z.infer<typeof homepageSectionKeySchema>
export type Category = z.infer<typeof categorySchema>
export type ProductImage = z.infer<typeof productImageSchema>
export type ProductSummary = z.infer<typeof productSummarySchema>
export type ProductDetail = z.infer<typeof productDetailSchema>
export type ImageInput = z.infer<typeof imageInputSchema>
export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>
export type CreateOfficialProductInput = z.infer<typeof createOfficialProductInputSchema>
export type UpdateOfficialProductInput = z.infer<typeof updateOfficialProductInputSchema>
export type ProductListQuery = z.infer<typeof productListQuerySchema>
export type AdminProductListQuery = z.infer<typeof adminProductListQuerySchema>
export type HomepageSelectionInput = z.infer<typeof homepageSelectionInputSchema>
export type HomepageSection = z.infer<typeof homepageSectionSchema>
export type HomepagePayload = z.infer<typeof homepagePayloadSchema>

export type UploadedImageAsset = z.infer<typeof uploadedImageAssetSchema>
export type SecondHandCondition = z.infer<typeof secondHandConditionSchema>
export type CreateSecondHandListingInput = z.infer<typeof createSecondHandListingInputSchema>
export type UpdateSecondHandListingInput = z.infer<typeof updateSecondHandListingInputSchema>
export type UserListingQuery = z.infer<typeof userListingQuerySchema>
export type ModerationAction = z.infer<typeof moderationActionSchema>
export type ModerationDecision = z.infer<typeof moderationDecisionSchema>
export type ModerateProductInput = z.infer<typeof moderateProductInputSchema>
export type ModerationHistoryEntry = z.infer<typeof moderationHistoryEntrySchema>
export type SellerSnapshot = z.infer<typeof sellerSnapshotSchema>
export type UserListing = z.infer<typeof userListingSchema>
export type AdminModerationProduct = z.infer<typeof adminModerationProductSchema>
export type AdminModerationQuery = z.infer<typeof adminModerationQuerySchema>
export type CartIssueCode = z.infer<typeof cartIssueCodeSchema>
export type CartIssue = z.infer<typeof cartIssueSchema>
export type CartItem = z.infer<typeof cartItemSchema>
export type Cart = z.infer<typeof cartSchema>
export type AddCartItemInput = z.infer<typeof addCartItemInputSchema>
export type UpdateCartItemInput = z.infer<typeof updateCartItemInputSchema>
export type CheckoutInput = z.infer<typeof checkoutInputSchema>
export type OrderStatus = z.infer<typeof orderStatusSchema>
export type OrderItem = z.infer<typeof orderItemSchema>
export type OrderStatusHistory = z.infer<typeof orderStatusHistorySchema>
export type OrderSummary = z.infer<typeof orderSummarySchema>
export type OrderDetail = z.infer<typeof orderDetailSchema>
export type OrderListQuery = z.infer<typeof orderListQuerySchema>
export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusInputSchema>
export type CancelOrderInput = z.infer<typeof cancelOrderInputSchema>
export type CheckoutResult = z.infer<typeof checkoutResultSchema>

export type DealerWorkingHours = z.infer<typeof dealerWorkingHoursSchema>
export type Dealer = z.infer<typeof dealerSchema>
export type AssignedDealer = z.infer<typeof assignedDealerSchema>
export type AssignedModerator = z.infer<typeof assignedModeratorSchema>
export type CreateDealerInput = z.infer<typeof createDealerInputSchema>
export type UpdateDealerInput = z.infer<typeof updateDealerInputSchema>
export type DealerListQuery = z.infer<typeof dealerListQuerySchema>
export type DealerAssignmentHistory = z.infer<typeof dealerAssignmentHistorySchema>
export type AssignOrderDealerInput = z.infer<typeof assignOrderDealerInputSchema>
export type AssignOrderModeratorInput = z.infer<typeof assignOrderModeratorInputSchema>
export type ChatMessageType = z.infer<typeof chatMessageTypeSchema>
export type ChatMessage = z.infer<typeof chatMessageSchema>
export type ChatMessagesPage = z.infer<typeof chatMessagesPageSchema>
export type SendChatMessageInput = z.infer<typeof sendChatMessageInputSchema>

export type AdminDashboard = z.infer<typeof adminDashboardSchema>
export type AdminUserSummary = z.infer<typeof adminUserSummarySchema>
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>
export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>
export type UpdateAdminUserInput = z.infer<typeof updateAdminUserInputSchema>
export type EnrollMediatorInput = z.infer<typeof enrollMediatorInputSchema>
export type SalesPeriod = z.infer<typeof salesPeriodSchema>
export type SalesAnalyticsQuery = z.infer<typeof salesAnalyticsQuerySchema>
export type SalesAnalytics = z.infer<typeof salesAnalyticsSchema>
export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>
export type ReportType = z.infer<typeof reportTypeSchema>
export type ReportStatus = z.infer<typeof reportStatusSchema>
export type CreateReportInput = z.infer<typeof createReportInputSchema>
export type UpdateReportInput = z.infer<typeof updateReportInputSchema>
export type ReportListQuery = z.infer<typeof reportListQuerySchema>
export type Report = z.infer<typeof reportSchema>
export type NotificationType = z.infer<typeof notificationTypeSchema>
export type Notification = z.infer<typeof notificationSchema>
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>
export type SendNotificationInput = z.infer<typeof sendNotificationInputSchema>
export type AuditLog = z.infer<typeof auditLogSchema>
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>
export type PublicSettings = z.infer<typeof publicSettingsSchema>
export type PlatformSettings = z.infer<typeof platformSettingsSchema>
export type UpdatePlatformSettingsInput = z.infer<typeof updatePlatformSettingsInputSchema>

export type CleanupResult = z.infer<typeof cleanupResultSchema>
export type IndexDrift = z.infer<typeof indexDriftSchema>
export type OperationsStatus = z.infer<typeof operationsStatusSchema>
