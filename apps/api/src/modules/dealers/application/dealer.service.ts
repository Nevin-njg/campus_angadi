import type { CreateDealerInput, DealerListQuery, UpdateDealerInput } from '@campusbaza/contracts'
import { AppError } from '../../../core/errors/app-error.js'
import type { DealerRepository } from '../domain/dealer.js'
import { UserModel } from '../../users/infrastructure/user.models.js'

export class DealerService {
  constructor(private readonly dealers: DealerRepository) {}

  list(query: DealerListQuery) {
    return this.dealers.list(query)
  }

  async get(id: string) {
    const dealer = await this.dealers.findById(id)
    if (!dealer) throw new AppError(404, 'DEALER_NOT_FOUND', 'Dealer not found.')
    return dealer
  }

  async create(input: CreateDealerInput) {
    if (await this.dealers.findByMediatorUserId(input.mediatorUserId))
      throw new AppError(
        409,
        'MEDIATOR_ALREADY_A_DEALER',
        'This mediator already has a dealer assignment profile.',
      )
    const mediator = await this.findMediator(input.mediatorUserId)
    if (!mediator)
      throw new AppError(
        400,
        'MEDIATOR_ACCOUNT_REQUIRED',
        'Choose an active login-enabled mediator before creating a dealer.',
      )
    return this.dealers.create({ ...input, mediatorEmail: String(mediator.email) })
  }

  async update(id: string, input: UpdateDealerInput) {
    const linked = input.mediatorUserId
      ? await this.dealers.findByMediatorUserId(input.mediatorUserId)
      : null
    if (linked && linked.id !== id)
      throw new AppError(
        409,
        'MEDIATOR_ALREADY_A_DEALER',
        'This mediator already has a dealer assignment profile.',
      )
    const mediator = input.mediatorUserId ? await this.findMediator(input.mediatorUserId) : null
    if (input.mediatorUserId && !mediator)
      throw new AppError(
        400,
        'MEDIATOR_ACCOUNT_REQUIRED',
        'Choose an active login-enabled mediator.',
      )
    const dealer = await this.dealers.update(id, {
      ...input,
      ...(mediator ? { mediatorEmail: String(mediator.email) } : {}),
    })
    if (!dealer) throw new AppError(404, 'DEALER_NOT_FOUND', 'Dealer not found.')
    return dealer
  }

  private findMediator(id: string) {
    return UserModel.findOne({
      _id: id,
      status: 'ACTIVE',
      $or: [
        { role: 'MODERATOR' },
        { canMediateOrders: true, role: { $in: ['ADMIN', 'SUPER_ADMIN'] } },
      ],
    }).lean<Record<string, unknown>>()
  }

  async remove(id: string) {
    const result = await this.dealers.softDelete(id)
    if (result === 'NOT_FOUND') throw new AppError(404, 'DEALER_NOT_FOUND', 'Dealer not found.')
    if (result === 'IN_USE') {
      throw new AppError(
        409,
        'DEALER_HAS_OPEN_ORDERS',
        'Reassign or finish this dealer’s open orders before removing the dealer.',
      )
    }
  }
}
