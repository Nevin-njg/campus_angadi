import { env } from '../config/env.js'
import { logger } from '../core/http/logger.js'
import { slugify } from '../core/utils/slug.js'
import { connectMongo, disconnectMongo } from '../infrastructure/database/mongoose.connection.js'
import { CategoryService } from '../modules/categories/application/category.service.js'
import { MongooseCategoryRepository } from '../modules/categories/infrastructure/mongoose-category.repository.js'
import { ProductService } from '../modules/products/application/product.service.js'
import { MongooseProductRepository } from '../modules/products/infrastructure/mongoose-product.repository.js'
import {
  ProductImageModel,
  ProductModel,
} from '../modules/products/infrastructure/product.models.js'
import { MongooseUserRepository } from '../modules/users/infrastructure/mongoose-user.repository.js'
import { UserModel, UserProfileModel } from '../modules/users/infrastructure/user.models.js'

const categories = [
  ['Food & Snacks', 'Campus food, snacks and quick refreshments.'],
  ['Stationery', 'Notebooks, pens and everyday academic supplies.'],
  ['Electronics', 'Approved electronics and campus technology essentials.'],
  ['Books', 'Academic books and reference material.'],
  ['Accessories', 'Bags and useful personal accessories.'],
  ['Campus Merch', 'Campus-themed merchandise and apparel.'],
  ['Hostel & Room', 'Practical furniture, lighting and room essentials.'],
  ['Sports & Fitness', 'Sports gear and everyday fitness equipment.'],
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
    title: 'Campus Angadi Charcoal Hoodie',
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
  {
    title: 'Casio Scientific Calculator',
    category: 'Electronics',
    description: 'A reliable scientific calculator suitable for engineering coursework and exams.',
    price: 1099,
    originalPrice: 1299,
    stock: 24,
    isFeatured: true,
    image:
      'https://images.unsplash.com/photo-1564466809058-bf4114d55352?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Insulated Steel Water Bottle',
    category: 'Accessories',
    description: 'A leak-resistant reusable bottle that keeps drinks cool during long class days.',
    price: 349,
    originalPrice: 449,
    stock: 32,
    isFeatured: false,
    image:
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'NITC Classic Cotton T-Shirt',
    category: 'Campus Merch',
    description: 'A breathable cotton campus T-shirt for events, clubs and everyday wear.',
    price: 449,
    originalPrice: 549,
    stock: 45,
    isFeatured: true,
    image:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Engineering Drawing Instrument Kit',
    category: 'Stationery',
    description: 'A complete drawing kit with compass, divider and precision geometry tools.',
    price: 329,
    originalPrice: 399,
    stock: 20,
    isFeatured: false,
    image:
      'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Braided USB-C Charging Cable',
    category: 'Electronics',
    description: 'A durable one-metre braided cable for charging phones, tablets and accessories.',
    price: 249,
    originalPrice: 349,
    stock: 50,
    isFeatured: false,
    image:
      'https://images.unsplash.com/photo-1615526675159-e248c3021d3f?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Graph Notebook — 120 Pages',
    category: 'Stationery',
    description: 'A sturdy graph notebook for laboratory plots, mathematics and engineering work.',
    price: 85,
    originalPrice: null,
    stock: 60,
    isFeatured: false,
    image:
      'https://images.unsplash.com/photo-1517842645767-c639042777db?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Hardbound Laboratory Record',
    category: 'Stationery',
    description: 'A durable hardbound record book designed for lab observations and submissions.',
    price: 120,
    originalPrice: 140,
    stock: 48,
    isFeatured: false,
    image:
      'https://images.unsplash.com/photo-1544816155-12df9643f363?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Wooden Exam Writing Pad',
    category: 'Stationery',
    description: 'A smooth, lightweight writing board with a strong clip for examinations.',
    price: 149,
    originalPrice: 199,
    stock: 28,
    isFeatured: false,
    image:
      'https://images.unsplash.com/photo-1516383607781-913a19294fd1?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Campus Angadi Ceramic Mug',
    category: 'Campus Merch',
    description: 'A matte ceramic mug made for hostel coffee, tea and campus desk setups.',
    price: 249,
    originalPrice: 299,
    stock: 22,
    isFeatured: true,
    image:
      'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Surge-Protected Power Strip',
    category: 'Electronics',
    description: 'A compact multi-socket power strip suitable for hostel desks and study rooms.',
    price: 499,
    originalPrice: 649,
    stock: 17,
    isFeatured: true,
    image:
      'https://images.unsplash.com/photo-1625842268584-8f3296236761?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Document Folder Set — Pack of Four',
    category: 'Stationery',
    description: 'Colour-coded folders for organizing certificates, notes and assignment sheets.',
    price: 99,
    originalPrice: 129,
    stock: 38,
    isFeatured: false,
    image:
      'https://images.unsplash.com/photo-1568667256549-094345857637?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Canvas Campus Tote Bag',
    category: 'Accessories',
    description: 'A washable canvas tote with enough space for notebooks and daily essentials.',
    price: 299,
    originalPrice: 399,
    stock: 26,
    isFeatured: false,
    image:
      'https://images.unsplash.com/photo-1597484662317-9bd7bdda2907?w=900&auto=format&fit=crop&q=80',
  },
] as const

