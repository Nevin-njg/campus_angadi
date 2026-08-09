import { beforeEach, describe, expect, it } from 'vitest'
import { PlatformSettingModel } from '../infrastructure/platform-setting.model.js'
import { SettingsService } from './settings.service.js'

describe('SettingsService', () => {
  const defaults = {
    appName: 'Campus Angadi',
    brandMark: 'CA',
    campusDisplayName: 'NIT Calicut',
  }

  beforeEach(async () => {
    await PlatformSettingModel.deleteMany({})
  })

  it('provisions and updates settings without conflicting MongoDB operators', async () => {
    const service = new SettingsService(defaults)

    const updated = await service.update({
      appName: 'Campus Angadi',
      brandMark: 'CA',
      campusDisplayName: 'NIT Calicut',
      listingExpirationDays: 45,
    })

    expect(updated.listingExpirationDays).toBe(45)
    expect(await PlatformSettingModel.countDocuments()).toBe(1)
  })

  it('preserves existing fields that are omitted from a partial update', async () => {
    const service = new SettingsService(defaults)
    await service.update({ supportEmail: 'support@example.com' })

    const updated = await service.update({ supportPhone: '+919876543210' })

    expect(updated.supportEmail).toBe('support@example.com')
    expect(updated.supportPhone).toBe('+919876543210')
  })
})
