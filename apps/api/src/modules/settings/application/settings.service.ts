import type {
  PlatformSettings,
  PublicSettings,
  UpdatePlatformSettingsInput,
} from '@campusbaza/contracts'
import { AppError } from '../../../core/errors/app-error.js'
import { ProductModel } from '../../products/infrastructure/product.models.js'
import { PlatformSettingModel } from '../infrastructure/platform-setting.model.js'
interface Defaults {
  appName: string
  brandMark: string
  campusDisplayName: string
}
function map(d: Record<string, unknown>): PlatformSettings {
  return {
    appName: String(d.appName),
    brandMark: String(d.brandMark),
    campusDisplayName: String(d.campusDisplayName),
    supportEmail: (d.supportEmail as string | null) ?? null,
    supportPhone: (d.supportPhone as string | null) ?? null,
    defaultPickupLocations: (d.defaultPickupLocations as string[]) ?? [],
    listingExpirationDays: Number(d.listingExpirationDays),
    maxActiveListingsPerUser: Number(d.maxActiveListingsPerUser),
    termsUrl: (d.termsUrl as string | null) ?? null,
    privacyUrl: (d.privacyUrl as string | null) ?? null,
    allowNewListings: Boolean(d.allowNewListings),
    allowOrders: Boolean(d.allowOrders),
    maintenanceMessage: (d.maintenanceMessage as string | null) ?? null,
  }
}
export class SettingsService {
  constructor(private readonly defaults: Defaults) {}
  private async ensure() {
    let d = await PlatformSettingModel.findByIdAndUpdate(
      'platform',
      { $setOnInsert: { _id: 'platform', ...this.defaults } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean<Record<string, unknown>>()
    if (!d) throw new Error('Unable to provision platform settings')

    // Upgrade only the previous generated defaults. Existing campuses with a custom name or mark
    // keep their own branding intact.
    const legacyBrandUpdate: Record<string, string> = {}
    if (
      ['CampusBaza', 'Campus Bazaar', 'Campus Angaadi', 'Campus Annadi'].includes(
        String(d.appName),
      ) &&
      this.defaults.appName === 'Campus Angadi'
    ) {
      legacyBrandUpdate.appName = this.defaults.appName
    }
    if (d.brandMark === 'CV' && this.defaults.brandMark === 'CA') {
      legacyBrandUpdate.brandMark = this.defaults.brandMark
    }
    if (
      ['My College', 'Your College', 'Your College Name', 'Your Campus'].includes(
        String(d.campusDisplayName),
      ) &&
      this.defaults.campusDisplayName === 'NIT Calicut'
    ) {
      legacyBrandUpdate.campusDisplayName = this.defaults.campusDisplayName
    }
    if (Object.keys(legacyBrandUpdate).length) {
      const upgraded = await PlatformSettingModel.findByIdAndUpdate(
        'platform',
        { $set: legacyBrandUpdate },
        { new: true },
      ).lean<Record<string, unknown>>()
      if (!upgraded) throw new Error('Unable to upgrade platform branding')
      d = upgraded
    }
    return map(d)
  }
  getAdmin() {
    return this.ensure()
  }
  async getPublic(): Promise<PublicSettings> {
    const s = await this.ensure()
    return {
      appName: s.appName,
      brandMark: s.brandMark,
      campusDisplayName: s.campusDisplayName,
      supportEmail: s.supportEmail,
      supportPhone: s.supportPhone,
      defaultPickupLocations: s.defaultPickupLocations,
      listingExpirationDays: s.listingExpirationDays,
      maxActiveListingsPerUser: s.maxActiveListingsPerUser,
      termsUrl: s.termsUrl,
      privacyUrl: s.privacyUrl,
    }
  }
  async update(input: UpdatePlatformSettingsInput) {
    const d = await PlatformSettingModel.findByIdAndUpdate(
      'platform',
      { $set: input, $setOnInsert: { _id: 'platform', ...this.defaults } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean<Record<string, unknown>>()
    if (!d) throw new Error('Unable to update settings')
    return map(d)
  }
  async assertCanCreateListing(userId: string) {
    const s = await this.ensure()
    if (!s.allowNewListings)
      throw new AppError(
        503,
        'NEW_LISTINGS_DISABLED',
        s.maintenanceMessage ?? 'New listings are temporarily unavailable.',
      )
    const count = await ProductModel.countDocuments({
      sellerId: userId,
      sellerType: 'USER',
      deletedAt: null,
      status: { $nin: ['DELETED', 'SOLD'] },
    })
    if (count >= s.maxActiveListingsPerUser)
      throw new AppError(
        409,
        'LISTING_LIMIT_REACHED',
        `You can have up to ${s.maxActiveListingsPerUser} active listings.`,
      )
  }
  async assertOrdersAllowed() {
    const s = await this.ensure()
    if (!s.allowOrders)
      throw new AppError(
        503,
        'ORDERS_DISABLED',
        s.maintenanceMessage ?? 'Orders are temporarily unavailable.',
      )
  }
}
