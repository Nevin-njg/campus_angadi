import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { useSellerSession } from '../features/auth/session'
import { getSellerDeviceId } from '../features/notifications/seller-device'
import {
  isSellerPushAuthError,
  sellerPushApi,
} from '../features/notifications/seller-push-api'
import {
  isSellerSettingsAuthError,
  sellerSettingsApi,
} from '../features/settings/settings-api'
import {
  isSellerStoreAuthError,
  sellerStoreApi,
  type SellerStoreDashboard,
} from '../features/store/store-api'

const C = {
  text: '#18181b',
  muted: '#71717a',
  subtle: '#a1a1aa',
  border: '#e4e4e7',
  bg: '#fafafa',
  surface: '#ffffff',
  accent: '#f59e0b',
  accentDark: '#92400e',
  green: '#15803d',
  greenBg: '#f0fdf4',
  red: '#b91c1c',
  redBg: '#fef2f2',
}

function SettingRow({
  icon,
  title,
  value,
  danger = false,
  disabled = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  value?: string
  danger?: boolean
  disabled?: boolean
  onPress?: () => void
}) {
  const interactive = Boolean(onPress) && !disabled

  return (
    <Pressable
      disabled={!interactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        pressed && interactive && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Ionicons name={icon} size={19} color={danger ? C.red : C.muted} />
      </View>

      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, danger && styles.dangerText]}>{title}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      </View>

      {interactive ? (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={danger ? C.red : C.subtle}
        />
      ) : null}
    </Pressable>
  )
}

