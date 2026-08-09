import { describe, expect, it } from 'vitest'
import {
  FakeEmailSender,
  FakeGoogleIdentityVerifier,
  InMemoryUserRepository,
} from '../../../test/fakes.js'
import { AccessRequestService } from './access-request.service.js'

const credential = 'credential-token'

function subject(email = 'student@gmail.com') {
  const google = new FakeGoogleIdentityVerifier()
  google.set(credential, {
    subject: `google-${email}`,
    email,
    emailVerified: true,
    name: 'External Student',
    picture: null,
    hostedDomain: null,
  })
  const users = new InMemoryUserRepository()
  const sender = new FakeEmailSender()
  return {
    users,
    sender,
    service: new AccessRequestService(google, users, sender, ['nitc.ac.in'], 'Campus Angadi'),
  }
}

describe('AccessRequestService', () => {
  it('creates, approves, and emails an external-domain access request', async () => {
    const { service, users, sender } = subject()
    const request = await service.request({
      credential,
      fullName: 'External Student',
      affiliation: 'NITC alumnus',
      reason: 'I need to purchase items from stores on campus.',
    })

    expect(request.status).toBe('PENDING')
    const approved = await service.review(request.id, '507f1f77bcf86cd799439011', {
      decision: 'APPROVED',
      note: null,
    })

    expect(approved.status).toBe('APPROVED')
    expect(await users.findByEmail('student@gmail.com')).not.toBeNull()
    expect(sender.accessApprovals).toEqual(['student@gmail.com'])
  })

  it('does not accept an access request from an allowed campus domain', async () => {
    const { service } = subject('student@nitc.ac.in')
    await expect(
      service.request({
        credential,
        fullName: 'Campus Student',
        affiliation: 'Student',
        reason: 'This account already qualifies for direct sign-in.',
      }),
    ).rejects.toMatchObject({ code: 'ACCESS_REQUEST_NOT_REQUIRED' })
  })
})
