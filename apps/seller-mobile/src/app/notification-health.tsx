import { Ionicons } from '@expo/vector-icons'
import * as Notifications from 'expo-notifications'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Platform,
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

const ORDER_CHANNEL_ID = 'seller-orders-v2'

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
  amber: '#a16207',
  amberBg: '#fffbeb',
}

type CheckState = 'GOOD' | 'BAD' | 'REVIEW'

type HealthCheck = {
  key: string
  icon: keyof typeof Ionicons.glyphMap
  title: string
  detail: string
  state: CheckState
}

type Snapshot = {
  permissionGranted: boolean
  channelEnabled: boolean
  deviceRegistered: boolean
  pushEnabled: boolean
  device: SellerLoggedInDevice | null
}

function stateMeta(state: CheckState) {
  if (state === 'GOOD') return { color: C.green, bg: C.greenBg, icon: 'checkmark-circle' as const }
  if (state === 'BAD') return { color: C.red, bg: C.redBg, icon: 'alert-circle' as const }
  return { color: C.amber, bg: C.amberBg, icon: 'information-circle' as const }
}

function ago(value?: string | null) {
  if (!value) return 'Unknown'
  const t = new Date(value).getTime()
  if (!Number.isFinite(t)) return 'Unknown'
  const seconds = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

function CheckRow({ check }: { check: HealthCheck }) {
  const meta = stateMeta(check.state)
  return (
    <View style={styles.checkRow}>
      <View style={[styles.checkIcon, { backgroundColor: meta.bg }]}>
        <Ionicons name={check.icon} size={19} color={meta.color} />
      </View>
      <View style={styles.checkCopy}>
        <Text style={styles.checkTitle}>{check.title}</Text>
        <Text style={styles.checkDetail}>{check.detail}</Text>
      </View>
      <Ionicons name={meta.icon} size={21} color={meta.color} />
    </View>
  )
}

export default function NotificationHealthScreen() {
  const router = useRouter()
  const { session, refreshSession } = useSellerSession()
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const accessToken = session?.accessToken ?? null

  const withFreshToken = useCallback(async <T,>(operation: (token: string) => Promise<T>) => {
    if (!accessToken) throw new Error('Seller session is unavailable.')
    try {
      return await operation(accessToken)
    } catch (requestError) {
      if (!isSellerDevicesAuthError(requestError)) throw requestError
      const refreshed = await refreshSession(accessToken)
      if (!refreshed) throw requestError
      return operation(refreshed.accessToken)
    }
  }, [accessToken, refreshSession])

  const load = useCallback(async (refresh = false) => {
    if (!accessToken) return
    refresh ? setRefreshing(true) : setLoading(true)
    try {
      setError(null)
      const [permission, deviceId, devices, channel] = await Promise.all([
        Notifications.getPermissionsAsync(),
        getSellerDeviceId(),
        withFreshToken((token) => sellerDevicesApi.list(token)),
        Platform.OS === 'android'
          ? Notifications.getNotificationChannelAsync(ORDER_CHANNEL_ID)
          : Promise.resolve(null),
      ])
      const device = devices.find((item) => item.deviceId === deviceId) ?? null
      setSnapshot({
        permissionGranted: permission.status === 'granted',
        channelEnabled:
          Platform.OS !== 'android' ||
          Boolean(channel && channel.importance !== Notifications.AndroidImportance.NONE),
        deviceRegistered: Boolean(device),
        pushEnabled: Boolean(device?.pushEnabled),
        device,
      })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to check notification health.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [accessToken, withFreshToken])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  const checks = useMemo<HealthCheck[]>(() => {
    if (!snapshot) return []
    const result: HealthCheck[] = [
      {
        key: 'permission',
        icon: 'notifications-outline',
        title: 'Notification permission',
        detail: snapshot.permissionGranted ? 'Allowed by the phone' : 'Notifications are blocked for this app',
        state: snapshot.permissionGranted ? 'GOOD' : 'BAD',
      },
      {
        key: 'registration',
        icon: 'cloud-done-outline',
        title: 'Seller device registration',
        detail: snapshot.deviceRegistered ? 'This phone is registered with Campus Angadi' : 'This phone is not registered for seller push alerts',
        state: snapshot.deviceRegistered ? 'GOOD' : 'BAD',
      },
      {
        key: 'alerts',
        icon: 'megaphone-outline',
        title: 'Order alerts',
        detail: snapshot.pushEnabled ? 'Server-side order alerts are enabled' : 'Server-side order alerts are not enabled',
        state: snapshot.pushEnabled ? 'GOOD' : 'BAD',
      },
    ]
    if (Platform.OS === 'android') {
      result.push(
        {
          key: 'channel',
          icon: 'volume-high-outline',
          title: 'Order notification channel',
          detail: snapshot.channelEnabled ? 'Order alert channel is enabled' : 'Order alert channel is disabled in Android settings',
          state: snapshot.channelEnabled ? 'GOOD' : 'BAD',
        },
        {
          key: 'battery',
          icon: 'battery-charging-outline',
          title: 'Battery optimization',
          detail: 'Set Campus Angadi Seller battery usage to Unrestricted / Don’t optimize for dependable closed-app alerts.',
          state: 'REVIEW',
        },
      )
    }
    return result
  }, [snapshot])

  const issues = checks.filter((check) => check.state === 'BAD').length
  const healthy = Boolean(snapshot) && issues === 0

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Notification health</Text>
          <Text style={styles.subtitle}>Check seller order-alert readiness</Text>
        </View>
      </View>

      {loading && !snapshot ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.loadingText}>Checking notifications…</Text>
        </View>
      ) : snapshot ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.accent} />}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={[styles.hero, healthy ? styles.heroGood : styles.heroBad]}>
            <Ionicons
              name={healthy ? 'shield-checkmark-outline' : 'warning-outline'}
              size={30}
              color={healthy ? C.green : C.red}
            />
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>ORDER ALERT STATUS</Text>
              <Text style={[styles.heroTitle, { color: healthy ? C.green : C.red }]}>
                {healthy ? 'Healthy' : 'Needs attention'}
              </Text>
              <Text style={styles.heroDetail}>
                {healthy
                  ? 'This phone is ready to receive seller order notifications.'
                  : `${issues} notification setting${issues === 1 ? '' : 's'} need attention.`}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Checks</Text>
          <View style={styles.card}>
            {checks.map((check, index) => (
              <View key={check.key} style={index === checks.length - 1 ? undefined : styles.divider}>
                <CheckRow check={check} />
              </View>
            ))}
          </View>

          {snapshot.device ? (
            <View style={styles.deviceCard}>
              <Ionicons name={snapshot.device.platform === 'android' ? 'logo-android' : 'logo-apple'} size={23} color={C.text} />
              <View style={styles.deviceCopy}>
                <Text style={styles.deviceName}>{snapshot.device.deviceName}</Text>
                <Text style={styles.deviceMeta}>Last active {ago(snapshot.device.lastActiveAt)}</Text>
              </View>
            </View>
          ) : null}

          <Pressable onPress={() => void Linking.openSettings()} style={styles.action}>
            <Ionicons name="settings-outline" size={19} color={C.text} />
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>Open phone app settings</Text>
              <Text style={styles.actionDetail}>Notifications and battery usage</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={C.muted} />
          </Pressable>

          <Text style={styles.note}>
            This screen does not change the existing 30-second ringtone or Ring 1 / Ring 2 / Ring 3 behavior.
          </Text>
        </ScrollView>
      ) : (
        <View style={styles.center}>
          <Text style={styles.error}>{error ?? 'Unable to check notification health.'}</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, backgroundColor: C.surface },
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border, borderRadius: 13 },
  headerCopy: { flex: 1, marginLeft: 13 },
  title: { color: C.text, fontSize: 23, fontWeight: '900' },
  subtitle: { marginTop: 2, color: C.muted, fontSize: 12, fontWeight: '600' },
  content: { padding: 16, paddingBottom: 36 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  loadingText: { marginTop: 12, color: C.muted, fontWeight: '600' },
  error: { color: C.red, textAlign: 'center', marginBottom: 12 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 17, borderWidth: 1, borderRadius: 19 },
  heroGood: { borderColor: '#bbf7d0', backgroundColor: C.greenBg },
  heroBad: { borderColor: '#fecaca', backgroundColor: C.redBg },
  heroCopy: { flex: 1 },
  eyebrow: { color: C.subtle, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { marginTop: 3, fontSize: 21, fontWeight: '900' },
  heroDetail: { marginTop: 3, color: C.muted, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  sectionTitle: { marginTop: 22, marginBottom: 10, color: C.text, fontSize: 16, fontWeight: '900' },
  card: { overflow: 'hidden', borderWidth: 1, borderColor: C.border, borderRadius: 18, backgroundColor: C.surface },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  checkRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', padding: 13 },
  checkIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  checkCopy: { flex: 1, marginHorizontal: 11 },
  checkTitle: { color: C.text, fontSize: 13, fontWeight: '800' },
  checkDetail: { marginTop: 3, color: C.muted, fontSize: 10, lineHeight: 15, fontWeight: '600' },
  deviceCard: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderWidth: 1, borderColor: C.border, borderRadius: 16, backgroundColor: C.surface },
  deviceCopy: { flex: 1 },
  deviceName: { color: C.text, fontSize: 13, fontWeight: '900' },
  deviceMeta: { marginTop: 3, color: C.muted, fontSize: 10, fontWeight: '600' },
  action: { marginTop: 18, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderWidth: 1, borderColor: C.border, borderRadius: 16, backgroundColor: C.surface },
  actionCopy: { flex: 1 },
  actionTitle: { color: C.text, fontSize: 13, fontWeight: '800' },
  actionDetail: { marginTop: 3, color: C.muted, fontSize: 10, fontWeight: '600' },
  note: { marginTop: 16, padding: 14, borderRadius: 15, backgroundColor: '#f4f4f5', color: C.muted, fontSize: 11, lineHeight: 17, fontWeight: '600' },
})
