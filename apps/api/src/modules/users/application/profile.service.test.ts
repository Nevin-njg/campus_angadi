import { describe, expect, it } from 'vitest'
import { InMemoryUserRepository } from '../../../test/fakes.js'
import { ProfileService } from './profile.service.js'

describe('ProfileService', () => {
  it('marks the profile complete after required profile fields are supplied', async () => {
    const users = new InMemoryUserRepository()
    const value = await users.findOrCreateByEmail('student@campusbaza.example.edu', 'USER')
    const profile = new ProfileService(users)
    const updated = await profile.updateProfile(value.user.id, {
      fullName: 'Campus Student',
      displayName: 'Campus Student',
      department: 'Computer Science',
    })
    expect(updated.profileCompleted).toBe(true)
    expect(updated.profile.department).toBe('Computer Science')
  })
})
