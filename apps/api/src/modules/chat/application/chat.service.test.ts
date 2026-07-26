import mongoose from 'mongoose'
import type { AuthUser } from '@campusbaza/contracts'
import { describe, expect, it } from 'vitest'
import { OrderModel } from '../../orders/infrastructure/order.models.js'
import { ChatService } from './chat.service.js'

function actor(id: string, role: AuthUser['role']): AuthUser {
  return {
    id,
    email: `${role.toLowerCase()}@nitc.ac.in`,
    emailVerified: true,
    role,
    status: 'ACTIVE',
    canSell: true,
    profileCompleted: true,
    profile: {
      fullName: role === 'USER' ? 'NITC Buyer' : 'Campus Team',
      displayName: role === 'USER' ? 'Buyer' : 'Team member',
      profileImageUrl: null,
      phoneNumber: null,
      department: null,
      graduationYear: null,
      campusRole: null,
      preferredPickupLocation: null,
      bio: null,
    },
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  }
}

async function createOrder(buyerId: mongoose.Types.ObjectId) {
  return OrderModel.create({
    checkoutGroupId: 'chat-group',
    orderNumber: `ANG-${Date.now()}`,
    buyerId,
    sellerType: 'USER',
    sellerId: new mongoose.Types.ObjectId(),
    status: 'PENDING',
    subtotal: 100,
    totalAmount: 100,
    itemCount: 1,
    fullName: 'NITC Buyer',
    phoneNumber: '9999999999',
    pickupLocation: 'Main Building',
    assignedDealerId: new mongoose.Types.ObjectId(),
    assignedDealerName: 'Campus Angadi Team 1',
  })
}

describe('ChatService', () => {
  it('keeps the seller out while allowing the buyer and Campus Angadi team', async () => {
    const buyerId = new mongoose.Types.ObjectId()
    const order = await createOrder(buyerId)
    const service = new ChatService({} as never, 8_000_000)

    const sent = await service.sendText(
      String(order._id),
      actor(String(buyerId), 'USER'),
      'Is pickup available today?',
    )
    expect(sent.senderKind).toBe('BUYER')

    const seller = actor(String(order.sellerId), 'USER')
    await expect(service.list(String(order._id), seller)).rejects.toMatchObject({
      code: 'CHAT_ACCESS_DENIED',
    })

    const admin = actor(String(new mongoose.Types.ObjectId()), 'ADMIN')
    const conversation = await service.list(String(order._id), admin)
    expect(conversation.messages).toHaveLength(1)
    expect(conversation.assignedDealer?.displayName).toBe('Campus Angadi Team 1')
  })

  it('does not open buyer chat before a mediator is assigned', async () => {
    const buyerId = new mongoose.Types.ObjectId()
    const order = await createOrder(buyerId)
    await OrderModel.updateOne(
      { _id: order._id },
      { $set: { assignedDealerId: null, assignedDealerName: null } },
    )
    const service = new ChatService({} as never, 8_000_000)
    await expect(
      service.sendText(String(order._id), actor(String(buyerId), 'USER'), 'Hello'),
    ).rejects.toMatchObject({ code: 'DEALER_NOT_ASSIGNED' })
  })

  it('allows only the moderator assigned to the conversation', async () => {
    const buyerId = new mongoose.Types.ObjectId()
    const assignedModeratorId = new mongoose.Types.ObjectId()
    const order = await createOrder(buyerId)
    await OrderModel.updateOne(
      { _id: order._id },
      {
        $set: {
          assignedModeratorId,
          assignedModeratorName: 'Assigned moderator',
        },
      },
    )
    const service = new ChatService({} as never, 8_000_000)

    const conversation = await service.list(
      String(order._id),
      actor(String(assignedModeratorId), 'MODERATOR'),
    )
    expect(conversation.assignedModerator?.displayName).toBe('Assigned moderator')

    await expect(
      service.list(String(order._id), actor(String(new mongoose.Types.ObjectId()), 'MODERATOR')),
    ).rejects.toMatchObject({ code: 'CHAT_ACCESS_DENIED' })
  })

  it('stores buyer call requests and prevents team accounts from requesting calls', async () => {
    const buyerId = new mongoose.Types.ObjectId()
    const assignedModeratorId = new mongoose.Types.ObjectId()
    const order = await createOrder(buyerId)
    await OrderModel.updateOne(
      { _id: order._id },
      { $set: { assignedModeratorId, assignedModeratorName: 'Assigned mediator' } },
    )
    const service = new ChatService({} as never, 8_000_000)
    const request = await service.requestCall(String(order._id), actor(String(buyerId), 'USER'))
    expect(request.type).toBe('SYSTEM')
    expect(request.text).toContain('requested an audio call')
    const repeated = await service.requestCall(String(order._id), actor(String(buyerId), 'USER'))
    expect(repeated.id).toBe(request.id)
    await expect(
      service.requestCall(String(order._id), actor(String(assignedModeratorId), 'MODERATOR')),
    ).rejects.toMatchObject({ code: 'CALL_REQUEST_BUYER_ONLY' })
  })
})
