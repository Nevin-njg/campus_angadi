import type { Category, CreateCategoryInput, UpdateCategoryInput } from '@campusbaza/contracts'
import type { CategoryRepository } from '../domain/category.js'
import { CategoryModel } from './category.model.js'

function mapCategory(document: Record<string, unknown>): Category {
  return {
    id: String(document._id),
    name: String(document.name),
    slug: String(document.slug),
    description: (document.description as string | null) ?? null,
    imageUrl: (document.imageUrl as string | null) ?? null,
    isActive: Boolean(document.isActive),
    displayOrder: Number(document.displayOrder),
    createdAt: (document.createdAt as Date).toISOString(),
    updatedAt: (document.updatedAt as Date).toISOString(),
  }
}

export class MongooseCategoryRepository implements CategoryRepository {
  async listPublic(): Promise<Category[]> {
    const docs = await CategoryModel.find({ deletedAt: null, isActive: true })
      .sort({ displayOrder: 1, name: 1 })
      .lean<Record<string, unknown>[]>()
    return docs.map(mapCategory)
  }

  async listAdmin(): Promise<Category[]> {
    const docs = await CategoryModel.find({ deletedAt: null })
      .sort({ displayOrder: 1, name: 1 })
      .lean<Record<string, unknown>[]>()
    return docs.map(mapCategory)
  }

  async findById(id: string): Promise<Category | null> {
    const doc = await CategoryModel.findOne({ _id: id, deletedAt: null }).lean<
      Record<string, unknown>
    >()
    return doc ? mapCategory(doc) : null
  }

  async findBySlug(slug: string): Promise<Category | null> {
    const doc = await CategoryModel.findOne({ slug, deletedAt: null }).lean<
      Record<string, unknown>
    >()
    return doc ? mapCategory(doc) : null
  }

  async create(input: CreateCategoryInput & { slug: string }): Promise<Category> {
    const doc = await CategoryModel.create({
      ...input,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
    })
    return mapCategory(doc.toObject())
  }

  async update(
    id: string,
    input: UpdateCategoryInput & { slug?: string },
  ): Promise<Category | null> {
    const doc = await CategoryModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: input },
      { new: true, runValidators: true },
    ).lean<Record<string, unknown>>()
    return doc ? mapCategory(doc) : null
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await CategoryModel.updateOne(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date(), isActive: false } },
    )
    return result.modifiedCount === 1
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    return Boolean(
      await CategoryModel.exists({
        slug,
        deletedAt: null,
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      }),
    )
  }
}
