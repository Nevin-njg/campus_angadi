import type { Category, CreateCategoryInput, UpdateCategoryInput } from '@campusbaza/contracts'

export interface CategoryRepository {
  listPublic(): Promise<Category[]>
  listAdmin(): Promise<Category[]>
  findById(id: string): Promise<Category | null>
  findBySlug(slug: string): Promise<Category | null>
  create(input: CreateCategoryInput & { slug: string }): Promise<Category>
  update(id: string, input: UpdateCategoryInput & { slug?: string }): Promise<Category | null>
  softDelete(id: string): Promise<boolean>
  slugExists(slug: string, excludeId?: string): Promise<boolean>
}
