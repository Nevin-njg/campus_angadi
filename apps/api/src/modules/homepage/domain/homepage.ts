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
