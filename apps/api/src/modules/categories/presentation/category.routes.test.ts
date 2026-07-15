import { describe, expect, it, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createCategoryRouter, createAdminCategoryRouter } from './category.routes.js'
import { CategoryService } from '../application/category.service.js'
import { MongooseCategoryRepository } from '../infrastructure/mongoose-category.repository.js'
import { CategoryModel } from '../infrastructure/category.model.js'
import { errorHandler } from '../../../core/middleware/error-handler.js'

describe('Category Routes', () => {
  let app: express.Application
  let categories: MongooseCategoryRepository
  let service: CategoryService
  let testCategoryId: string

  beforeEach(async () => {
    categories = new MongooseCategoryRepository()
    service = new CategoryService(categories)

    const cat = await CategoryModel.create({
      name: 'Electronics',
      slug: 'electronics',
      description: 'Gadgets',
      isActive: true,
      displayOrder: 1
    })
    testCategoryId = cat._id.toString()

    app = express()
    app.use(express.json())

    const authenticate = (req: any, res: any, next: any) => {
      const authHeader = req.headers['authorization']
      if (authHeader === 'Bearer admin-token') {
        req.auth = { user: { id: 'admin-1', role: 'ADMIN' } }
        next()
      } else if (authHeader === 'Bearer user-token') {
        req.auth = { user: { id: 'user-1', role: 'USER' } }
        next()
      } else {
        res.status(401).json({ error: { code: 'AUTHENTICATION_REQUIRED' } })
      }
    }

    app.use('/categories', createCategoryRouter(service))
    app.use('/admin/categories', authenticate, createAdminCategoryRouter(service, (req, res, next) => next()))
    app.use(errorHandler)
  })

  it('GET /categories lists public categories', async () => {
    const response = await request(app).get('/categories')
    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.length).toBeGreaterThan(0)
    expect(response.body.data[0].name).toBe('Electronics')
  })

  it('GET /admin/categories lists admin categories', async () => {
    const response = await request(app)
      .get('/admin/categories')
      .set('Authorization', 'Bearer admin-token')
    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
  })

  it('GET /admin/categories fails for normal user', async () => {
    const response = await request(app)
      .get('/admin/categories')
      .set('Authorization', 'Bearer user-token')
    expect(response.status).toBe(403)
  })

  it('POST /admin/categories creates a new category', async () => {
    const response = await request(app)
      .post('/admin/categories')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Books', isActive: true, displayOrder: 2 })

    if (response.status !== 201) console.log(JSON.stringify(response.body, null, 2))
    expect(response.status).toBe(201)
    expect(response.body.success).toBe(true)
    expect(response.body.data.name).toBe('Books')
  })

  it('POST /admin/categories fails validation with invalid slug', async () => {
    const response = await request(app)
      .post('/admin/categories')
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Books', slug: 'Invalid slug!!!' })

    expect(response.status).toBe(400)
  })

  it('PATCH /admin/categories/:id updates a category', async () => {
    const response = await request(app)
      .patch(`/admin/categories/${testCategoryId}`)
      .set('Authorization', 'Bearer admin-token')
      .send({ name: 'Updated Electronics' })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.name).toBe('Updated Electronics')
  })

  it('DELETE /admin/categories/:id removes a category', async () => {
    const response = await request(app)
      .delete(`/admin/categories/${testCategoryId}`)
      .set('Authorization', 'Bearer admin-token')

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)

    // Verify it is removed
    const cat = await CategoryModel.findById(testCategoryId)
    expect(cat?.deletedAt).not.toBeNull()
  })
})
