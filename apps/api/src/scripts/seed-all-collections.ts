import 'dotenv/config'
import '../infrastructure/database/model-registry.js'
import { connectMongo, disconnectMongo } from '../infrastructure/database/mongoose.connection.js'
import { logger } from '../core/http/logger.js'
import { env } from '../config/env.js'

import { UserModel, UserProfileModel } from '../modules/users/infrastructure/user.models.js'
import { ProductModel } from '../modules/products/infrastructure/product.models.js'
import {
  DealerModel,
  DealerAssignmentHistoryModel,
} from '../modules/dealers/infrastructure/dealer.models.js'
import { AuditLogModel } from '../modules/audit/infrastructure/audit-log.model.js'
import { SessionModel } from '../modules/auth/infrastructure/session.model.js'
import { CartModel } from '../modules/cart/infrastructure/cart.model.js'
import { ChatMessageModel } from '../modules/chat/infrastructure/chat-message.model.js'
import { HomepageSelectionModel } from '../modules/homepage/infrastructure/homepage.model.js'
import { ModerationHistoryModel } from '../modules/listings/infrastructure/moderation-history.model.js'
import { NotificationModel } from '../modules/notifications/infrastructure/notification.model.js'
import {
  OrderModel,
  OrderItemModel,
  OrderStatusHistoryModel,
} from '../modules/orders/infrastructure/order.models.js'
import { ReportModel } from '../modules/reports/infrastructure/report.model.js'
import { PlatformSettingModel } from '../modules/settings/infrastructure/platform-setting.model.js'
import { UploadAssetModel } from '../modules/uploads/infrastructure/upload-asset.model.js'

