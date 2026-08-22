import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useSellerSession } from '../../features/auth/session'
import {
  isSellerStoreAuthError,
  sellerStoreApi,
  type SellerOrder,
  type SellerStoreDashboard,
} from '../../features/store/store-api'

const MOBILE_PENDING_STATUS = 'PENDING'
const LEGACY_PENDING_CUTOFF_MS = 10 * 60 * 1000

function money(value: number) {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0
  return `₹${amount.toFixed(2)}`
}

function waitMs(order: SellerOrder, now: number) {
  const created = new Date(order.createdAt).getTime()
  return Number.isFinite(created) ? Math.max(0, now - created) : 0
}

function formatWaiting(createdAt: string, now: number) {
  const created = new Date(createdAt).getTime()
  if (!Number.isFinite(created)) return 'Waiting'

  const seconds = Math.max(0, Math.floor((now - created) / 1000))
  if (seconds < 60) return `${seconds}s waiting`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m waiting`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m waiting`
}

function isToday(value: string | null | undefined) {
  if (!value) return false
  const date = new Date(value)
  const today = new Date()

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function PendingOrderCard({
  order,
  now,
  busy,
  onAccept,
  onReject,
}: {
  order: SellerOrder
  now: number
  busy: boolean
  onAccept: () => void
  onReject: () => void
}) {
  const waiting = waitMs(order, now)
  const urgent = waiting >= 2 * 60 * 1000
  const warning = !urgent && waiting >= 60 * 1000

  return (
    <View
      style={[
        styles.orderCard,
        warning && styles.orderCardWarning,
        urgent && styles.orderCardUrgent,
      ]}
    >
      <View style={styles.orderTopRow}>
        <View style={styles.orderTopLeft}>
          <Text style={styles.orderNumber} numberOfLines={1} ellipsizeMode="middle">
            #{order.orderNumber}
          </Text>
          <Text style={styles.orderStatus}>NEW ORDER</Text>
        </View>

        <Text
          style={[styles.waiting, warning && styles.waitingWarning, urgent && styles.waitingUrgent]}
          numberOfLines={1}
        >
          {formatWaiting(order.createdAt, now)}
        </Text>
      </View>

      <View style={styles.divider} />

      <Text style={styles.customerName}>{order.fullName || 'Customer'}</Text>

      <View style={styles.items}>
        {order.items.length ? (
          order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.productName}
              </Text>
              <Text style={styles.itemQuantity}>× {item.quantity}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.itemName}>{order.itemCount} item(s)</Text>
        )}
      </View>

      <View style={styles.orderBottomRow}>
        <Text style={styles.pickup} numberOfLines={1}>
          {order.pickupLocation || 'Campus pickup'}
        </Text>
        <Text style={styles.orderTotal}>{money(order.totalAmount)}</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          disabled={busy}
          onPress={onReject}
          style={[styles.rejectButton, busy && styles.buttonDisabled]}
        >
          <Text style={styles.rejectButtonText}>Reject</Text>
        </Pressable>

        <Pressable
          disabled={busy}
          onPress={onAccept}
          style={[styles.acceptButton, busy && styles.buttonDisabled]}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.acceptButtonText}>Accept</Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

