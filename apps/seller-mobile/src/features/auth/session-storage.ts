import * as SecureStore from 'expo-secure-store'

import type { SellerSession } from './auth-api'

const REFRESH_TOKEN_KEY = 'campus_angadi_seller_refresh_token'
const ACCESS_TOKEN_KEY = 'campus_angadi_seller_access_token'

export const sellerSessionStorage = {
  async save(session: SellerSession) {
    await Promise.all([
      SecureStore.setItemAsync(
        ACCESS_TOKEN_KEY,
        session.accessToken,
      ),
      SecureStore.setItemAsync(
        REFRESH_TOKEN_KEY,
        session.refreshToken,
      ),
    ])
  },

  getRefreshToken() {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
  },

  getAccessToken() {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
  },

  async clear() {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ])
  },
}
