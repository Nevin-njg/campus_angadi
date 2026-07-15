import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createHomepageRouter, createAdminHomepageRouter } from './homepage.routes.js'
import type { HomepageService } from '../application/homepage.service.js'

describe('Homepage Routes', () => {
  let app: express.Express
  let mockService: vi.Mocked<Partial<HomepageService>>

  beforeEach(() => {
    app = express()
    app.use(express.json())

    mockService = {
      getPublic: vi.fn(),
      getAdminConfiguration: vi.fn(),
      updateSelection: vi.fn(),
      resetSelection: vi.fn(),
    }
  })

  describe('createHomepageRouter', () => {
    beforeEach(() => {
      app.use('/homepage', createHomepageRouter(mockService as unknown as HomepageService))
      // Error handler to prevent express from sending HTML error pages
      app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        res.status(err.statusCode || 500).json({ error: err.message, issues: err.issues })
      })
    })

    it('GET /homepage should return public homepage data', async () => {
      const mockData = { categories: [], sections: {} }
      mockService.getPublic!.mockResolvedValue(mockData as any)

      const response = await request(app).get('/homepage')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        message: 'Homepage retrieved.',
        data: mockData,
      })
      expect(mockService.getPublic).toHaveBeenCalledOnce()
    })
  })

  describe('createAdminHomepageRouter', () => {
    const mockUser = { id: 'admin-123', email: 'admin@test.com', role: 'ADMIN' }
    
    // Mock authenticate middleware
    const authenticate = (req: any, res: any, next: any) => {
      req.auth = { user: mockUser }
      next()
    }

    beforeEach(() => {
      app.use('/admin/homepage', createAdminHomepageRouter(mockService as unknown as HomepageService, authenticate))
      // Error handler
      app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        res.status(err.statusCode || 500).json({ error: err.message, issues: err.issues })
      })
    })

    describe('GET /admin/homepage', () => {
      it('should return admin configuration data', async () => {
        const mockData = { categories: [], sections: {}, configuration: [] }
        mockService.getAdminConfiguration!.mockResolvedValue(mockData as any)

        const response = await request(app).get('/admin/homepage')

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
          success: true,
          message: 'Homepage configuration retrieved.',
          data: mockData,
        })
        expect(mockService.getAdminConfiguration).toHaveBeenCalledOnce()
      })

      it('should deny access if user is not admin or super admin', async () => {
        // Change role to test requireRoles middleware
        const nonAdminApp = express()
        nonAdminApp.use(express.json())
        const nonAdminAuth = (req: any, res: any, next: any) => {
          req.auth = { user: { ...mockUser, role: 'USER' } }
          next()
        }
        nonAdminApp.use('/admin/homepage', createAdminHomepageRouter(mockService as unknown as HomepageService, nonAdminAuth))
        nonAdminApp.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
          res.status(err.statusCode || 500).json({ error: err.message, issues: err.issues })
        })

        const response = await request(nonAdminApp).get('/admin/homepage')
        
        expect(response.status).toBe(403) // Forbidden, as requireRoles should throw
      })
    })

    describe('PUT /admin/homepage/:section', () => {
      it('should update section and return updated data', async () => {
        const mockData = { key: 'FEATURED', limit: 10, manualProductIds: ['p1', 'p2'], products: [], manualCount: 2, automaticCount: 0 }
        mockService.updateSelection!.mockResolvedValue(mockData as any)

        const response = await request(app)
          .put('/admin/homepage/FEATURED')
          .send({ productIds: ['p1', 'p2'] })

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
          success: true,
          message: 'Homepage section updated.',
          data: mockData,
        })
        expect(mockService.updateSelection).toHaveBeenCalledWith('FEATURED', ['p1', 'p2'], 'admin-123')
      })

      it('should fail validation with invalid section param', async () => {
        const response = await request(app)
          .put('/admin/homepage/INVALID_SECTION')
          .send({ productIds: ['p1'] })

        expect(response.status).toBe(400) // zod validation failure on params
      })

      it('should fail validation with invalid body', async () => {
        const response = await request(app)
          .put('/admin/homepage/FEATURED')
          .send({ productIds: 'not-an-array' })

        expect(response.status).toBe(400) // zod validation failure on body
      })
    })

    describe('DELETE /admin/homepage/:section', () => {
      it('should reset section and return updated data', async () => {
        const mockData = { key: 'FEATURED', limit: 10, manualProductIds: [], products: [], manualCount: 0, automaticCount: 0 }
        mockService.resetSelection!.mockResolvedValue(mockData as any)

        const response = await request(app).delete('/admin/homepage/FEATURED')

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
          success: true,
          message: 'Homepage section reset to automatic.',
          data: mockData,
        })
        expect(mockService.resetSelection).toHaveBeenCalledWith('FEATURED', 'admin-123')
      })

      it('should fail validation with invalid section param', async () => {
        const response = await request(app).delete('/admin/homepage/INVALID_SECTION')
        expect(response.status).toBe(400)
      })
    })
  })
})
