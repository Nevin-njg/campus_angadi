import type { CreateCategoryInput, UpdateCategoryInput } from '@campusbaza/contracts'
import { AppError } from '../../../core/errors/app-error.js'
import { slugify } from '../../../core/utils/slug.js'
import type { CategoryRepository } from '../domain/category.js'

export class CategoryService {
  constructor(private readonly categories: CategoryRepository) {}

  listPublic() {
    return this.categories.listPublic()
  }

  listAdmin() {
    return this.categories.listAdmin()
  }

  async create(input: CreateCategoryInput) {
    const slug = await this.uniqueSlug(input.name)
    return this.categories.create({ ...input, slug })
  }

  async update(id: string, input: UpdateCategoryInput) {
    const current = await this.categories.findById(id)
    if (!current) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found.')
    const slug = input.name ? await this.uniqueSlug(input.name, id) : undefined
    const updated = await this.categories.update(id, { ...input, ...(slug ? { slug } : {}) })
    if (!updated) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found.')
    return updated
  }

  async remove(id: string) {
    if (!(await this.categories.softDelete(id))) {
      throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found.')
    }
  }

  private async uniqueSlug(name: string, excludeId?: string) {
    const base = slugify(name) || 'category'
    let slug = base
    let suffix = 2
    while (await this.categories.slugExists(slug, excludeId)) {
      slug = `${base}-${suffix++}`
    }
    return slug
  }
}
