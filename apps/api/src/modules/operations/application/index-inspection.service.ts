import mongoose from 'mongoose'
import type { IndexDrift } from '@campusbaza/contracts'

function describeIndex(index: unknown): string {
  if (typeof index === 'string') return index
  return JSON.stringify(index)
}

export class IndexInspectionService {
  async inspect(): Promise<IndexDrift[]> {
    const results: IndexDrift[] = []
    for (const modelName of mongoose.modelNames().sort()) {
      const difference = await mongoose.model(modelName).diffIndexes()
      const toCreate = difference.toCreate.map(describeIndex)
      const toDrop = difference.toDrop.map(String)
      if (toCreate.length || toDrop.length) results.push({ model: modelName, toCreate, toDrop })
    }
    return results
  }
}