export default function SettingsScreen() {
  const router = useRouter()
  const { session, refreshSession, logout } = useSellerSession()

  const [dashboard, setDashboard] = useState<SellerStoreDashboard | null>(null)
  const [notificationStatus, setNotificationStatus] = useState('Checking…')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accessToken = session?.accessToken ?? null
  const email = session?.user.email ?? 'Seller account'
  const version =
    Constants.expoConfig?.version ??
    Constants.nativeAppVersion ??
    'Development'

  const withFreshToken = useCallback(
    async <T,>(
      operation: (token: string) => Promise<T>,
      isAuthError: (error: unknown) => boolean,
    ): Promise<T> => {
      if (!accessToken) throw new Error('Seller session is unavailable.')

      try {
        return await operation(accessToken)
      } catch (requestError) {
        if (!isAuthError(requestError)) throw requestError

        const refreshed = await refreshSession(accessToken)
        if (!refreshed) throw requestError

        return operation(refreshed.accessToken)
      }
    },
    [accessToken, refreshSession],
  )

  const load = useCallback(async () => {
    if (!accessToken) return

    setLoading(true)

    try {
      setError(null)

      const [nextDashboard, permission] = await Promise.all([
        withFreshToken(
          (token) => sellerStoreApi.dashboard(token),
          isSellerStoreAuthError,
        ),
        Notifications.getPermissionsAsync(),
      ])

      setDashboard(nextDashboard)
      setNotificationStatus(
        permission.status === 'granted'
          ? 'Enabled'
          : permission.canAskAgain
            ? 'Permission not granted'
            : 'Disabled in phone settings',
      )
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load settings.',
      )
    } finally {
      setLoading(false)
    }
  }, [accessToken, withFreshToken])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const logoutThisDevice = useCallback(() => {
    Alert.alert(
      'Log out this device?',
      'This phone will stop receiving seller order alerts until you sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (!accessToken || working) return

              setWorking(true)

              try {
                const deviceId = await getSellerDeviceId()

                try {
                  await withFreshToken(
                    (token) => sellerPushApi.unregister(token, deviceId),
                    isSellerPushAuthError,
                  )
                } catch {
                  // Logging out should still succeed if push cleanup is unavailable.
                }

                await logout()
              } catch (requestError) {
                setError(
                  requestError instanceof Error
                    ? requestError.message
                    : 'Unable to log out.',
                )
              } finally {
                setWorking(false)
              }
            })()
          },
        },
      ],
    )
  }, [accessToken, logout, withFreshToken, working])

  const logoutAllDevices = useCallback(() => {
    Alert.alert(
      'Log out all devices?',
      'Every seller phone using this account will need to sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out all',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (!accessToken || working) return

              setWorking(true)

              try {
                await withFreshToken(
                  (token) => sellerSettingsApi.unregisterAllDevices(token),
                  isSellerSettingsAuthError,
                )

                await withFreshToken(
                  (token) => sellerSettingsApi.logoutAll(token),
                  isSellerSettingsAuthError,
                )

                try {
                  await logout()
                } catch {
                  // logout-all already revoked the current session; logout()
                  // still clears local credentials in its finally block.
                }
              } catch (requestError) {
                setError(
                  requestError instanceof Error
                    ? requestError.message
                    : 'Unable to log out all devices.',
                )
              } finally {
                setWorking(false)
              }
            })()
          },
        },
      ],
    )
  }, [accessToken, logout, withFreshToken, working])

  const permanentlyCloseStore = useCallback(() => {
    const storeName = dashboard?.store.name ?? 'this store'

    Alert.alert(
      'Permanently close store?',
      `${storeName} will be archived and customers will no longer be able to order from it. This action cannot be reversed from the seller app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final confirmation',
              'Are you sure you want to permanently close this store?',
              [
                { text: 'Keep store', style: 'cancel' },
                {
                  text: 'Permanently close',
                  style: 'destructive',
                  onPress: () => {
                    void (async () => {
                      if (!accessToken || working) return

                      setWorking(true)

                      try {
                        await withFreshToken(
                          (token) => sellerSettingsApi.permanentlyCloseStore(token),
                          isSellerSettingsAuthError,
                        )
                        await load()
                      } catch (requestError) {
                        setError(
                          requestError instanceof Error
                            ? requestError.message
                            : 'Unable to permanently close the store.',
                        )
                      } finally {
                        setWorking(false)
                      }
                    })()
                  },
                },
              ],
            )
          },
        },
      ],
    )
  }, [accessToken, dashboard?.store.name, load, withFreshToken, working])

  const store = dashboard?.store
  const permanentlyClosed = store?.status === 'ARCHIVED'

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>

        <View style={styles.headerCopy}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Store, account and app settings</Text>
        </View>
      </View>

      {loading && !dashboard ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.loadingText}>Loading settings…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="warning-outline" size={17} color={C.red} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {working ? (
            <View style={styles.workingBanner}>
              <ActivityIndicator size="small" color={C.accentDark} />
              <Text style={styles.workingText}>Updating…</Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Store</Text>
          <View style={styles.card}>
            <SettingRow
              icon="storefront-outline"
              title={store?.name ?? 'Store'}
              value={
                permanentlyClosed
                  ? 'Permanently closed'
                  : store?.campusLocation || 'Official Campus Angadi store'
              }
            />
            <SettingRow
              icon="pulse-outline"
              title="Store status"
              value={store?.status ?? 'Unknown'}
            />
          </View>

          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.card}>
            <SettingRow
              icon="notifications-outline"
              title="Order notifications"
              value={notificationStatus}
              onPress={() => router.push('/notification-health' as never)}
            />
            <SettingRow
              icon="shield-checkmark-outline"
              title="Notification health"
              value="Permissions, registration and battery guidance"
              onPress={() => router.push('/notification-health' as never)}
            />
            <SettingRow
              icon="construct-outline"
              title="Notification troubleshooting"
              value="Open phone app settings"
              onPress={() => void Linking.openSettings()}
            />
          </View>

          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <SettingRow
              icon="mail-outline"
              title="Seller email"
              value={email}
            />
            <SettingRow
              icon="log-out-outline"
              title="Log out this device"
              onPress={logoutThisDevice}
            />
            <SettingRow
              icon="phone-portrait-outline"
              title="Log out all devices"
              value="Signs out every seller phone"
              danger
              onPress={logoutAllDevices}
            />
          </View>

          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <SettingRow
              icon="information-circle-outline"
              title="Campus Angadi Seller"
              value={`Version ${version}`}
            />
          </View>

          <Text style={[styles.sectionTitle, styles.dangerSectionTitle]}>
            Danger zone
          </Text>
          <View style={[styles.card, styles.dangerCard]}>
            <SettingRow
              icon="trash-outline"
              title={
                permanentlyClosed
                  ? 'Store permanently closed'
                  : 'Permanently close store'
              }
              value={
                permanentlyClosed
                  ? 'This store has been archived'
                  : 'Archives the store and blocks all future orders'
              }
              danger
              disabled={permanentlyClosed || working}
              onPress={permanentlyCloseStore}
            />
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark-outline" size={20} color={C.muted} />
            <Text style={styles.infoText}>
              Sensitive actions use confirmation screens. Owner PIN protection can be added later
              without changing this Settings layout.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 13,
    backgroundColor: C.surface,
  },
  headerCopy: {
    flex: 1,
    marginLeft: 13,
  },
  title: {
    color: C.text,
    fontSize: 23,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 2,
    color: C.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  loadingText: {
    marginTop: 12,
    color: C.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  errorBanner: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 13,
    backgroundColor: C.redBg,
    padding: 12,
  },
  errorText: {
    flex: 1,
    color: C.red,
    fontSize: 12,
    fontWeight: '700',
  },
  workingBanner: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 13,
    backgroundColor: '#fffbeb',
    padding: 12,
  },
  workingText: {
    color: C.accentDark,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 9,
    color: C.text,
    fontSize: 15,
    fontWeight: '900',
  },
  dangerSectionTitle: {
    color: C.red,
  },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 17,
    backgroundColor: C.surface,
  },
  dangerCard: {
    borderColor: '#fecaca',
  },
  settingRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  rowIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#f4f4f5',
  },
  rowIconDanger: {
    backgroundColor: C.redBg,
  },
  rowCopy: {
    flex: 1,
    marginHorizontal: 12,
  },
  rowTitle: {
    color: C.text,
    fontSize: 13,
    fontWeight: '800',
  },
  rowValue: {
    marginTop: 3,
    color: C.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  dangerText: {
    color: C.red,
  },
  infoCard: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 15,
    backgroundColor: '#f4f4f5',
  },
  infoText: {
    flex: 1,
    color: C.muted,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.65,
  },
  disabled: {
    opacity: 0.5,
  },
})
