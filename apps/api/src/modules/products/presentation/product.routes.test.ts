import { describe, expect, it, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import mongoose from 'mongoose'
import { createProductRouter, createAdminProductRouter } from './product.routes.js'
import { ProductService } from '../application/product.service.js'
import { MongooseProductRepository } from '../infrastructure/mongoose-product.repository.js'
import { MongooseCategoryRepository } from '../../categories/infrastructure/mongoose-category.repository.js'
import { ProductModel } from '../infrastructure/product.models.js'
import { CategoryModel } from '../../categories/infrastructure/category.model.js'
import { UserModel } from '../../users/infrastructure/user.models.js'
import { errorHandler } from '../../../core/middleware/error-handler.js'

describe('Product Routes', () => {
  let app: express.Application
  let products: MongooseProductRepository
  let categories: MongooseCategoryRepository
  let service: ProductService
  let testProductId: string
  let testCategoryId: string
  let testAdminId: string

  beforeEach(async () => {
    products = new MongooseProductRepository()
    categories = new MongooseCategoryRepository()
    service = new ProductService(products, categories)

    const admin = await UserModel.create({
      email: 'admin@campus.edu',
      role: 'ADMIN',
      status: 'ACTIVE',
    })
    testAdminId = admin._id.toString()

    const cat = await CategoryModel.create({
      name: 'Electronics',
      slug: 'electronics',
      isActive: true,
      displayOrder: 1,
    })
    testCategoryId = cat._id.toString()

    const prod = await ProductModel.create({
      title: 'Test Laptop',
      slug: 'test-laptop',
      description: 'A great laptop',
      categoryId: cat._id,
      price: 999,
      stock: 10,
      condition: 'NEW',
      productType: 'NEW',
      sellerType: 'ADMIN',
      sellerId: testAdminId,
      status: 'APPROVED',
      published: true,
      isFeatured: false,
      viewCount: 0,
      completedOrderCount: 0,
      approvedAt: new Date(),
    })
    testProductId = prod._id.toString()

    app = express()
    app.use(express.json())

    const authenticate = (req: any, res: any, next: any) => {
      const authHeader = req.headers['authorization']
      if (authHeader === 'Bearer admin-token') {
        req.auth = { user: { id: testAdminId, role: 'ADMIN' } }
        next()
      } else {
        res.status(401).json({ error: { code: 'AUTHENTICATION_REQUIRED' } })
      }
    }

    app.use('/products', createProductRouter(service))
    app.use(
      '/admin/products',
      authenticate,
      createAdminProductRouter(service, (req, res, next) => next()),
    )
    app.use(errorHandler)
  })

  it('GET /products lists public products', async () => {
    const response = await request(app).get('/products')
    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.length).toBeGreaterThan(0)
    expect(response.body.data[0].title).toBe('Test Laptop')
  })

  it('GET /products/:slug gets a product by slug', async () => {
    const response = await request(app).get('/products/test-laptop')
    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.title).toBe('Test Laptop')
  })

  it('GET /products/:slug fails for non-existent product', async () => {
    const response = await request(app).get('/products/non-existent')
    expect(response.status).toBe(404)
  })

  it('GET /admin/products lists admin products', async () => {
    const response = await request(app)
      .get('/admin/products')
      .set('Authorization', 'Bearer admin-token')

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.length).toBeGreaterThan(0)
  })

  it('POST /admin/products creates an official product', async () => {
    const response = await request(app)
      .post('/admin/products')
      .set('Authorization', 'Bearer admin-token')
      .send({
        title: 'New Phone',
        description: 'Brand new smartphone',
        categoryId: testCategoryId,
        price: 500,
        stock: 5,
        images: [],
      })

    if (response.status !== 201) console.log(JSON.stringify(response.body, null, 2))
    expect(response.status).toBe(201)
    expect(response.body.success).toBe(true)
    expect(response.body.data.title).toBe('New Phone')
  })

  it('POST /admin/products fails validation with invalid price', async () => {
    const response = await request(app)
      .post('/admin/products')
      .set('Authorization', 'Bearer admin-token')
      .send({
        title: 'New Phone',
        description: 'Brand new smartphone',
        categoryId: testCategoryId,
        price: -10, // Invalid negative price
        stock: 5,
        images: [],
      })

    expect(response.status).toBe(400)
  })

  it('PATCH /admin/products/:id updates an official product', async () => {
    const response = await request(app)
      .patch(`/admin/products/${testProductId}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ title: 'Updated Laptop', price: 899 })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.title).toBe('Updated Laptop')
    expect(response.body.data.price).toBe(899)
  })
})
