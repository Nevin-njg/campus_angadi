import express, { type RequestHandler } from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import type { UserRole } from '@campusbaza/contracts'
import { errorHandler } from '../../../core/middleware/error-handler.js'
import type { StoreService } from '../application/store.service.js'
import { createAdminStoreRouter } from './store.routes.js'

function testApp(role: UserRole) {
  const remove = vi.fn(async (id: string) => ({ id }))
  const service = { remove } as unknown as StoreService
  const authenticate: RequestHandler = (req, _res, next) => {
    req.auth = { user: { id: 'actor-id', role } as NonNullable<typeof req.auth>['user'] }
    next()
  }
  const app = express()
  app.use(express.json())
  app.use('/admin/stores', createAdminStoreRouter(service, authenticate))
  app.use(errorHandler)
  return { app, remove }
}

describe('admin store deletion authorization', () => {
  it.each<UserRole>(['ADMIN', 'SUPER_ADMIN'])('allows %s to delete a store', async (role) => {
    const { app, remove } = testApp(role)

    const response = await request(app).delete('/admin/stores/store-1')

    expect(response.status).toBe(200)
    expect(response.body.data).toEqual({ id: 'store-1' })
    expect(remove).toHaveBeenCalledWith('store-1', 'actor-id')
  })

  it.each<UserRole>(['USER', 'SELLER', 'MODERATOR'])(
    'rejects store deletion by %s',
    async (role) => {
      const { app, remove } = testApp(role)

      const response = await request(app).delete('/admin/stores/store-1')

      expect(response.status).toBe(403)
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSION')
      expect(remove).not.toHaveBeenCalled()
    },
  )
})