async function seed() {
  await connectMongo(env.MONGODB_URI, logger, {
    autoIndex: env.MONGODB_AUTO_INDEX,
    maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
    minPoolSize: env.MONGODB_MIN_POOL_SIZE,
    serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
  })

  try {
    logger.info('Starting full database collections seeding...')

    // 1. Get or Create Super Admin
    const superAdminEmail = env.SUPER_ADMIN_EMAILS[0] ?? 'campusangadi@gmail.com'
    let superAdmin = await UserModel.findOne({ email: superAdminEmail })
    if (!superAdmin) {
      superAdmin = await UserModel.create({
        email: superAdminEmail,
        emailVerified: true,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        canSell: true,
        profileCompleted: true,
      })
    } else {
      superAdmin.role = 'SUPER_ADMIN'
      superAdmin.status = 'ACTIVE'
      superAdmin.profileCompleted = true
      await superAdmin.save()
    }

    let superAdminProfile = await UserProfileModel.findOne({ userId: superAdmin._id })
    if (!superAdminProfile) {
      superAdminProfile = await UserProfileModel.create({
        userId: superAdmin._id,
        fullName: 'Campus Angadi Super Admin',
        displayName: 'Super Admin',
        phoneNumber: '+919900000000',
        department: 'Administration',
        graduationYear: 2025,
        campusRole: 'Staff',
        preferredPickupLocation: 'Main Office',
      })
    }
    logger.info('Super Admin user prepared')

    // 2. Fetch demo sellers or create them
    const akhil = await UserModel.findOne({ email: 'demo.seller.one@gmail.com' })
    const meera = await UserModel.findOne({ email: 'demo.seller.two@gmail.com' })
    if (!akhil || !meera) {
      logger.warn('Sellers not found. Please run seed:catalog first.')
    }

    // 3. Create a Demo Buyer
    const buyerEmail = 'buyer.demo@gmail.com'
    let buyer = await UserModel.findOne({ email: buyerEmail })
    if (!buyer) {
      buyer = await UserModel.create({
        email: buyerEmail,
        emailVerified: true,
        role: 'USER',
        status: 'ACTIVE',
        canSell: true,
        profileCompleted: true,
      })
    }
    let buyerProfile = await UserProfileModel.findOne({ userId: buyer._id })
    if (!buyerProfile) {
      buyerProfile = await UserProfileModel.create({
        userId: buyer._id,
        fullName: 'Demo Buyer User',
        displayName: 'Demo Buyer',
        phoneNumber: '+919900000003',
        department: 'Mechanical Engineering',
        graduationYear: 2028,
        campusRole: 'Student',
        preferredPickupLocation: 'NITC Main Gate',
      })
    }
    logger.info('Demo Buyer user prepared')

    // 4. Fetch Products
    const products = await ProductModel.find({ deletedAt: null })
    if (!products.length) {
      throw new Error('No products found in the database. Please run npm run seed:catalog first.')
    }
    logger.info({ count: products.length }, 'Fetched products for referencing')

    // 5. Fetch Dealers
    const dealers = await DealerModel.find({ deletedAt: null })
    if (!dealers.length) {
      throw new Error('No dealers found in the database. Please run npm run seed:dealers first.')
    }
    logger.info({ count: dealers.length }, 'Fetched dealers for referencing')

    // 6. Platform Settings
    let platformSetting = await PlatformSettingModel.findById('platform')
    if (!platformSetting) {
      platformSetting = await PlatformSettingModel.create({
        _id: 'platform',
        appName: 'Campus Angadi',
        brandMark: 'CA',
        campusDisplayName: 'NIT Calicut',
        supportEmail: 'support@campusangadi.com',
        supportPhone: '+919900000999',
        defaultPickupLocations: ['NITC Main Gate', 'Main campus pickup desk', 'Hostel A Office'],
        listingExpirationDays: 30,
        maxActiveListingsPerUser: 20,
        allowNewListings: true,
        allowOrders: true,
      })
      logger.info('PlatformSetting seeded')
    }

    // 7. Sessions
    await SessionModel.deleteMany({})
    const sessions = [
      {
        _id: 'sess_admin_1234567890123456',
        userId: superAdmin._id,
        refreshTokenHash: 'sha256_mock_hash_admin',
        refreshJti: 'jti_admin_123',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      {
        _id: 'sess_buyer_1234567890123456',
        userId: buyer._id,
        refreshTokenHash: 'sha256_mock_hash_buyer',
        refreshJti: 'jti_buyer_123',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    ]
    await SessionModel.insertMany(sessions)
    logger.info({ count: sessions.length }, 'Sessions seeded')

    // 8. Cart
    await CartModel.deleteMany({ userId: buyer._id })
    await CartModel.create({
      userId: buyer._id,
      items: [
        {
          productId: products[0]?._id,
          quantity: 2,
          priceAtAddition: products[0]?.price ?? 10,
        },
        {
          productId: products[1]?._id,
          quantity: 1,
          priceAtAddition: products[1]?.price ?? 20,
        },
      ],
    })
    logger.info('Cart seeded')

    // 9. Orders, OrderItems, OrderStatusHistories
    await OrderModel.deleteMany({})
    await OrderItemModel.deleteMany({})
    await OrderStatusHistoryModel.deleteMany({})

    const dealer = dealers[0]!
    const product1 = products[0]!
    const product2 = products[1]!
    const product3 = products[2]!

    // Order 1: Completed
    const order1 = await OrderModel.create({
      checkoutGroupId: 'chk_group_1',
      orderNumber: 'CA-2026-0001',
      buyerId: buyer._id,
      sellerType: 'ADMIN',
      sellerId: superAdmin._id,
      status: 'COMPLETED',
      subtotal: product1.price * 2,
      totalAmount: product1.price * 2,
      itemCount: 2,
      fullName: buyerProfile?.fullName ?? 'Demo Buyer',
      phoneNumber: buyerProfile?.phoneNumber ?? '+919900000003',
      campusId: 'M230123CS',
      department: buyerProfile?.department ?? 'Computer Science',
      pickupLocation: 'Main campus pickup desk',
      assignedDealerId: dealer._id,
      assignedDealerName: dealer.displayName,
      assignedDealerPhone: dealer.phoneNumber,
      dealerAssignedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    })
    await OrderItemModel.create({
      orderId: order1._id,
      productId: product1._id,
      productName: product1.title,
      productSlug: product1.slug,
      productImageUrl:
        'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=900&auto=format&fit=crop&q=80',
      sellerId: superAdmin._id,
      productType: 'NEW',
      quantity: 2,
      unitPrice: product1.price,
      totalPrice: product1.price * 2,
    })
    await OrderStatusHistoryModel.insertMany([
      {
        orderId: order1._id,
        fromStatus: null,
        toStatus: 'PENDING',
        note: 'Order created',
        actorId: buyer._id,
      },
      {
        orderId: order1._id,
        fromStatus: 'PENDING',
        toStatus: 'WAITING_FOR_DEALER_ASSIGNMENT',
        note: 'Awaiting assignment',
        actorId: null,
      },
      {
        orderId: order1._id,
        fromStatus: 'WAITING_FOR_DEALER_ASSIGNMENT',
        toStatus: 'CONFIRMED',
        note: 'Dealer assigned & order confirmed',
        actorId: dealer.mediatorUserId,
      },
      {
        orderId: order1._id,
        fromStatus: 'CONFIRMED',
        toStatus: 'READY_FOR_PICKUP',
        note: 'Order is ready at pickup location',
        actorId: dealer.mediatorUserId,
      },
      {
        orderId: order1._id,
        fromStatus: 'READY_FOR_PICKUP',
        toStatus: 'COMPLETED',
        note: 'Order picked up successfully',
        actorId: dealer.mediatorUserId,
      },
    ])

    // Order 2: Ready for Pickup (Active)
    const order2 = await OrderModel.create({
      checkoutGroupId: 'chk_group_2',
      orderNumber: 'CA-2026-0002',
      buyerId: buyer._id,
      sellerType: 'USER',
      sellerId: akhil?._id ?? superAdmin._id,
      status: 'READY_FOR_PICKUP',
      subtotal: product2.price,
      totalAmount: product2.price,
      itemCount: 1,
      fullName: buyerProfile?.fullName ?? 'Demo Buyer',
      phoneNumber: buyerProfile?.phoneNumber ?? '+919900000003',
      campusId: 'M230123CS',
      department: buyerProfile?.department ?? 'Computer Science',
      pickupLocation: 'NITC Main Gate',
      assignedDealerId: dealer._id,
      assignedDealerName: dealer.displayName,
      assignedDealerPhone: dealer.phoneNumber,
      dealerAssignedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    })
    await OrderItemModel.create({
      orderId: order2._id,
      productId: product2._id,
      productName: product2.title,
      productSlug: product2.slug,
      productImageUrl:
        'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=900&auto=format&fit=crop&q=80',
      sellerId: akhil?._id ?? superAdmin._id,
      productType: 'SECOND_HAND',
      quantity: 1,
      unitPrice: product2.price,
      totalPrice: product2.price,
    })
    await OrderStatusHistoryModel.insertMany([
      {
        orderId: order2._id,
        fromStatus: null,
        toStatus: 'PENDING',
        note: 'Order created',
        actorId: buyer._id,
      },
      {
        orderId: order2._id,
        fromStatus: 'PENDING',
        toStatus: 'WAITING_FOR_DEALER_ASSIGNMENT',
        note: 'Awaiting assignment',
        actorId: null,
      },
      {
        orderId: order2._id,
        fromStatus: 'WAITING_FOR_DEALER_ASSIGNMENT',
        toStatus: 'CONFIRMED',
        note: 'Dealer assigned',
        actorId: dealer.mediatorUserId,
      },
      {
        orderId: order2._id,
        fromStatus: 'CONFIRMED',
        toStatus: 'READY_FOR_PICKUP',
        note: 'Brought to Main Gate for pickup',
        actorId: dealer.mediatorUserId,
      },
    ])

    // Order 3: Cancelled
    const order3 = await OrderModel.create({
      checkoutGroupId: 'chk_group_3',
      orderNumber: 'CA-2026-0003',
      buyerId: buyer._id,
      sellerType: 'ADMIN',
      sellerId: superAdmin._id,
      status: 'CANCELLED',
      subtotal: product3.price,
      totalAmount: product3.price,
      itemCount: 1,
      fullName: buyerProfile?.fullName ?? 'Demo Buyer',
      phoneNumber: buyerProfile?.phoneNumber ?? '+919900000003',
      campusId: 'M230123CS',
      department: buyerProfile?.department ?? 'Computer Science',
      pickupLocation: 'Main campus pickup desk',
      cancelledAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    })
    await OrderItemModel.create({
      orderId: order3._id,
      productId: product3._id,
      productName: product3.title,
      productSlug: product3.slug,
      productImageUrl:
        'https://images.unsplash.com/photo-1583485088034-697b5bc36b45?w=900&auto=format&fit=crop&q=80',
      sellerId: superAdmin._id,
      productType: 'NEW',
      quantity: 1,
      unitPrice: product3.price,
      totalPrice: product3.price,
    })
    await OrderStatusHistoryModel.insertMany([
      {
        orderId: order3._id,
        fromStatus: null,
        toStatus: 'PENDING',
        note: 'Order created',
        actorId: buyer._id,
      },
      {
        orderId: order3._id,
        fromStatus: 'PENDING',
        toStatus: 'CANCELLED',
        note: 'Cancelled by user',
        actorId: buyer._id,
      },
    ])
    logger.info('Orders, OrderItems, and OrderStatusHistories seeded')

    // 10. ChatMessageModel
    await ChatMessageModel.deleteMany({})
    await ChatMessageModel.insertMany([
      {
        orderId: order2._id,
        senderId: buyer._id,
        senderKind: 'BUYER',
        senderName: buyerProfile?.displayName ?? 'Demo Buyer',
        type: 'TEXT',
        text: 'Hi, is the order ready for pickup?',
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      },
      {
        orderId: order2._id,
        senderId: dealer.mediatorUserId,
        senderKind: 'TEAM',
        senderName: dealer.displayName,
        type: 'TEXT',
        text: 'Yes! It is ready at the NITC Main Gate. You can collect it anytime before 8 PM.',
        createdAt: new Date(Date.now() - 3.8 * 60 * 60 * 1000),
      },
      {
        orderId: order2._id,
        senderId: buyer._id,
        senderKind: 'BUYER',
        senderName: buyerProfile?.displayName ?? 'Demo Buyer',
        type: 'TEXT',
        text: 'Great, thanks! I am on my way.',
        createdAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000),
      },
    ])
    logger.info('ChatMessages seeded')

    // 11. DealerAssignmentHistory
    await DealerAssignmentHistoryModel.deleteMany({})
    await DealerAssignmentHistoryModel.insertMany([
      {
        orderId: order1._id,
        previousDealerId: null,
        newDealerId: dealer._id,
        newDealerName: dealer.displayName,
        newDealerPhone: dealer.phoneNumber,
        reason: 'Auto assigned based on queue and active status',
        mode: 'AUTO',
      },
      {
        orderId: order2._id,
        previousDealerId: null,
        newDealerId: dealer._id,
        newDealerName: dealer.displayName,
        newDealerPhone: dealer.phoneNumber,
        reason: 'Auto assigned based on queue and active status',
        mode: 'AUTO',
      },
    ])
    logger.info('DealerAssignmentHistories seeded')

    // 12. AuditLogModel
    await AuditLogModel.deleteMany({})
    await AuditLogModel.insertMany([
      {
        actorId: superAdmin._id,
        actorLabel: 'Super Admin',
        action: 'UPDATE_SETTINGS',
        entityType: 'PlatformSetting',
        entityId: 'platform',
        requestMethod: 'PUT',
        requestPath: '/api/v1/settings',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      },
      {
        actorId: superAdmin._id,
        actorLabel: 'Super Admin',
        action: 'APPROVE_PRODUCT',
        entityType: 'Product',
        entityId: product2._id.toString(),
        requestMethod: 'POST',
        requestPath: `/api/v1/products/${product2._id.toString()}/approve`,
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      },
    ])
    logger.info('AuditLogs seeded')

    // 13. HomepageSelectionModel
    await HomepageSelectionModel.deleteMany({})
    const featuredProducts = products.filter((p) => p.isFeatured).map((p) => p._id)
    const officialProducts = products.filter((p) => p.productType === 'NEW').map((p) => p._id)
    const secondHandProductsList = products
      .filter((p) => p.productType === 'SECOND_HAND')
      .map((p) => p._id)
    const recentProducts = products.slice(0, 8).map((p) => p._id)

    await HomepageSelectionModel.insertMany([
      { key: 'FEATURED', productIds: featuredProducts, updatedBy: superAdmin._id },
      { key: 'OFFICIAL', productIds: officialProducts, updatedBy: superAdmin._id },
      { key: 'SECOND_HAND', productIds: secondHandProductsList, updatedBy: superAdmin._id },
      { key: 'RECENT', productIds: recentProducts, updatedBy: superAdmin._id },
    ])
    logger.info('HomepageSelections seeded')

    // 14. ModerationHistoryModel
    await ModerationHistoryModel.deleteMany({})
    const moderationEntries = []
    for (const p of products) {
      moderationEntries.push({
        productId: p._id,
        action: 'SUBMITTED',
        fromStatus: null,
        toStatus: 'PENDING_APPROVAL',
        reason: 'Initial submission',
        actorId: p.sellerId,
      })
      moderationEntries.push({
        productId: p._id,
        action: 'APPROVED',
        fromStatus: 'PENDING_APPROVAL',
        toStatus: 'APPROVED',
        reason: 'Approved for campus listing',
        actorId: superAdmin._id,
      })
    }
    await ModerationHistoryModel.insertMany(moderationEntries)
    logger.info('ModerationHistory records seeded')

    // 15. NotificationModel
    await NotificationModel.deleteMany({})
    await NotificationModel.insertMany([
      {
        userId: buyer._id,
        type: 'ORDER',
        title: 'Order Completed',
        message: `Your order CA-2026-0001 has been marked as completed. Thank you for shopping!`,
        referenceType: 'Order',
        referenceId: order1._id.toString(),
        readAt: new Date(),
      },
      {
        userId: buyer._id,
        type: 'ORDER',
        title: 'Order Ready for Pickup',
        message: `Your order CA-2026-0002 is ready for pickup at NITC Main Gate.`,
        referenceType: 'Order',
        referenceId: order2._id.toString(),
        readAt: null,
      },
      {
        userId: akhil?._id ?? superAdmin._id,
        type: 'PRODUCT',
        title: 'Listing Approved',
        message: `Your second hand product listing "${product2.title}" has been approved.`,
        referenceType: 'Product',
        referenceId: product2._id.toString(),
        readAt: null,
      },
    ])
    logger.info('Notifications seeded')

    // 16. ReportModel
    await ReportModel.deleteMany({})
    await ReportModel.insertMany([
      {
        reporterId: buyer._id,
        targetType: 'PRODUCT',
        targetId: product3._id,
        type: 'INCORRECT_CONDITION',
        description:
          'The product describes the items as LIKE_NEW but in photos it looks scratched and used.',
        status: 'OPEN',
      },
      {
        reporterId: buyer._id,
        targetType: 'USER',
        targetId: akhil?._id ?? superAdmin._id,
        type: 'SELLER_ISSUE',
        description: 'The seller responded late and was not friendly.',
        status: 'RESOLVED',
        assignedAdminId: superAdmin._id,
        resolution: 'Warned the user about delayed responses.',
        resolvedAt: new Date(),
      },
    ])
    logger.info('Reports seeded')

    // 17. UploadAssetModel
    await UploadAssetModel.deleteMany({})
    const uploadAssets = []
    for (const p of products) {
      uploadAssets.push({
        ownerId: p.sellerId,
        provider: 'CLOUDINARY',
        publicId: `cloudinary_mock_${p.slug}`,
        url: `https://images.unsplash.com/photo-mock-${p.slug}`,
        mimeType: 'image/jpeg',
        bytes: 154200,
        width: 1200,
        height: 800,
        status: 'ATTACHED',
        productId: p._id,
      })
    }
    await UploadAssetModel.insertMany(uploadAssets)
    logger.info('UploadAssets seeded')

    logger.info('Database collections seeded completely!')
  } catch (error) {
    logger.error({ err: error }, 'Full seeding failed')
    throw error
  } finally {
    await disconnectMongo()
  }
}

seed().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
