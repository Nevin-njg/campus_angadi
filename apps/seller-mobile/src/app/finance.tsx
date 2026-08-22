import {
  Ionicons } from '@expo/vector-icons'
import { useFocusEffect,
  useRouter } from 'expo-router'
import { useCallback,
  useMemo,
  useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useSellerSession } from '../features/auth/session'
import {
  isSellerFinanceAuthError,
  sellerFinanceApi,
  type SellerFinance,
} from '../features/finance/finance-api'

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

function currentMonthIst() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())

  const year = parts.find((part) => part.type === 'year')?.value ?? ''
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  return `${year}-${month}`
}

function shiftMonth(value: string, delta: number) {
  const [yearText, monthText] = value.split('-')
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(value: string) {
  const [yearText, monthText] = value.split('-')
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(Number(yearText), Number(monthText) - 1, 1)))
}

function money(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value)
}

function settledDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function MetricCard({
  icon,
  label,
  value,
  note,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  note: string
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={19} color={C.accentDark} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricNote}>{note}</Text>
    </View>
  )
}

function Row({
  label,
  value,
  danger = false,
}: {
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, danger && styles.rowDanger]}>{value}</Text>
    </View>
  )
}

export default function FinanceScreen() {
  const router = useRouter()
  const { session, refreshSession } = useSellerSession()
  const [month, setMonth] = useState(currentMonthIst)
  const [finance, setFinance] = useState<SellerFinance | null>(null)
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
        if (!isSellerFinanceAuthError(requestError)) throw requestError

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
        const next = await withFreshToken((token) => sellerFinanceApi.get(token, month))
        setFinance(next)

        if (next.month !== month) {
          setMonth(next.month)
        }
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load finance data.',
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [accessToken, month, withFreshToken],
  )

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const currentMonth = finance?.currentMonth ?? currentMonthIst()
  const canMoveForward = month < currentMonth

  const settlementLabel = useMemo(() => {
    if (!finance) return ''
    if (finance.month === finance.currentMonth) return 'Open month'
    return finance.monthly.status === 'SETTLED' ? 'Settled' : 'Pending settlement'
  }, [finance])

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
          <Text style={styles.title}>Finance</Text>
          <Text style={styles.subtitle}>Sales, earnings and settlements</Text>
        </View>
      </View>

      {loading && !finance ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.loadingText}>Loading finance…</Text>
        </View>
      ) : error && !finance ? (
        <View style={styles.center}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle-outline" size={28} color={C.red} />
          </View>
          <Text style={styles.errorTitle}>Unable to load finance</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            onPress={() => void load()}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : finance ? (
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

          <View style={styles.monthCard}>
            <Pressable
              onPress={() => setMonth((value) => shiftMonth(value, -1))}
              accessibilityLabel="Previous month"
              style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={20} color={C.text} />
            </Pressable>

            <View style={styles.monthCopy}>
              <Text style={styles.monthEyebrow}>Selected month</Text>
              <Text style={styles.monthTitle}>{monthLabel(month)}</Text>
            </View>

            <Pressable
              disabled={!canMoveForward}
              onPress={() => setMonth((value) => shiftMonth(value, 1))}
              accessibilityLabel="Next month"
              style={({ pressed }) => [
                styles.monthButton,
                !canMoveForward && styles.monthButtonDisabled,
                pressed && canMoveForward && styles.pressed,
              ]}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={canMoveForward ? C.text : C.subtle}
              />
            </Pressable>
          </View>

          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroEyebrow}>PAYABLE TO STORE</Text>
                <Text style={styles.heroValue}>{money(finance.monthly.payableToStore)}</Text>
              </View>

              <View
                style={[
                  styles.statusPill,
                  finance.monthly.status === 'SETTLED'
                    ? styles.statusPillSettled
                    : styles.statusPillPending,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    finance.monthly.status === 'SETTLED'
                      ? styles.statusTextSettled
                      : styles.statusTextPending,
                  ]}
                >
                  {settlementLabel}
                </Text>
              </View>
            </View>

            <Text style={styles.heroDescription}>
              {finance.month === finance.currentMonth
                ? 'This month is still open. Final settlement is available after the month ends.'
                : finance.monthly.status === 'SETTLED'
                  ? `Settled ${finance.monthly.settledAt ? settledDate(finance.monthly.settledAt) : ''}`
                  : 'This month has ended and is awaiting settlement by Campus Angadi.'}
            </Text>

            <View style={styles.heroDivider} />

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Gross sales</Text>
                <Text style={styles.heroStatValue}>{money(finance.monthly.grossSales)}</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Platform fee</Text>
                <Text style={styles.heroStatValue}>{money(finance.monthly.commissionAmount)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{monthLabel(month)} summary</Text>
            <Text style={styles.sectionHint}>Completed orders only</Text>
          </View>

          <View style={styles.metricsGrid}>
            <MetricCard
              icon="bag-check-outline"
              label="Completed orders"
              value={String(finance.monthly.completedOrderCount)}
              note={`${money(finance.monthly.grossSales)} gross sales`}
            />
            <MetricCard
              icon="receipt-outline"
              label="Average order"
              value={money(finance.monthly.averageOrder)}
              note="Per completed order"
            />
            <MetricCard
              icon="business-outline"
              label="Commission"
              value={`${finance.monthly.commissionPercent}%`}
              note={`${money(finance.monthly.commissionAmount)} platform fee`}
            />
            <MetricCard
              icon="wallet-outline"
              label="Store earnings"
              value={money(finance.monthly.payableToStore)}
              note="After commission"
            />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>All-time performance</Text>
            <Text style={styles.sectionHint}>Across this store</Text>
          </View>

          <View style={styles.card}>
            <Row label="Completed sales" value={money(finance.overview.completedSales)} />
            <Row label="Store earnings" value={money(finance.overview.storeEarnings)} />
            <Row label="Platform commission" value={money(finance.overview.commissionAmount)} />
            <Row label="Average completed order" value={money(finance.overview.averageCompletedOrder)} />
            <Row label="Completed orders" value={String(finance.overview.completedOrderCount)} />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Order value breakdown</Text>
            <Text style={styles.sectionHint}>Current store totals</Text>
          </View>

          <View style={styles.card}>
            <Row label="All orders" value={money(finance.overview.orderValue)} />
            <Row label="Confirmed value" value={money(finance.overview.confirmedValue)} />
            <Row label="Active order value" value={money(finance.overview.activeOrderValue)} />
            <Row
              label="Cancelled / rejected"
              value={money(finance.overview.cancelledValue)}
              danger={finance.overview.cancelledValue > 0}
            />
          </View>

          <View style={styles.counts}>
            <View style={styles.countItem}>
              <Text style={styles.countValue}>{finance.overview.orderCount}</Text>
              <Text style={styles.countLabel}>All orders</Text>
            </View>
            <View style={styles.countDivider} />
            <View style={styles.countItem}>
              <Text style={styles.countValue}>{finance.overview.activeOrderCount}</Text>
              <Text style={styles.countLabel}>Active</Text>
            </View>
            <View style={styles.countDivider} />
            <View style={styles.countItem}>
              <Text style={styles.countValue}>{finance.overview.cancelledOrderCount}</Text>
              <Text style={styles.countLabel}>Cancelled</Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color={C.muted} />
            <Text style={styles.infoText}>
              Use the month arrows to review previous settlement periods. Finance is read-only for
              sellers; settlements are managed by Campus Angadi.
            </Text>
          </View>
        </ScrollView>
      ) : null}
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
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  headerCopy: {
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
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.redBg,
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
    borderRadius: 12,
    backgroundColor: C.text,
    paddingHorizontal: 20,
    paddingVertical: 11,
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
    backgroundColor: C.redBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineErrorText: {
    flex: 1,
    color: C.red,
    fontSize: 12,
    fontWeight: '700',
  },
  monthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 17,
    backgroundColor: C.surface,
    padding: 8,
  },
  monthButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: C.bg,
  },
  monthButtonDisabled: {
    opacity: 0.45,
  },
  monthCopy: {
    flex: 1,
    alignItems: 'center',
  },
  monthEyebrow: {
    color: C.subtle,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  monthTitle: {
    marginTop: 2,
    color: C.text,
    fontSize: 16,
    fontWeight: '900',
  },
  hero: {
    marginTop: 14,
    borderRadius: 22,
    backgroundColor: C.text,
    padding: 20,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroEyebrow: {
    color: '#a1a1aa',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  heroValue: {
    marginTop: 7,
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '900',
  },
  statusPill: {
    maxWidth: 130,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillSettled: {
    backgroundColor: '#14532d',
  },
  statusPillPending: {
    backgroundColor: '#78350f',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
  statusTextSettled: {
    color: '#bbf7d0',
  },
  statusTextPending: {
    color: '#fde68a',
  },
  heroDescription: {
    marginTop: 13,
    color: '#d4d4d8',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 16,
    backgroundColor: '#3f3f46',
  },
  heroStats: {
    flexDirection: 'row',
  },
  heroStat: {
    flex: 1,
  },
  heroStatLabel: {
    color: '#a1a1aa',
    fontSize: 10,
    fontWeight: '700',
  },
  heroStatValue: {
    marginTop: 4,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48.5%',
    minHeight: 145,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 17,
    backgroundColor: C.surface,
    padding: 14,
  },
  metricIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#fffbeb',
  },
  metricLabel: {
    marginTop: 12,
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  metricValue: {
    marginTop: 4,
    color: C.text,
    fontSize: 18,
    fontWeight: '900',
  },
  metricNote: {
    marginTop: 4,
    color: C.subtle,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 17,
    backgroundColor: C.surface,
    paddingHorizontal: 15,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  rowLabel: {
    flex: 1,
    color: C.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  rowValue: {
    color: C.text,
    fontSize: 13,
    fontWeight: '900',
  },
  rowDanger: {
    color: C.red,
  },
  counts: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 17,
    backgroundColor: C.surface,
    paddingVertical: 15,
  },
  countItem: {
    flex: 1,
    alignItems: 'center',
  },
  countValue: {
    color: C.text,
    fontSize: 18,
    fontWeight: '900',
  },
  countLabel: {
    marginTop: 3,
    color: C.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  countDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
  },
  infoCard: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 15,
    backgroundColor: '#f4f4f5',
    padding: 14,
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
