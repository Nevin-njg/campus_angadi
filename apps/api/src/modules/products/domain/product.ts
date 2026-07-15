import type {
  AdminProductListQuery,
  CreateOfficialProductInput,
  HomepageSectionKey,
  PaginatedResult,
  ProductDetail,
  ProductListQuery,
  ProductSummary,
  UpdateOfficialProductInput,
} from '@campusbaza/contracts'

export interface ProductRepository {
  listPublic(query: ProductListQuery): Promise<PaginatedResult<ProductSummary>>
  listAdmin(query: AdminProductListQuery): Promise<PaginatedResult<ProductSummary>>
  findPublicBySlug(slug: string): Promise<ProductDetail | null>
  findAdminById(id: string): Promise<ProductDetail | null>
  findEligibleByIds(ids: string[]): Promise<ProductSummary[]>
  listAutomaticCandidates(
    section: HomepageSectionKey,
    limit: number,
    excludeIds: string[],
  ): Promise<ProductSummary[]>
  createOfficial(
    input: CreateOfficialProductInput,
    adminId: string,
    slug: string,
  ): Promise<ProductDetail>
  updateOfficial(
    id: string,
    input: UpdateOfficialProductInput & { slug?: string },
  ): Promise<ProductDetail | null>
  slugExists(slug: string, excludeId?: string): Promise<boolean>
  incrementView(id: string): Promise<void>
}
