import '../infrastructure/database/model-registry.js'
import { env } from '../config/env.js'
import { logger } from '../core/http/logger.js'
import {
  connectMongo,
  disconnectMongo,
} from '../infrastructure/database/mongoose.connection.js'
import {
  HomepageSectionModel,
  HomepageSelectionModel,
} from '../modules/homepage/infrastructure/homepage.model.js'

async function main(): Promise<void> {
  await connectMongo(env.MONGODB_URI, logger, {
    autoIndex: false,
    maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
    minPoolSize: env.MONGODB_MIN_POOL_SIZE,
    serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
  })

  const legacySelections = await HomepageSelectionModel.find({
    key: {
      $in: ['FEATURED', 'SECOND_HAND'],
    },
  }).lean()

  const legacyByKey = new Map(
    legacySelections.map((selection) => [
      selection.key,
      selection.productIds ?? [],
    ]),
  )

  const sections = [
    {
      type: 'FEATURED_PRODUCTS' as const,
      title: 'Featured Products',
      enabled: true,
      displayOrder: 1,
      limit: env.HOMEPAGE_FEATURED_LIMIT,
      departmentId: null,
      productIds: legacyByKey.get('FEATURED') ?? [],
      storeIds: [],
      updatedBy: null,
    },
    {
      type: 'POPULAR_PRODUCTS' as const,
      title: 'Popular Products',
      enabled: true,
      displayOrder: 2,
      limit: env.HOMEPAGE_FEATURED_LIMIT,
      departmentId: null,
      productIds: [],
      storeIds: [],
      updatedBy: null,
    },
    {
      type: 'SECOND_HAND_PRODUCTS' as const,
      title: 'Second Hand',
      enabled: true,
      displayOrder: 3,
      limit: env.HOMEPAGE_SECOND_HAND_LIMIT,
      departmentId: null,
      productIds: legacyByKey.get('SECOND_HAND') ?? [],
      storeIds: [],
      updatedBy: null,
    },
  ]

  let created = 0
  let existing = 0

  for (const section of sections) {
    const result = await HomepageSectionModel.updateOne(
      {
        type: section.type,
        departmentId: null,
      },
      {
        $setOnInsert: section,
      },
      {
        upsert: true,
      },
    )

    if (result.upsertedCount > 0) {
      created += 1
      logger.info(
        { sectionType: section.type },
        'Created dynamic homepage section',
      )
    } else {
      existing += 1
      logger.info(
        { sectionType: section.type },
        'Dynamic homepage section already exists; leaving it unchanged',
      )
    }
  }

  const dynamicSections = await HomepageSectionModel.find()
    .sort({ displayOrder: 1, createdAt: 1 })
    .select('type title enabled displayOrder limit productIds departmentId')
    .lean()

  logger.info(
    {
      created,
      existing,
      legacySelectionsPreserved: legacySelections.length,
      dynamicSections: dynamicSections.map((section) => ({
        id: String(section._id),
        type: section.type,
        title: section.title,
        enabled: section.enabled,
        displayOrder: section.displayOrder,
        limit: section.limit,
        manualProductCount: section.productIds?.length ?? 0,
        departmentId: section.departmentId
          ? String(section.departmentId)
          : null,
      })),
    },
    'Dynamic homepage migration completed',
  )

  logger.info(
    'Legacy HomepageSelection records were not deleted or modified',
  )
}

main()
  .catch((error: unknown) => {
    logger.error(
      { err: error },
      'Dynamic homepage migration failed',
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectMongo()
  })
