import type {
  CreateDealerInput,
  Dealer,
  DealerListQuery,
  PaginatedResult,
  UpdateDealerInput,
} from '@campusbaza/contracts'
import { describe, expect, it } from 'vitest'
import type { DealerRepository } from '../domain/dealer.js'
import { DealerService } from './dealer.service.js'

const dealer: Dealer = {
  id: 'dealer-1',
  displayName: 'Sales One',
  phoneNumber: '+919900000001',
  isActive: true,
  maxOpenOrders: 10,
  currentOpenOrders: 0,
  completedOrders: 0,
  lastAssignedAt: null,
  workingHours: {
    timeZone: 'Asia/Kolkata',
    startTime: '00:00',
    endTime: '23:59',
    days: [0, 1, 2, 3, 4, 5, 6],
  },
  notes: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
}

class DealerRepositoryFake implements DealerRepository {
  removal: 'DELETED' | 'IN_USE' | 'NOT_FOUND' = 'DELETED'
  async list(query: DealerListQuery): Promise<PaginatedResult<Dealer>> {
    void query
    return { items: [dealer], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }
  }
  async findById() {
    return dealer
  }
  async create(input: CreateDealerInput) {
    void input
    return dealer
  }
  async update(id: string, input: UpdateDealerInput) {
    void id
    void input
    return dealer
  }
  async softDelete() {
    return this.removal
  }
}

describe('DealerService', () => {
  it('creates and lists sales dealers', async () => {
    const service = new DealerService(new DealerRepositoryFake())
    expect((await service.list({ page: 1, limit: 20 })).items).toHaveLength(1)
    expect(
      await service.create({
        displayName: dealer.displayName,
        phoneNumber: dealer.phoneNumber,
        isActive: true,
        maxOpenOrders: 10,
        workingHours: dealer.workingHours,
        notes: null,
      }),
    ).toEqual(dealer)
  })

  it('prevents deletion while a dealer owns open orders', async () => {
    const repository = new DealerRepositoryFake()
    repository.removal = 'IN_USE'
    await expect(new DealerService(repository).remove('dealer-1')).rejects.toMatchObject({
      code: 'DEALER_HAS_OPEN_ORDERS',
    })
  })
})
