import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { useSellerSession } from '../../features/auth/session'
import {
  isSellerStoreAuthError,
  sellerStoreApi,
  type SellerOrder,
} from '../../features/store/store-api'

const ACCENT = '#f59e0b'
const TEXT = '#18181b'
const MUTED = '#71717a'
const BORDER = '#e4e4e7'
const SURFACE = '#ffffff'
const BACKGROUND = '#fafafa'

function money(value: number) {
  return `₹${value.toFixed(2)}`
}

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function statusTone(status: string) {
  if (status === 'PENDING') return styles.statusPending
  if (status === 'COMPLETED') return styles.statusCompleted
  if (status === 'REJECTED' || status === 'CANCELLED') return styles.statusRejected
  return styles.statusNeutral
}

export default function OrdersScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ orderId?: string | string[] }>()
  const { session, refreshSession } = useSellerSession()

  const orderId = Array.isArray(params.orderId)
    ? params.orderId[0]
    : params.orderId

  const [orders, setOrders] = useState<SellerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const accessToken = session?.accessToken ?? null

  const loadOrders = useCallback(
    async (showRefresh = false) => {
      if (!accessToken) return

      if (showRefresh) setRefreshing(true)
      else setLoading(true)

      try {
        setError(null)

        try {
          setOrders(await sellerStoreApi.orders(accessToken))
        } catch (requestError) {
          if (!isSellerStoreAuthError(requestError)) throw requestError

          const refreshed = await refreshSession(accessToken)
          if (!refreshed) throw requestError

          setOrders(await sellerStoreApi.orders(refreshed.accessToken))
        }
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load orders.',
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [accessToken, refreshSession],
  )

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  useEffect(() => {
    const timer = setInterval(() => {
      void loadOrders()
    }, 10000)

    return () => clearInterval(timer)
  }, [loadOrders])

  const selectedOrder = useMemo(
    () => (orderId ? orders.find((order) => order.id === orderId) ?? null : null),
    [orderId, orders],
  )

  const decide = useCallback(
    async (order: SellerOrder, decision: 'ACCEPT' | 'REJECT') => {
      if (!accessToken || busyOrderId) return

      setBusyOrderId(order.id)

      try {
        let updated: SellerOrder

        try {
          updated = await sellerStoreApi.decideOrder(
            accessToken,
            order.id,
            decision,
          )
        } catch (requestError) {
          if (!isSellerStoreAuthError(requestError)) throw requestError

          const refreshed = await refreshSession(accessToken)
          if (!refreshed) throw requestError

          updated = await sellerStoreApi.decideOrder(
            refreshed.accessToken,
            order.id,
            decision,
          )
        }

        setOrders((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        )
      } catch (requestError) {
        Alert.alert(
          'Unable to update order',
          requestError instanceof Error
            ? requestError.message
            : 'Please try again.',
        )
      } finally {
        setBusyOrderId(null)
      }
    },
    [accessToken, busyOrderId, refreshSession],
  )

  const callCustomer = useCallback(async (phoneNumber: string) => {
    const normalized = phoneNumber.trim()
    if (!normalized) return

    const supported = await Linking.canOpenURL(`tel:${normalized}`)
    if (!supported) {
      Alert.alert('Unable to call', 'No phone app is available on this device.')
      return
    }

    await Linking.openURL(`tel:${normalized}`)
  }, [])

  const renderOrderCard = (order: SellerOrder, exact = false) => {
    const busy = busyOrderId === order.id

    return (
      <View key={order.id} style={[styles.card, exact && styles.exactCard]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            <Text style={styles.orderNumber}>{order.orderNumber}</Text>
            <Text style={styles.orderTime}>
              {new Date(order.createdAt).toLocaleString()}
            </Text>
          </View>

          <View style={[styles.statusPill, statusTone(order.status)]}>
            <Text style={styles.statusText}>{statusLabel(order.status)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.customerRow}>
          <Ionicons name="person-outline" size={18} color={MUTED} />
          <View style={styles.customerText}>
            <Text style={styles.customerName}>{order.fullName}</Text>
            <Text style={styles.metaText}>{order.phoneNumber}</Text>
          </View>
        </View>

        <View style={styles.customerRow}>
          <Ionicons name="location-outline" size={18} color={MUTED} />
          <Text style={[styles.metaText, styles.flexText]}>
            {order.pickupLocation}
          </Text>
        </View>

        {order.preferredPickupTime ? (
          <View style={styles.customerRow}>
            <Ionicons name="time-outline" size={18} color={MUTED} />
            <Text style={[styles.metaText, styles.flexText]}>
              {order.preferredPickupTime}
            </Text>
          </View>
        ) : null}

        <View style={styles.items}>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemText}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.metaText}>
                  {item.quantity} × {money(item.unitPrice)}
                </Text>
              </View>
              <Text style={styles.itemTotal}>{money(item.totalPrice)}</Text>
            </View>
          ))}
        </View>

        {order.notes ? (
          <View style={styles.note}>
            <Text style={styles.noteLabel}>Customer note</Text>
            <Text style={styles.noteText}>{order.notes}</Text>
          </View>
        ) : null}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            {order.itemCount} item{order.itemCount === 1 ? '' : 's'}
          </Text>
          <Text style={styles.totalValue}>{money(order.totalAmount)}</Text>
        </View>

        {order.status === 'PENDING' ? (
          <View style={styles.actions}>
            <Pressable
              disabled={busy}
              onPress={() => void decide(order, 'REJECT')}
              style={({ pressed }) => [
                styles.button,
                styles.rejectButton,
                (pressed || busy) && styles.buttonPressed,
              ]}
            >
              <Text style={styles.rejectButtonText}>Reject</Text>
            </Pressable>

            <Pressable
              disabled={busy}
              onPress={() => void decide(order, 'ACCEPT')}
              style={({ pressed }) => [
                styles.button,
                styles.acceptButton,
                (pressed || busy) && styles.buttonPressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.acceptButtonText}>Accept</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {order.status === 'COMPLETED' ? (
          <Pressable
            onPress={() => void callCustomer(order.phoneNumber)}
            style={({ pressed }) => [
              styles.callButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Ionicons name="call-outline" size={18} color={TEXT} />
            <Text style={styles.callButtonText}>Call Customer</Text>
          </Pressable>
        ) : null}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadOrders(true)}
            tintColor={ACCENT}
          />
        }
      >
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text style={styles.title}>
              {orderId ? 'Order details' : 'Orders'}
            </Text>
            <Text style={styles.subtitle}>
              {orderId
                ? 'Opened from seller notification'
                : 'Pending and previous store orders'}
            </Text>
          </View>

          {orderId ? (
            <Pressable
              onPress={() => router.replace('/(tabs)/orders')}
              style={({ pressed }) => [
                styles.allOrdersButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons name="list-outline" size={18} color={TEXT} />
              <Text style={styles.allOrdersText}>All orders</Text>
            </Pressable>
          ) : null}
        </View>

        {loading && !orders.length ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={styles.stateText}>Loading orders…</Text>
          </View>
        ) : null}

        {error && !orders.length ? (
          <View style={styles.centerState}>
            <Ionicons name="cloud-offline-outline" size={28} color={MUTED} />
            <Text style={styles.stateTitle}>Couldn't load orders</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable
              onPress={() => void loadOrders()}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && orderId && !selectedOrder ? (
          <View style={styles.centerState}>
            <Ionicons name="receipt-outline" size={30} color={MUTED} />
            <Text style={styles.stateTitle}>Order not found</Text>
            <Text style={styles.stateText}>
              It may no longer be available for this store.
            </Text>
          </View>
        ) : null}

        {selectedOrder ? renderOrderCard(selectedOrder, true) : null}

        {!orderId && orders.length ? (
          <View style={styles.orderList}>
            {orders.map((order) => renderOrderCard(order))}
          </View>
        ) : null}

        {!loading && !orderId && !orders.length && !error ? (
          <View style={styles.centerState}>
            <Ionicons name="receipt-outline" size={30} color={MUTED} />
            <Text style={styles.stateTitle}>No orders yet</Text>
            <Text style={styles.stateText}>
              New store orders will appear here.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  container: {
    padding: 20,
    paddingBottom: 36,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  titleText: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: MUTED,
  },
  allOrdersButton: {
    minHeight: 42,
    paddingHorizontal: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  allOrdersText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '700',
  },
  orderList: {
    gap: 14,
  },
  card: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    backgroundColor: SURFACE,
    padding: 16,
    marginBottom: 14,
  },
  exactCard: {
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  orderNumber: {
    color: TEXT,
    fontSize: 17,
    fontWeight: '800',
  },
  orderTime: {
    marginTop: 4,
    color: MUTED,
    fontSize: 12,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPending: {
    backgroundColor: '#fef3c7',
  },
  statusCompleted: {
    backgroundColor: '#dcfce7',
  },
  statusRejected: {
    backgroundColor: '#fee2e2',
  },
  statusNeutral: {
    backgroundColor: '#f4f4f5',
  },
  statusText: {
    color: TEXT,
    fontSize: 11,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#f4f4f5',
    marginVertical: 14,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  customerText: {
    flex: 1,
  },
  customerName: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
  },
  metaText: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 19,
  },
  flexText: {
    flex: 1,
  },
  items: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f4f4f5',
    paddingTop: 12,
    gap: 11,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemText: {
    flex: 1,
  },
  itemName: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
  },
  itemTotal: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
  },
  note: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fafafa',
  },
  noteLabel: {
    color: TEXT,
    fontSize: 12,
    fontWeight: '800',
  },
  noteText: {
    marginTop: 4,
    color: MUTED,
    fontSize: 13,
    lineHeight: 19,
  },
  totalRow: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f4f4f5',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: MUTED,
    fontSize: 13,
  },
  totalValue: {
    color: TEXT,
    fontSize: 19,
    fontWeight: '900',
  },
  actions: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
  },
  rejectButtonText: {
    color: '#b91c1c',
    fontSize: 15,
    fontWeight: '800',
  },
  acceptButton: {
    backgroundColor: '#18181b',
  },
  acceptButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  callButton: {
    minHeight: 48,
    marginTop: 16,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#fafafa',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  callButtonText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '800',
  },
  centerState: {
    minHeight: 240,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  stateTitle: {
    marginTop: 10,
    color: TEXT,
    fontSize: 16,
    fontWeight: '800',
  },
  stateText: {
    marginTop: 7,
    color: MUTED,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  retryButton: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: TEXT,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.65,
  },
})