const secondHandProducts = [
  {
    title: 'Engineering Mathematics Volume I',
    category: 'Books',
    description:
      'Used first-year mathematics textbook with clean pages and a few useful annotations.',
    price: 180,
    originalPrice: 650,
    condition: 'GOOD',
    age: 'One academic year',
    reason: 'Course completed',
    image:
      'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Data Structures and Algorithms Textbook',
    category: 'Books',
    description: 'Well-kept reference book with no torn pages and minimal highlighting.',
    price: 320,
    originalPrice: 780,
    condition: 'LIKE_NEW',
    age: 'Eight months',
    reason: 'Bought a newer edition',
    image:
      'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Casio fx-991ES Plus Calculator',
    category: 'Electronics',
    description: 'Fully working scientific calculator with protective cover and a clear display.',
    price: 650,
    originalPrice: 1300,
    condition: 'GOOD',
    age: 'Two years',
    reason: 'Upgraded to another model',
    image:
      'https://images.unsplash.com/photo-1574607383476-f517f260d30b?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Adjustable Study Table Lamp',
    category: 'Hostel & Room',
    description:
      'Warm LED study lamp with adjustable neck, ideal for hostel desks and late-night study.',
    price: 280,
    originalPrice: 699,
    condition: 'GOOD',
    age: 'One year',
    reason: 'Moving out of hostel',
    image:
      'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Compact Mechanical Keyboard',
    category: 'Electronics',
    description: 'Compact mechanical keyboard with tactile switches, tested and working perfectly.',
    price: 1200,
    originalPrice: 2499,
    condition: 'LIKE_NEW',
    age: 'Six months',
    reason: 'Switching to a full-size keyboard',
    image:
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Logitech Wireless Mouse',
    category: 'Electronics',
    description: 'Comfortable wireless mouse with receiver, smooth tracking and good battery life.',
    price: 350,
    originalPrice: 899,
    condition: 'GOOD',
    age: 'One year',
    reason: 'Received another mouse',
    image:
      'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Campus Commuter Bicycle',
    category: 'Sports & Fitness',
    description:
      'Reliable single-speed bicycle recently serviced and ready for daily campus travel.',
    price: 2600,
    originalPrice: 6500,
    condition: 'USED',
    age: 'Three years',
    reason: 'Graduating this semester',
    image:
      'https://images.unsplash.com/photo-1529422643029-d4585747aaf2?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Hostel Study Chair',
    category: 'Hostel & Room',
    description: 'Sturdy study chair with visible cosmetic wear but no structural damage.',
    price: 300,
    originalPrice: 950,
    condition: 'FAIR',
    age: 'Three years',
    reason: 'Room clearance',
    image:
      'https://images.unsplash.com/photo-1503602642458-232111445657?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Over-Ear Bluetooth Headphones',
    category: 'Electronics',
    description: 'Open-box wireless headphones with charging cable and original carrying pouch.',
    price: 800,
    originalPrice: 1799,
    condition: 'OPEN_BOX',
    age: 'Two weeks',
    reason: 'Fit was not comfortable',
    image:
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Aluminium Laptop Stand',
    category: 'Accessories',
    description: 'Stable foldable laptop stand that improves screen height and desk airflow.',
    price: 450,
    originalPrice: 999,
    condition: 'LIKE_NEW',
    age: 'Four months',
    reason: 'No longer required',
    image:
      'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'Hostel Electric Kettle',
    category: 'Hostel & Room',
    description: 'Working one-litre electric kettle with automatic shut-off and cleaned interior.',
    price: 400,
    originalPrice: 999,
    condition: 'USED',
    age: 'Two years',
    reason: 'Leaving campus',
    image:
      'https://images.unsplash.com/photo-1594213114663-d94db9b17125?w=900&auto=format&fit=crop&q=80',
  },
  {
    title: 'English Willow Practice Cricket Bat',
    category: 'Sports & Fitness',
    description: 'Balanced practice bat with a fresh grip and normal signs of match use.',
    price: 700,
    originalPrice: 1800,
    condition: 'GOOD',
    age: 'One season',
    reason: 'Upgraded sports kit',
    image:
      'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=900&auto=format&fit=crop&q=80',
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

  const sellerProfiles = [
    {
      email: 'demo.seller.one@gmail.com',
      fullName: 'Akhil Nair',
      displayName: 'Akhil',
      department: 'Computer Science and Engineering',
      graduationYear: 2027,
    },
    {
      email: 'demo.seller.two@gmail.com',
      fullName: 'Meera Krishnan',
      displayName: 'Meera',
      department: 'Electrical and Electronics Engineering',
      graduationYear: 2026,
    },
  ] as const
  const sellers = []
  for (const profile of sellerProfiles) {
    const seller = await users.findOrCreateByEmail(profile.email, 'USER')
    await UserModel.findByIdAndUpdate(seller.user.id, {
      $set: { profileCompleted: true, canSell: true, status: 'ACTIVE' },
    })
    await UserProfileModel.findOneAndUpdate(
      { userId: seller.user.id },
      {
        $set: {
          fullName: profile.fullName,
          displayName: profile.displayName,
          department: profile.department,
          graduationYear: profile.graduationYear,
          campusRole: 'Student',
          preferredPickupLocation: 'NITC Main Gate',
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    )
    sellers.push(seller.user.id)
  }

  for (let index = 0; index < secondHandProducts.length; index += 1) {
    const item = secondHandProducts[index]!
    const slug = slugify(item.title)
    let product = await ProductModel.findOne({ slug, deletedAt: null }).select('_id')
    if (!product) {
      const categoryId = categoryIds.get(item.category)
      const sellerId = sellers[index % sellers.length]
      if (!categoryId || !sellerId) continue
      product = await ProductModel.create({
        title: item.title,
        slug,
        description: item.description,
        categoryId,
        price: item.price,
        originalPrice: item.originalPrice,
        stock: 1,
        condition: item.condition,
        productType: 'SECOND_HAND',
        sellerType: 'USER',
        sellerId,
        status: 'APPROVED',
        published: true,
        pickupLocation: 'NITC Main Gate',
        tags: [item.category.toLowerCase(), 'second-hand', 'campus'],
        productAge: item.age,
        reasonForSelling: item.reason,
        additionalDetails: 'Demo listing seeded for local marketplace testing.',
        moderationMessage: null,
        submittedAt: new Date(),
        approvedAt: new Date(),
        approvedBy: admin.user.id,
        isFeatured: index < 4,
      })
    }
    await ProductImageModel.updateOne(
      { productId: product._id, displayOrder: 0 },
      {
        $setOnInsert: {
          productId: product._id,
          url: item.image,
          altText: item.title,
          displayOrder: 0,
          isPrimary: true,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    )
  }

  logger.info(
    {
      categories: categories.length,
      officialProducts: demoProducts.length,
      secondHandProducts: secondHandProducts.length,
    },
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
