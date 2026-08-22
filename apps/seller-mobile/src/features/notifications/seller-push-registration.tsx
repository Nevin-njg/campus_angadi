import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { useCallback, useEffect } from 'react'
import { Platform } from 'react-native'

import { useSellerSession } from '../auth/session'
import {
  isSellerPushAuthError,
  sellerPushApi,
} from './seller-push-api'
import {
  getSellerDeviceId,
  getSellerDeviceName,
} from './seller-device'

const REGISTER_REFRESH_MS = 5 * 60 * 1000

export function SellerPushRegistration() {
  const { session, refreshSession } = useSellerSession()

  const register = useCallback(async () => {
    const accessToken = session?.accessToken
    if (!accessToken) return

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('seller-orders', {
          name: 'Seller order alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 200, 500],
          sound: 'default',
          enableVibrate: true,
          lockscreenVisibility:
            Notifications.AndroidNotificationVisibility.PUBLIC,
        })
      }

      const currentPermission = await Notifications.getPermissionsAsync()
      let permission = currentPermission.status

      if (permission !== 'granted') {
        permission = (await Notifications.requestPermissionsAsync()).status
      }

      if (permission !== 'granted') {
        console.warn('Seller push permission is not granted.')
        return
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId

      if (!projectId) {
        console.warn('Seller push project ID is missing.')
        return
      }

      const expoPushToken = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data

      const deviceId = await getSellerDeviceId()
      const deviceName = getSellerDeviceName()
      const platform: 'android' | 'ios' =
        Platform.OS === 'ios' ? 'ios' : 'android'

      const input = {
        deviceId,
        expoPushToken,
        deviceName,
        platform,
      }

      try {
        await sellerPushApi.register(accessToken, input)
      } catch (error) {
        if (!isSellerPushAuthError(error)) throw error

        const refreshed = await refreshSession(accessToken)
        if (!refreshed) throw error

        await sellerPushApi.register(refreshed.accessToken, input)
      }

      if (__DEV__) {
        console.log('SELLER_PUSH_REGISTERED', {
          deviceId,
          deviceName,
          platform,
        })
      }
    } catch (error) {
      console.warn('Seller push registration failed', error)
    }
  }, [refreshSession, session?.accessToken])

  useEffect(() => {
    void register()

    const timer = setInterval(() => {
      void register()
    }, REGISTER_REFRESH_MS)

    return () => clearInterval(timer)
  }, [register])

  return null
}
