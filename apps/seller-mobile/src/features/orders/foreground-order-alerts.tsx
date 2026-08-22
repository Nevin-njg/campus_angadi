import { router } from 'expo-router'
import { setAudioModeAsync, setIsAudioActiveAsync, useAudioPlayer } from 'expo-audio'
import * as Haptics from 'expo-haptics'
import {
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useSellerSession } from '../auth/session'
import {
  isSellerStoreAuthError,
  sellerStoreApi,
  type SellerOrder,
} from '../store/store-api'

const POLL_INTERVAL_MS = 2_000
const ACTIONABLE_ORDER_WINDOW_MS = 10 * 60 * 1000
const RING_DURATION_MS = 30 * 1000
const SECOND_ALERT_MS = 90 * 1000
const THIRD_ALERT_MS = 180 * 1000
const SECOND_RING_END_MS = SECOND_ALERT_MS + RING_DURATION_MS
const THIRD_RING_END_MS = THIRD_ALERT_MS + RING_DURATION_MS

const ALERT_SOUND = require('../../assets/sounds/new-order-alert.wav')
function orderAgeMs(order: SellerOrder, now: number) {
  const createdAt = new Date(order.createdAt).getTime()
  if (!Number.isFinite(createdAt)) return Number.POSITIVE_INFINITY
  return Math.max(0, now - createdAt)
}

function alertStage(order: SellerOrder, now: number): 0 | 1 | 2 | 3 {
  const age = orderAgeMs(order, now)

  // Exact retry windows:
  // 0-30s ring, 30-90s silent, 90-120s ring,
  // 120-180s silent, 180-210s ring.
  if (age < RING_DURATION_MS) return 1
  if (age >= SECOND_ALERT_MS && age < SECOND_RING_END_MS) return 2
  if (age >= THIRD_ALERT_MS && age < THIRD_RING_END_MS) return 3
  return 0
}

function formatWaiting(createdAt: string, now: number) {
  const created = new Date(createdAt).getTime()
  if (!Number.isFinite(created)) return 'Waiting'

  const seconds = Math.max(0, Math.floor((now - created) / 1000))
  if (seconds < 60) return `${seconds}s waiting`

  const minutes = Math.floor(seconds / 60)
  return `${minutes}m waiting`
}

