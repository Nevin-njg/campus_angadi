import type {
  CreateDealerInput,
  Dealer,
  DealerListQuery,
  PaginatedResult,
  UpdateDealerInput,
} from '@campusbaza/contracts'

export interface DealerRepository {
  list(query: DealerListQuery): Promise<PaginatedResult<Dealer>>
  findById(id: string): Promise<Dealer | null>
  findByMediatorUserId(userId: string): Promise<Dealer | null>
  create(input: CreateDealerInput & { mediatorEmail: string }): Promise<Dealer>
  update(id: string, input: UpdateDealerInput & { mediatorEmail?: string }): Promise<Dealer | null>
  softDelete(id: string): Promise<'DELETED' | 'IN_USE' | 'NOT_FOUND'>
}
