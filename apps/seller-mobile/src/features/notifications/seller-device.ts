import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const DEVICE_ID_KEY = 'campus_angadi_seller_device_id'

function randomPart() {
  return Math.random().toString(36).slice(2, 12)
}

export async function getSellerDeviceId() {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY)
  if (existing) return existing

  const created = `seller-${Date.now().toString(36)}-${randomPart()}-${randomPart()}`
  await SecureStore.setItemAsync(DEVICE_ID_KEY, created)
  return created
}

export function getSellerDeviceName() {
  if (Platform.OS === 'android') {
    const constants = Platform.constants as unknown as {
      Model?: string
      Manufacturer?: string
    }

    const model = constants.Model?.trim()
    const manufacturer = constants.Manufacturer?.trim()

    if (manufacturer && model) {
      const normalizedManufacturer = manufacturer.toLowerCase()
      const normalizedModel = model.toLowerCase()

      if (normalizedModel.startsWith(normalizedManufacturer)) {
        return model.slice(0, 120)
      }

      return `${manufacturer} ${model}`.slice(0, 120)
    }

    if (model) return model.slice(0, 120)
    return 'Android seller device'
  }

  return 'iPhone seller device'
}
