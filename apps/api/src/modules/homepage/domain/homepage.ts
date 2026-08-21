import type { HomepageSectionKey } from '@campusbaza/contracts'

export interface HomepageSelectionRecord {
  key: HomepageSectionKey
  productIds: string[]
  updatedAt: Date
  updatedBy: string | null
}

export interface HomepageRepository {
  list(): Promise<HomepageSelectionRecord[]>
  find(key: HomepageSectionKey): Promise<HomepageSelectionRecord | null>
  save(
    key: HomepageSectionKey,
    productIds: string[],
    adminId: string,
  ): Promise<HomepageSelectionRecord>
  reset(key: HomepageSectionKey, adminId: string): Promise<void>
}

export interface DynamicHomepageSectionRecord {
  id: string
  type: import('@campusbaza/contracts').DynamicHomepageSectionType
  title: string
  enabled: boolean
  displayOrder: number
  limit: number
  departmentId: string | null
  productIds: string[]
  storeIds: string[]
  createdAt: Date
  updatedAt: Date
  updatedBy: string | null
}

export interface CreateDynamicHomepageSectionRecord {
  type: import('@campusbaza/contracts').DynamicHomepageSectionType
  title: string
  enabled: boolean
  displayOrder: number
  limit: number
  departmentId: string | null
  productIds: string[]
  storeIds: string[]
  updatedBy: string
}

export interface UpdateDynamicHomepageSectionRecord {
  title?: string
  enabled?: boolean
  displayOrder?: number
  limit?: number
  departmentId?: string | null
  productIds?: string[]
  storeIds?: string[]
  updatedBy?: string
}

export interface DynamicHomepageRepository {
  list(): Promise<DynamicHomepageSectionRecord[]>

  findById(id: string): Promise<DynamicHomepageSectionRecord | null>

  create(
    input: CreateDynamicHomepageSectionRecord,
  ): Promise<DynamicHomepageSectionRecord>

  update(
    id: string,
    input: UpdateDynamicHomepageSectionRecord,
  ): Promise<DynamicHomepageSectionRecord | null>

  remove(id: string): Promise<boolean>
}