export function ForegroundOrderAlertProvider({ children }: { children: ReactNode }) {
  const { session, refreshSession } = useSellerSession()
  const insets = useSafeAreaInsets()
  const player = useAudioPlayer(ALERT_SOUND, { downloadFirst: true })

  const [pendingOrders, setPendingOrders] = useState<SellerOrder[]>([])
  const [connected, setConnected] = useState(true)
  const [now, setNow] = useState(Date.now())

  const playedStagesRef = useRef(new Map<string, number>())
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollingRef = useRef(false)
  const ringingRef = useRef(false)

  const stopRinging = useCallback(() => {
    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current)
      ringTimerRef.current = null
    }

    ringingRef.current = false

    try {
      player.loop = false
      player.pause()
      void player.seekTo(0)
      void setIsAudioActiveAsync(false)
    } catch {
      // The player can briefly be unavailable during Fast Refresh.
    }

    Vibration.cancel()
  }, [player])

  const ring = useCallback(
    async (stage: 1 | 2 | 3) => {
      if (AppState.currentState !== 'active') return

      // Never restart an active 30-second burst. A second newly detected
      // order is grouped into the current alert instead of extending it.
      if (ringingRef.current) return
      ringingRef.current = true

      // Use the native haptics engine plus a repeating vibration pattern.
      // The repeating pattern makes the alert noticeable until the short ring window ends.
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        if (Platform.OS === 'android') {
          await Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press)
        }
      } catch {
        // The React Native vibration fallback below still runs.
      }

      const vibrationPattern =
        stage === 1
          ? [0, 350, 180, 350, 450]
          : stage === 2
            ? [0, 450, 120, 450, 120, 450, 350]
            : [0, 550, 90, 550, 90, 550, 90, 550, 250]

      if (Platform.OS === 'android') {
        Vibration.vibrate(vibrationPattern, true)
      } else {
        Vibration.vibrate(500)
      }

      // Activate Expo Audio explicitly and request exclusive audio focus.
      // This is more reliable on Android than relying on the default media session state.
      try {
        await setIsAudioActiveAsync(true)
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'doNotMix',
        })

        player.loop = true
        player.volume = 1
        player.setPlaybackRate(stage === 1 ? 1 : stage === 2 ? 1.08 : 1.16)

        if (player.isLoaded) {
          await player.seekTo(0)
          player.play()
        } else {
          console.warn('Seller order alert sound is still loading; vibration fallback is active')
        }
      } catch (error) {
        console.warn('Seller order audio alert failed', error)
      }


      ringTimerRef.current = setTimeout(stopRinging, RING_DURATION_MS)
    },
    [player, stopRinging],
  )

  const checkOrders = useCallback(async () => {
    const accessToken = session?.accessToken
    if (!accessToken || pollingRef.current || AppState.currentState !== 'active') return

    pollingRef.current = true

    try {
      let orders: SellerOrder[]

      try {
        orders = await sellerStoreApi.orders(accessToken)
      } catch (error) {
        if (!isSellerStoreAuthError(error)) throw error

        const refreshed = await refreshSession(accessToken)
        if (!refreshed) throw error

        orders = await sellerStoreApi.orders(refreshed.accessToken)
      }

      const checkedAt = Date.now()
      setNow(checkedAt)

      const freshPending = orders
        .filter(
          (order) =>
            order.status === 'PENDING' &&
            orderAgeMs(order, checkedAt) <= ACTIONABLE_ORDER_WINDOW_MS,
        )
        .sort(
          (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
        )

      setPendingOrders(freshPending)
      setConnected(true)

      const pendingIds = new Set(freshPending.map((order) => order.id))
      for (const orderId of playedStagesRef.current.keys()) {
        if (!pendingIds.has(orderId)) playedStagesRef.current.delete(orderId)
      }

      let highestNewStage: 1 | 2 | 3 | null = null

      for (const order of freshPending) {
        const stage = alertStage(order, checkedAt)
        const previousStage = playedStagesRef.current.get(order.id) ?? 0

        if (stage !== 0 && stage > previousStage) {
          playedStagesRef.current.set(order.id, stage)
          if (highestNewStage === null || stage > highestNewStage) highestNewStage = stage
        }
      }

      if (freshPending.length === 0) {
        stopRinging()
      } else if (highestNewStage !== null) {
        await ring(highestNewStage)
      }
    } catch {
      setConnected(false)
    } finally {
      pollingRef.current = false
    }
  }, [refreshSession, ring, session?.accessToken, stopRinging])

  useEffect(() => {
    void checkOrders()

    const pollTimer = setInterval(() => {
      void checkOrders()
    }, POLL_INTERVAL_MS)

    const clockTimer = setInterval(() => setNow(Date.now()), 1_000)

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkOrders()
      } else {
        stopRinging()
      }
    })

    return () => {
      clearInterval(pollTimer)
      clearInterval(clockTimer)
      appStateSubscription.remove()
      stopRinging()
    }
  }, [checkOrders, stopRinging])

  useEffect(() => {
    if (!session?.accessToken) {
      setPendingOrders([])
      playedStagesRef.current.clear()
      stopRinging()
    }
  }, [session?.accessToken, stopRinging])

  const oldestOrder = pendingOrders[0]
  const bannerText = useMemo(() => {
    if (!oldestOrder) return null

    if (pendingOrders.length === 1) {
      return `#${oldestOrder.orderNumber} · ${formatWaiting(oldestOrder.createdAt, now)}`
    }

    return `${pendingOrders.length} orders waiting · oldest ${formatWaiting(oldestOrder.createdAt, now)}`
  }, [now, oldestOrder, pendingOrders.length])

  return (
    <View style={styles.root}>
      {children}

      {oldestOrder ? (
        <Pressable
          onPress={() => router.navigate('/(tabs)')}
          style={[styles.banner, { top: insets.top + 8 }]}
        >
          <View style={styles.bannerDot} />
          <View style={styles.bannerCopy}>
            <Text style={styles.bannerTitle}>
              {pendingOrders.length === 1 ? 'New order waiting' : `${pendingOrders.length} new orders`}
            </Text>
            <Text style={styles.bannerText} numberOfLines={1}>
              {bannerText}
            </Text>
          </View>
          <Text style={styles.bannerAction}>OPEN</Text>
        </Pressable>
      ) : !connected ? (
        <View style={[styles.connectionBanner, { top: insets.top + 8 }]}>
          <Text style={styles.connectionText}>Order alerts disconnected · retrying…</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  bannerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f97316',
  },
  bannerCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },
  bannerTitle: {
    color: '#9a3412',
    fontSize: 14,
    fontWeight: '900',
  },
  bannerText: {
    marginTop: 2,
    color: '#7c2d12',
    fontSize: 12,
    fontWeight: '600',
  },
  bannerAction: {
    marginLeft: 10,
    color: '#c2410c',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  connectionBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 14,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 14,
    paddingVertical: 10,
    elevation: 5,
  },
  connectionText: {
    color: '#991b1b',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
  },
})
