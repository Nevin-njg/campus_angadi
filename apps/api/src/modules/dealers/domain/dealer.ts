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
  create(input: CreateDealerInput): Promise<Dealer>
  update(id: string, input: UpdateDealerInput): Promise<Dealer | null>
  softDelete(id: string): Promise<'DELETED' | 'IN_USE' | 'NOT_FOUND'>
}
