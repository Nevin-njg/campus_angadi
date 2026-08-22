import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { useSellerSession } from '../features/auth/session'
import {
  isSellerDevicesAuthError,
  sellerDevicesApi,
  type SellerLoggedInDevice,
} from '../features/devices/device-api'
import { getSellerDeviceId } from '../features/notifications/seller-device'

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
}

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime()

  if (!Number.isFinite(timestamp)) return 'Unknown'

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))

  if (seconds < 60) return 'Just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`

  return new Date(value).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function DeviceCard({
  device,
  currentDeviceId,
}: {
  device: SellerLoggedInDevice
  currentDeviceId: string | null
}) {
  const isCurrent = currentDeviceId === device.deviceId
  const isAndroid = device.platform === 'android'

  return (
    <View style={[styles.deviceCard, isCurrent && styles.currentCard]}>
      <View style={styles.deviceTop}>
        <View style={[styles.deviceIcon, isCurrent && styles.currentIcon]}>
          <Ionicons
            name={isAndroid ? 'logo-android' : 'logo-apple'}
            size={25}
            color={isCurrent ? C.accentDark : C.text}
          />
        </View>

        <View style={styles.deviceCopy}>
          <View style={styles.deviceNameRow}>
            <Text style={styles.deviceName} numberOfLines={1}>
              {device.deviceName}
            </Text>

            {isCurrent ? (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>This device</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.platform}>
            {isAndroid ? 'Android' : 'iPhone'}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaIcon}>
          <Ionicons name="time-outline" size={16} color={C.muted} />
        </View>
        <View style={styles.metaCopy}>
          <Text style={styles.metaLabel}>Last active</Text>
          <Text style={styles.metaValue}>{relativeTime(device.lastActiveAt)}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaIcon}>
          <Ionicons
            name={
              device.pushEnabled
                ? 'notifications-outline'
                : 'notifications-off-outline'
            }
            size={16}
            color={C.muted}
          />
        </View>
        <View style={styles.metaCopy}>
          <Text style={styles.metaLabel}>Order alerts</Text>
          <Text style={styles.metaValue}>
            {device.pushEnabled ? 'Enabled' : 'Disabled'}
          </Text>
        </View>
      </View>
    </View>
  )
}

export default function LoggedInDevicesScreen() {
  const router = useRouter()
  const { session, refreshSession } = useSellerSession()

  const [devices, setDevices] = useState<SellerLoggedInDevice[]>([])
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accessToken = session?.accessToken ?? null

  const withFreshToken = useCallback(
    async <T,>(operation: (token: string) => Promise<T>): Promise<T> => {
      if (!accessToken) throw new Error('Seller session is unavailable.')

      try {
        return await operation(accessToken)
      } catch (requestError) {
        if (!isSellerDevicesAuthError(requestError)) throw requestError

        const refreshed = await refreshSession(accessToken)
        if (!refreshed) throw requestError

        return operation(refreshed.accessToken)
      }
    },
    [accessToken, refreshSession],
  )

  const load = useCallback(
    async (showRefresh = false) => {
      if (!accessToken) return

      if (showRefresh) setRefreshing(true)
      else setLoading(true)

      try {
        setError(null)

        const [nextDevices, localDeviceId] = await Promise.all([
          withFreshToken((token) => sellerDevicesApi.list(token)),
          getSellerDeviceId(),
        ])

        setDevices(nextDevices)
        setCurrentDeviceId(localDeviceId)
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load logged-in devices.',
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [accessToken, withFreshToken],
  )

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const orderedDevices = useMemo(
    () =>
      [...devices].sort((left, right) => {
        const leftCurrent = left.deviceId === currentDeviceId
        const rightCurrent = right.deviceId === currentDeviceId

        if (leftCurrent !== rightCurrent) return leftCurrent ? -1 : 1

        return (
          new Date(right.lastActiveAt).getTime() -
          new Date(left.lastActiveAt).getTime()
        )
      }),
    [currentDeviceId, devices],
  )

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
          <Text style={styles.title}>Logged-in devices</Text>
          <Text style={styles.subtitle}>Seller app devices using this account</Text>
        </View>
      </View>

      {loading && devices.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.loadingText}>Loading devices…</Text>
        </View>
      ) : error && devices.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle-outline" size={28} color={C.red} />
          </View>
          <Text style={styles.errorTitle}>Unable to load devices</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            onPress={() => void load()}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={C.accent}
            />
          }
        >
          {error ? (
            <View style={styles.inlineError}>
              <Ionicons name="warning-outline" size={17} color={C.red} />
              <Text style={styles.inlineErrorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Ionicons name="phone-portrait-outline" size={24} color={C.accentDark} />
            </View>

            <View style={styles.summaryCopy}>
              <Text style={styles.summaryValue}>{orderedDevices.length}</Text>
              <Text style={styles.summaryLabel}>
                {orderedDevices.length === 1 ? 'seller device' : 'seller devices'}
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Devices</Text>
            <Text style={styles.sectionHint}>Most recently active first</Text>
          </View>

          {orderedDevices.length > 0 ? (
            <View style={styles.deviceList}>
              {orderedDevices.map((device) => (
                <DeviceCard
                  key={device.deviceId}
                  device={device}
                  currentDeviceId={currentDeviceId}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="phone-portrait-outline" size={28} color={C.subtle} />
              <Text style={styles.emptyTitle}>No devices found</Text>
              <Text style={styles.emptyText}>
                This device will appear after seller notifications register.
              </Text>
            </View>
          )}

          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color={C.muted} />
            <Text style={styles.infoText}>
              Last active is refreshed while the seller app is signed in. Individual remote logout
              is intentionally unavailable for now.
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
  errorIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 27,
    backgroundColor: '#fef2f2',
  },
  errorTitle: {
    marginTop: 15,
    color: C.text,
    fontSize: 18,
    fontWeight: '900',
  },
  errorText: {
    marginTop: 7,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: C.text,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  inlineError: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 13,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineErrorText: {
    flex: 1,
    color: C.red,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 18,
    backgroundColor: '#fffbeb',
  },
  summaryIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#fef3c7',
  },
  summaryCopy: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
  },
  summaryValue: {
    color: C.text,
    fontSize: 26,
    fontWeight: '900',
  },
  summaryLabel: {
    color: C.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    marginTop: 23,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: '900',
  },
  sectionHint: {
    color: C.subtle,
    fontSize: 10,
    fontWeight: '700',
  },
  deviceList: {
    gap: 10,
  },
  deviceCard: {
    padding: 15,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    backgroundColor: C.surface,
  },
  currentCard: {
    borderColor: '#fbbf24',
  },
  deviceTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#f4f4f5',
  },
  currentIcon: {
    backgroundColor: '#fffbeb',
  },
  deviceCopy: {
    flex: 1,
    marginLeft: 12,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceName: {
    flexShrink: 1,
    color: C.text,
    fontSize: 15,
    fontWeight: '900',
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#fef3c7',
  },
  currentBadgeText: {
    color: C.accentDark,
    fontSize: 9,
    fontWeight: '900',
  },
  platform: {
    marginTop: 3,
    color: C.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  metaRow: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    width: 28,
  },
  metaCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  metaValue: {
    color: C.text,
    fontSize: 11,
    fontWeight: '800',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 28,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    backgroundColor: C.surface,
  },
  emptyTitle: {
    marginTop: 10,
    color: C.text,
    fontSize: 15,
    fontWeight: '900',
  },
  emptyText: {
    marginTop: 5,
    color: C.muted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
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
})
