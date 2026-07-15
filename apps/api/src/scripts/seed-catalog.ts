import { env } from '../config/env.js'
import { logger } from '../core/http/logger.js'
import { slugify } from '../core/utils/slug.js'
import { connectMongo, disconnectMongo } from '../infrastructure/database/mongoose.connection.js'
import { CategoryService } from '../modules/categories/application/category.service.js'
import { MongooseCategoryRepository } from '../modules/categories/infrastructure/mongoose-category.repository.js'
import { ProductService } from '../modules/products/application/product.service.js'
import { MongooseProductRepository } from '../modules/products/infrastructure/mongoose-product.repository.js'
import { ProductModel } from '../modules/products/infrastructure/product.models.js'
import { MongooseUserRepository } from '../modules/users/infrastructure/mongoose-user.repository.js'

const categories = [
  ['Food & Snacks', 'Campus food, snacks and quick refreshments.'],
  ['Stationery', 'Notebooks, pens and everyday academic supplies.'],
  ['Electronics', 'Approved electronics and campus technology essentials.'],
  ['Books', 'Academic books and reference material.'],
  ['Accessories', 'Bags and useful personal accessories.'],
  ['Campus Merch', 'Campus-themed merchandise and apparel.'],
] as const

const demoProducts = [
  {
    title: 'A4 Ruled Notebook — 200 Pages',
    category: 'Stationery',
    description: 'A durable ruled notebook for lectures, assignments and daily campus work.',
    price: 45,
    originalPrice: 60,
    stock: 40,
    isFeatured: true,
    image:
      'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Campus Angaadi Charcoal Hoodie',
    category: 'Campus Merch',
    description: 'A comfortable charcoal hoodie prepared for campus events and everyday wear.',
    price: 799,
    originalPrice: 999,
    stock: 18,
    isFeatured: true,
    image:
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Gel Pen Set — Pack of Five',
    category: 'Stationery',
    description: 'Smooth-writing gel pens suitable for notes, diagrams and examinations.',
    price: 60,
    originalPrice: null,
    stock: 55,
    isFeatured: false,
    image:
      'https://images.unsplash.com/photo-1583485088034-697b5bc36b45?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Campus Logo Backpack',
    category: 'Accessories',
    description: 'A practical campus backpack with padded compartments for books and a laptop.',
    price: 899,
    originalPrice: null,
    stock: 12,
    isFeatured: true,
    image:
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=900&auto=format&fit=crop&q=80',
  },
] as const

async function seed() {
  await connectMongo(env.MONGODB_URI, logger, {
    autoIndex: env.MONGODB_AUTO_INDEX,
    maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
    minPoolSize: env.MONGODB_MIN_POOL_SIZE,
    serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
  })
  const configuredEmail = env.SUPER_ADMIN_EMAILS[0] ?? env.ADMIN_EMAILS[0]
  if (!configuredEmail)
    throw new Error(
      'Configure at least one ADMIN_EMAILS or SUPER_ADMIN_EMAILS address before seeding.',
    )

  const role = env.SUPER_ADMIN_EMAILS.includes(configuredEmail) ? 'SUPER_ADMIN' : 'ADMIN'
  const users = new MongooseUserRepository()
  const admin = await users.findOrCreateByEmail(configuredEmail, role)
  const categoryRepository = new MongooseCategoryRepository()
  const categoryService = new CategoryService(categoryRepository)
  const productService = new ProductService(new MongooseProductRepository(), categoryRepository)

  const categoryIds = new Map<string, string>()
  for (let index = 0; index < categories.length; index += 1) {
    const [name, description] = categories[index]!
    const existing = await categoryRepository.findBySlug(slugify(name))
    const category =
      existing ??
      (await categoryService.create({
        name,
        description,
        imageUrl: null,
        isActive: true,
        displayOrder: index,
      }))
    categoryIds.set(name, category.id)
  }

  for (const item of demoProducts) {
    if (await ProductModel.exists({ slug: slugify(item.title), deletedAt: null })) continue
    const categoryId = categoryIds.get(item.category)
    if (!categoryId) continue
    await productService.createOfficial(
      {
        title: item.title,
        description: item.description,
        categoryId,
        price: item.price,
        originalPrice: item.originalPrice,
        stock: item.stock,
        pickupLocation: 'Main campus pickup desk',
        tags: [item.category.toLowerCase(), 'campus'],
        isFeatured: item.isFeatured,
        publish: true,
        images: [{ url: item.image, altText: item.title, displayOrder: 0, isPrimary: true }],
      },
      admin.user.id,
    )
  }

  logger.info(
    { categories: categories.length, products: demoProducts.length },
    'Development catalogue seed completed',
  )
}

seed()
  .catch((error: unknown) => {
    logger.error({ err: error }, 'Catalogue seed failed')
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectMongo()
  })
