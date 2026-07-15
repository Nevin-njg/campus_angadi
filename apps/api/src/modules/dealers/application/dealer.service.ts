import type { CreateDealerInput, DealerListQuery, UpdateDealerInput } from '@campusbaza/contracts'
import { AppError } from '../../../core/errors/app-error.js'
import type { DealerRepository } from '../domain/dealer.js'

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

  create(input: CreateDealerInput) {
    return this.dealers.create(input)
  }

  async update(id: string, input: UpdateDealerInput) {
    const dealer = await this.dealers.update(id, input)
    if (!dealer) throw new AppError(404, 'DEALER_NOT_FOUND', 'Dealer not found.')
    return dealer
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