function CompletedOrderCard({ order, onCall }: { order: SellerOrder; onCall: () => void }) {
  return (
    <View style={styles.completedCard}>
      <View style={styles.completedTopRow}>
        <View style={styles.completedTitleWrap}>
          <Text style={styles.completedOrderNumber} numberOfLines={1} ellipsizeMode="middle">
            #{order.orderNumber}
          </Text>
          <Text style={styles.completedCustomer} numberOfLines={1}>
            {order.fullName || 'Customer'}
          </Text>
        </View>
        <Text style={styles.completedAmount}>{money(order.totalAmount)}</Text>
      </View>

      {order.phoneNumber ? (
        <Pressable style={styles.callButton} onPress={onCall}>
          <Text style={styles.callButtonText}>Call Customer</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

export default function HomeScreen() {
  const { session, refreshSession } = useSellerSession()
  const [dashboard, setDashboard] = useState<SellerStoreDashboard | null>(null)
  const [orders, setOrders] = useState<SellerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  const withAuthRetry = useCallback(
    async <T,>(request: (accessToken: string) => Promise<T>): Promise<T> => {
      const accessToken = session?.accessToken
      if (!accessToken) throw new Error('Your seller session is not available.')

      try {
        return await request(accessToken)
      } catch (error) {
        if (!isSellerStoreAuthError(error)) throw error

        const refreshed = await refreshSession(accessToken)
        if (!refreshed) throw error

        return request(refreshed.accessToken)
      }
    },
    [refreshSession, session?.accessToken],
  )

  const loadStore = useCallback(
    async (showLoader = false, surfaceErrors = true) => {
      if (!session?.accessToken) return

      if (showLoader) setLoading(true)
      if (surfaceErrors) setError(null)

      try {
        const [storeDashboard, storeOrders] = await Promise.all([
          withAuthRetry((accessToken) => sellerStoreApi.dashboard(accessToken)),
          withAuthRetry((accessToken) => sellerStoreApi.orders(accessToken)),
        ])

        setDashboard(storeDashboard)
        setOrders(storeOrders)
      } catch (loadError) {
        // Silent background polling should keep the last good dashboard instead
        // of replacing it with a transient development transport error.
        if (surfaceErrors) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load your store.')
        }
      } finally {
        if (showLoader) setLoading(false)
      }
    },
    [session?.accessToken, withAuthRetry],
  )

  useEffect(() => {
    void loadStore(true)
  }, [loadStore])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [])

  // Keep multiple seller devices reasonably in sync during development.
  // Native push/realtime ringing will replace this polling for final release.
  useEffect(() => {
    const timer = setInterval(() => {
      void loadStore(false, false)
    }, 10_000)
    return () => clearInterval(timer)
  }, [loadStore])

  const pendingOrders = useMemo(
    () =>
      orders
        .filter(
          (order) =>
            order.status === MOBILE_PENDING_STATUS &&
            waitMs(order, now) <= LEGACY_PENDING_CUTOFF_MS,
        )
        .sort(
          (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
        ),
    [orders, now],
  )

  const todayOrders = useMemo(() => orders.filter((order) => isToday(order.createdAt)), [orders])

  const acceptedToday = useMemo(
    () => todayOrders.filter((order) => order.status === 'COMPLETED').length,
    [todayOrders],
  )

  const rejectedToday = useMemo(
    () => todayOrders.filter((order) => order.status === 'REJECTED').length,
    [todayOrders],
  )

  const missedToday = useMemo(
    () =>
      todayOrders.filter(
        (order) =>
          order.status === MOBILE_PENDING_STATUS && waitMs(order, now) > LEGACY_PENDING_CUTOFF_MS,
      ).length,
    [todayOrders, now],
  )

  const recentlyCompleted = useMemo(
    () =>
      orders
        .filter(
          (order) => order.status === 'COMPLETED' && isToday(order.completedAt ?? order.createdAt),
        )
        .sort(
          (left, right) =>
            new Date(right.completedAt ?? right.createdAt).getTime() -
            new Date(left.completedAt ?? left.createdAt).getTime(),
        )
        .slice(0, 3),
    [orders],
  )

  async function refresh() {
    setRefreshing(true)
    await loadStore(false)
    setRefreshing(false)
  }

  async function decideOrder(order: SellerOrder, decision: 'ACCEPT' | 'REJECT') {
    if (!session?.accessToken || busyOrderId) return

    setBusyOrderId(order.id)
    setActionError(null)

    try {
      const updated = await withAuthRetry((accessToken) =>
        sellerStoreApi.decideOrder(accessToken, order.id, decision),
      )

      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)))

      await loadStore(false)
    } catch (decisionError) {
      setActionError(
        decisionError instanceof Error ? decisionError.message : 'Unable to update this order.',
      )
      await loadStore(false)
    } finally {
      setBusyOrderId(null)
    }
  }

  async function callCustomer(order: SellerOrder) {
    const phone = (order.phoneNumber ?? '').replace(/[^+\d]/g, '')
    if (!phone) {
      Alert.alert('Phone unavailable', 'This order does not have a customer phone number.')
      return
    }

    const url = `tel:${phone}`
    const supported = await Linking.canOpenURL(url)
    if (!supported) {
      Alert.alert('Calling unavailable', 'The phone dialer could not be opened.')
      return
    }

    await Linking.openURL(url)
  }

  const sellerName =
    session?.user.profile?.displayName ?? session?.user.profile?.fullName ?? 'Seller'

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading your store…</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!dashboard) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.errorState}>
          <Text style={styles.errorTitle}>Store unavailable</Text>
          <Text style={styles.errorText}>{error ?? 'Unable to load your store.'}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadStore(true)}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const storeActive = dashboard.store.status === 'ACTIVE'

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        <Text style={styles.brand}>CAMPUS ANGADI SELLER</Text>

        <Text style={styles.storeName}>{dashboard.store.name}</Text>
        <Text style={styles.sellerName}>{sellerName}</Text>
        <Text style={styles.sellerEmail} numberOfLines={1} ellipsizeMode="middle">
          {session?.user.email}
        </Text>

        <View style={styles.topStatusRow}>
          <View
            style={[
              styles.statusPill,
              storeActive ? styles.statusPillActive : styles.statusPillInactive,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                storeActive ? styles.statusDotActive : styles.statusDotInactive,
              ]}
            />
            <Text
              style={[
                styles.statusPillText,
                storeActive ? styles.statusTextActive : styles.statusTextInactive,
              ]}
            >
              {storeActive ? 'Store Active' : statusLabel(dashboard.store.status)}
            </Text>
          </View>

          <View style={styles.notificationHealth}>
            <View style={styles.notificationDot} />
            <Text style={styles.notificationHealthText}>Connected</Text>
          </View>
        </View>

        {dashboard.store.campusLocation ? (
          <Text style={styles.storeMeta}>
            {dashboard.store.campusLocation} · {dashboard.store.deliveryTimeMinutes} min delivery
          </Text>
        ) : null}

        {error ? <Text style={styles.inlineError}>{error}</Text> : null}
        {actionError ? <Text style={styles.inlineError}>{actionError}</Text> : null}

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{todayOrders.length}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{acceptedToday}</Text>
            <Text style={styles.statLabel}>Accepted</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{rejectedToday}</Text>
            <Text style={styles.statLabel}>Rejected</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{missedToday}</Text>
            <Text style={styles.statLabel}>Missed</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pending Orders</Text>
          <Text style={styles.sectionCount}>{pendingOrders.length}</Text>
        </View>

        {pendingOrders.length ? (
          <View style={styles.orderList}>
            {pendingOrders.map((order) => (
              <PendingOrderCard
                key={order.id}
                order={order}
                now={now}
                busy={busyOrderId === order.id}
                onAccept={() => void decideOrder(order, 'ACCEPT')}
                onReject={() => void decideOrder(order, 'REJECT')}
              />
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No pending orders</Text>
            <Text style={styles.emptyText}>
              New orders for {dashboard.store.name} will appear here.
            </Text>
          </View>
        )}

        {recentlyCompleted.length ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Completed Today</Text>
              <Text style={styles.sectionCount}>{recentlyCompleted.length}</Text>
            </View>
            <View style={styles.completedList}>
              {recentlyCompleted.map((order) => (
                <CompletedOrderCard
                  key={order.id}
                  order={order}
                  onCall={() => void callCustomer(order)}
                />
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.storeInfoCard}>
          <Text style={styles.storeInfoTitle}>Store information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Products</Text>
            <Text style={styles.infoValue}>{dashboard.analytics.productCount}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Minimum order</Text>
            <Text style={styles.infoValue}>{money(dashboard.store.minimumOrderAmount)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Delivery estimate</Text>
            <Text style={styles.infoValue}>{dashboard.store.deliveryTimeMinutes} min</Text>
          </View>
          <View style={styles.infoRowLast}>
            <Text style={styles.infoLabel}>Categories</Text>
            <Text style={styles.infoValue}>{dashboard.store.categories.length}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 110,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#71717a',
    fontSize: 14,
    fontWeight: '600',
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: {
    color: '#18181b',
    fontSize: 24,
    fontWeight: '800',
  },
  errorText: {
    marginTop: 8,
    color: '#71717a',
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 20,
    alignSelf: 'flex-start',
    borderRadius: 12,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryButtonText: {
    color: '#18181b',
    fontSize: 14,
    fontWeight: '800',
  },
  brand: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.7,
  },
  storeName: {
    marginTop: 5,
    color: '#18181b',
    fontSize: 29,
    fontWeight: '900',
  },
  sellerName: {
    marginTop: 4,
    color: '#52525b',
    fontSize: 13,
    fontWeight: '700',
  },
  sellerEmail: {
    marginTop: 2,
    color: '#71717a',
    fontSize: 12,
  },
  topStatusRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusPillActive: {
    backgroundColor: '#ecfdf5',
  },
  statusPillInactive: {
    backgroundColor: '#fef2f2',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotActive: {
    backgroundColor: '#16a34a',
  },
  statusDotInactive: {
    backgroundColor: '#dc2626',
  },
  statusPillText: {
    marginLeft: 7,
    fontSize: 12,
    fontWeight: '800',
  },
  statusTextActive: {
    color: '#166534',
  },
  statusTextInactive: {
    color: '#991b1b',
  },
  notificationHealth: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16a34a',
  },
  notificationHealthText: {
    marginLeft: 6,
    color: '#52525b',
    fontSize: 12,
    fontWeight: '700',
  },
  storeMeta: {
    marginTop: 14,
    color: '#71717a',
    fontSize: 13,
  },
  inlineError: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700',
  },
  statsGrid: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 14,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 15,
  },
  statValue: {
    color: '#18181b',
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    marginTop: 3,
    color: '#71717a',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeader: {
    marginTop: 30,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#18181b',
    fontSize: 21,
    fontWeight: '900',
  },
  sectionCount: {
    marginLeft: 8,
    minWidth: 24,
    borderRadius: 999,
    backgroundColor: '#f4f4f5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    color: '#52525b',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
  },
  orderList: {
    gap: 12,
  },
  orderCard: {
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 18,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  orderCardWarning: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  orderCardUrgent: {
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  orderTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  orderTopLeft: {
    flex: 1,
    minWidth: 0,
  },
  orderNumber: {
    color: '#18181b',
    fontSize: 16,
    fontWeight: '900',
  },
  orderStatus: {
    marginTop: 5,
    color: '#71717a',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  waiting: {
    flexShrink: 0,
    color: '#52525b',
    fontSize: 11,
    fontWeight: '800',
  },
  waitingWarning: {
    color: '#b45309',
  },
  waitingUrgent: {
    color: '#b91c1c',
  },
  divider: {
    marginVertical: 14,
    height: 1,
    backgroundColor: '#e4e4e7',
  },
  customerName: {
    color: '#27272a',
    fontSize: 17,
    fontWeight: '900',
  },
  customerPhone: {
    marginTop: 3,
    color: '#71717a',
    fontSize: 13,
  },
  items: {
    marginTop: 14,
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemName: {
    flex: 1,
    color: '#3f3f46',
    fontSize: 14,
    lineHeight: 20,
  },
  itemQuantity: {
    color: '#18181b',
    fontSize: 14,
    fontWeight: '800',
  },
  orderBottomRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pickup: {
    flex: 1,
    color: '#71717a',
    fontSize: 12,
  },
  orderTotal: {
    color: '#18181b',
    fontSize: 20,
    fontWeight: '900',
  },
  actionRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  rejectButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    backgroundColor: '#fff1f2',
    paddingVertical: 12,
  },
  rejectButtonText: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '900',
  },
  acceptButton: {
    flex: 1.3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#16a34a',
    paddingVertical: 12,
  },
  acceptButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  empty: {
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 18,
  },
  emptyTitle: {
    color: '#27272a',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyText: {
    marginTop: 4,
    color: '#71717a',
    fontSize: 12,
    lineHeight: 18,
  },
  completedList: {
    gap: 10,
  },
  completedCard: {
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 16,
    backgroundColor: '#f0fdf4',
    padding: 14,
  },
  completedTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  completedTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  completedOrderNumber: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '900',
  },
  completedCustomer: {
    marginTop: 4,
    color: '#3f3f46',
    fontSize: 13,
    fontWeight: '700',
  },
  completedAmount: {
    color: '#166534',
    fontSize: 15,
    fontWeight: '900',
  },
  callButton: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 11,
    backgroundColor: '#ffffff',
    paddingVertical: 10,
  },
  callButtonText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '900',
  },
  storeInfoCard: {
    marginTop: 30,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  storeInfoTitle: {
    marginBottom: 5,
    color: '#18181b',
    fontSize: 16,
    fontWeight: '900',
  },
  infoRow: {
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f4f4f5',
  },
  infoRowLast: {
    paddingTop: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    color: '#71717a',
    fontSize: 13,
  },
  infoValue: {
    color: '#27272a',
    fontSize: 13,
    fontWeight: '800',
  },
})
