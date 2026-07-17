import { describe, expect, it, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import mongoose from 'mongoose'
import { createProfileRouter } from './profile.routes.js'
import { ProfileService } from '../application/profile.service.js'
import { MongooseUserRepository } from '../infrastructure/mongoose-user.repository.js'
import { UserModel, UserProfileModel } from '../infrastructure/user.models.js'
import { errorHandler } from '../../../core/middleware/error-handler.js'

describe('Profile Routes', () => {
  let app: express.Application
  let users: MongooseUserRepository
  let profileService: ProfileService
  let testUserId: string

  beforeEach(async () => {
    users = new MongooseUserRepository()
    profileService = new ProfileService(users)

    // Create a test user
    const user = await UserModel.create({
      email: 'test@campus.edu',
      role: 'USER',
      status: 'ACTIVE',
    })
    testUserId = user._id.toString()

    await UserProfileModel.create({
      userId: user._id,
      fullName: 'Test User',
    })

    app = express()
    app.use(express.json())
    app.use((req, res, next) => {
      const authHeader = req.headers['authorization']
      if (authHeader === 'Bearer valid-token') {
        req.auth = {
          user: {
            id: testUserId,
            role: 'USER',
            name: 'Test User',
            email: 'test@campus.edu',
            isEmailVerified: true,
          },
        }
        next()
      } else if (authHeader === 'Bearer invalid-token') {
        req.auth = {
          user: {
            id: new mongoose.Types.ObjectId().toString(),
            role: 'USER',
            name: 'Other',
            email: 'other@campus.edu',
            isEmailVerified: true,
          },
        }
        next()
      } else {
        res.status(401).json({ error: { code: 'AUTHENTICATION_REQUIRED' } })
      }
    })

    app.use(
      '/profile',
      createProfileRouter(profileService, (req, res, next) => next()),
    )
    app.use(errorHandler)
  })

  it('GET /profile returns the user profile', async () => {
    const response = await request(app).get('/profile').set('Authorization', 'Bearer valid-token')

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.user.email).toBe('test@campus.edu')
    expect(response.body.data.user.profile.fullName).toBe('Test User')
  })

  it('GET /profile fails without authentication', async () => {
    const response = await request(app).get('/profile')
    expect(response.status).toBe(401)
  })

  it('GET /profile fails for non-existent user', async () => {
    const response = await request(app).get('/profile').set('Authorization', 'Bearer invalid-token')

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('USER_NOT_FOUND')
  })

  it('PATCH /profile updates the user profile', async () => {
    const response = await request(app)
      .patch('/profile')
      .set('Authorization', 'Bearer valid-token')
      .send({ fullName: 'Updated Name', department: 'Computer Science' })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.data.user.profile.fullName).toBe('Updated Name')
    expect(response.body.data.user.profile.department).toBe('Computer Science')

    // Verify it updated in DB
    const profile = await UserProfileModel.findOne({ userId: testUserId })
    expect(profile?.fullName).toBe('Updated Name')
  })

  it('PATCH /profile fails with invalid input', async () => {
    const response = await request(app)
      .patch('/profile')
      .set('Authorization', 'Bearer valid-token')
      .send({ graduationYear: 1900 }) // likely fails validation

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })
})
