import {
  Ionicons } from '@expo/vector-icons'
import { useFocusEffect,
  useRouter } from 'expo-router'
import { useCallback,
  useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useSellerSession } from '../features/auth/session'
import {
  isStoreTimingsAuthError,
  storeTimingsApi,
  type SellerStoreTimings,
  type StoreDay,
  type StoreManualOpenOverride,
  type StoreOpeningHour,
} from '../features/store-timings/store-timings-api'

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

const DAY_LABELS: Record<StoreDay, string> = {
  SUNDAY: 'Sunday',
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
}

function shortDay(day: StoreDay) {
  return DAY_LABELS[day].slice(0, 3)
}

function OverrideButton({
  label,
  icon,
  active,
  disabled,
  onPress,
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  active: boolean
  disabled: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.overrideButton,
        active && styles.overrideButtonActive,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons
        name={icon}
        size={18}
        color={active ? C.accentDark : C.muted}
      />
      <Text style={[styles.overrideButtonText, active && styles.overrideButtonTextActive]}>
        {label}
      </Text>
    </Pressable>
  )
}

export default function StoreTimingsScreen() {
  const router = useRouter()
  const { session, refreshSession } = useSellerSession()
  const [data, setData] = useState<SellerStoreTimings | null>(null)
  const [hours, setHours] = useState<StoreOpeningHour[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingHours, setSavingHours] = useState(false)
  const [savingOverride, setSavingOverride] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const accessToken = session?.accessToken ?? null

  const withFreshToken = useCallback(
    async <T,>(operation: (token: string) => Promise<T>): Promise<T> => {
      if (!accessToken) throw new Error('Seller session is unavailable.')

      try {
        return await operation(accessToken)
      } catch (requestError) {
        if (!isStoreTimingsAuthError(requestError)) throw requestError

        const refreshed = await refreshSession(accessToken)
        if (!refreshed) throw requestError
        return operation(refreshed.accessToken)
      }
    },
    [accessToken, refreshSession],
  )

  const applyData = useCallback((next: SellerStoreTimings) => {
    setData(next)
    setHours(next.openingHours)
  }, [])

  const load = useCallback(
    async (showRefresh = false) => {
      if (!accessToken) return

      if (showRefresh) setRefreshing(true)
      else setLoading(true)

      try {
        setError(null)
        const next = await withFreshToken((token) => storeTimingsApi.get(token))
        applyData(next)
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load store timings.',
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [accessToken, applyData, withFreshToken],
  )

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const updateHour = useCallback(
    (day: StoreDay, changes: Partial<StoreOpeningHour>) => {
      setHours((current) =>
        current.map((item) => (item.day === day ? { ...item, ...changes } : item)),
      )
      setSuccess(null)
    },
    [],
  )

  const saveHours = useCallback(async () => {
    if (!accessToken || savingHours) return

    try {
      setSavingHours(true)
      setError(null)
      setSuccess(null)
      const next = await withFreshToken((token) =>
        storeTimingsApi.updateHours(token, hours),
      )
      applyData(next)
      setSuccess('Weekly opening hours saved.')
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to save opening hours.',
      )
    } finally {
      setSavingHours(false)
    }
  }, [accessToken, applyData, hours, savingHours, withFreshToken])

  const setOverride = useCallback(
    async (override: StoreManualOpenOverride) => {
      if (!accessToken || savingOverride || data?.manualOpenOverride === override) return

      try {
        setSavingOverride(true)
        setError(null)
        setSuccess(null)
        const next = await withFreshToken((token) =>
          storeTimingsApi.setOverride(token, override),
        )
        applyData(next)
        setSuccess(
          override === 'AUTO'
            ? 'Store now follows the weekly schedule.'
            : override === 'OPEN'
              ? 'Store is manually open.'
              : 'Store is manually closed.',
        )
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to change store availability.',
        )
      } finally {
        setSavingOverride(false)
      }
    },
    [accessToken, applyData, data?.manualOpenOverride, savingOverride, withFreshToken],
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
          <Text style={styles.title}>Store timings</Text>
          <Text style={styles.subtitle}>Opening hours and live availability</Text>
        </View>
      </View>

      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.loadingText}>Loading store timings…</Text>
        </View>
      ) : error && !data ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={34} color={C.red} />
          <Text style={styles.errorTitle}>Unable to load timings</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            onPress={() => void load()}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : data ? (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={C.accent}
            />
          }
        >
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="warning-outline" size={18} color={C.red} />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          ) : null}

          {success ? (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle-outline" size={18} color={C.green} />
              <Text style={styles.successBannerText}>{success}</Text>
            </View>
          ) : null}

          <View
            style={[
              styles.statusCard,
              data.availability.isOpen ? styles.statusOpen : styles.statusClosed,
            ]}
          >
            <View
              style={[
                styles.statusIcon,
                data.availability.isOpen ? styles.statusIconOpen : styles.statusIconClosed,
              ]}
            >
              <Ionicons
                name={data.availability.isOpen ? 'storefront-outline' : 'moon-outline'}
                size={24}
                color={data.availability.isOpen ? C.green : C.red}
              />
            </View>

            <View style={styles.statusCopy}>
              <Text style={styles.statusEyebrow}>CURRENT CUSTOMER STATUS</Text>
              <Text
                style={[
                  styles.statusTitle,
                  data.availability.isOpen ? styles.openText : styles.closedText,
                ]}
              >
                {data.availability.isOpen ? 'Open now' : 'Closed'}
              </Text>
              <Text style={styles.statusMessage}>{data.availability.message}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Manual control</Text>
          <Text style={styles.sectionDescription}>
            Manual Open or Closed stays active until you switch back to Automatic.
          </Text>

          <View style={styles.overrideGrid}>
            <OverrideButton
              label="Automatic"
              icon="time-outline"
              active={data.manualOpenOverride === 'AUTO'}
              disabled={savingOverride}
              onPress={() => void setOverride('AUTO')}
            />
            <OverrideButton
              label="Open"
              icon="lock-open-outline"
              active={data.manualOpenOverride === 'OPEN'}
              disabled={savingOverride}
              onPress={() => void setOverride('OPEN')}
            />
            <OverrideButton
              label="Closed"
              icon="lock-closed-outline"
              active={data.manualOpenOverride === 'CLOSED'}
              disabled={savingOverride}
              onPress={() => void setOverride('CLOSED')}
            />
          </View>

          {savingOverride ? (
            <View style={styles.savingLine}>
              <ActivityIndicator size="small" color={C.accent} />
              <Text>Updating store status…</Text>
            </View>
          ) : null}

          <View style={styles.sectionHeadRow}>
            <View>
              <Text style={styles.sectionTitle}>Weekly hours</Text>
              <Text style={styles.sectionDescription}>
                Times use IST and 24-hour HH:MM format.
              </Text>
            </View>
            <View style={styles.timezonePill}>
              <Text>IST</Text>
            </View>
          </View>

          <View style={styles.hoursCard}>
            {hours.map((item, index) => (
              <View
                key={item.day}
                style={[
                  styles.dayRow,
                  index === hours.length - 1 && styles.dayRowLast,
                ]}
              >
                <View style={styles.dayIdentity}>
                  <Text style={styles.dayShort}>{shortDay(item.day)}</Text>
                  <Text style={styles.dayName}>{DAY_LABELS[item.day]}</Text>
                </View>

                <Switch
                  value={item.isOpen}
                  onValueChange={(value) => updateHour(item.day, { isOpen: value })}
                  trackColor={{ false: '#d4d4d8', true: '#fcd34d' }}
                  thumbColor={item.isOpen ? C.accent : '#ffffff'}
                />

                {item.isOpen ? (
                  <View style={styles.timeInputs}>
                    <TextInput
                      value={item.openTime}
                      onChangeText={(value) => updateHour(item.day, { openTime: value })}
                      placeholder="09:00"
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={5}
                      style={styles.timeInput}
                    />
                    <Text style={styles.timeSeparator}>to</Text>
                    <TextInput
                      value={item.closeTime}
                      onChangeText={(value) => updateHour(item.day, { closeTime: value })}
                      placeholder="21:00"
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={5}
                      style={styles.timeInput}
                    />
                  </View>
                ) : (
                  <View style={styles.closedDayPill}>
                    <Text>Closed all day</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          <Pressable
            disabled={savingHours}
            onPress={() => void saveHours()}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && !savingHours && styles.pressed,
              savingHours && styles.disabled,
            ]}
          >
            {savingHours ? (
              <ActivityIndicator size="small" color="#171717" />
            ) : (
              <Ionicons name="checkmark-outline" size={19} color="#171717" />
            )}
            <Text style={styles.saveButtonText}>
              {savingHours ? 'Saving…' : 'Save weekly hours'}
            </Text>
          </Pressable>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color={C.muted} />
            <Text style={styles.infoText}>
              When the store is closed, customers can still view products, but Add and Buy now are
              disabled on the store page and checkout is blocked by the server.
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
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 13,
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
  errorTitle: {
    marginTop: 12,
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
  errorBanner: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 13,
    backgroundColor: C.redBg,
  },
  errorBannerText: {
    flex: 1,
    color: C.red,
    fontSize: 12,
    fontWeight: '700',
  },
  successBanner: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 13,
    backgroundColor: C.greenBg,
  },
  successBannerText: {
    flex: 1,
    color: C.green,
    fontSize: 12,
    fontWeight: '700',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 17,
    borderWidth: 1,
    borderRadius: 19,
  },
  statusOpen: {
    borderColor: '#bbf7d0',
    backgroundColor: C.greenBg,
  },
  statusClosed: {
    borderColor: '#fecaca',
    backgroundColor: C.redBg,
  },
  statusIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  statusIconOpen: {
    backgroundColor: '#dcfce7',
  },
  statusIconClosed: {
    backgroundColor: '#fee2e2',
  },
  statusCopy: {
    flex: 1,
  },
  statusEyebrow: {
    color: C.subtle,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  statusTitle: {
    marginTop: 3,
    fontSize: 21,
    fontWeight: '900',
  },
  openText: {
    color: C.green,
  },
  closedText: {
    color: C.red,
  },
  statusMessage: {
    marginTop: 3,
    color: C.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    marginTop: 24,
    color: C.text,
    fontSize: 17,
    fontWeight: '900',
  },
  sectionDescription: {
    marginTop: 4,
    color: C.muted,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '600',
  },
  overrideGrid: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  overrideButton: {
    flex: 1,
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 15,
    backgroundColor: C.surface,
  },
  overrideButtonActive: {
    borderColor: '#fbbf24',
    backgroundColor: '#fffbeb',
  },
  overrideButtonText: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  overrideButtonTextActive: {
    color: C.accentDark,
  },
  savingLine: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeadRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  timezonePill: {
    marginBottom: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#f4f4f5',
  },
  hoursCard: {
    marginTop: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    backgroundColor: C.surface,
  },
  dayRow: {
    minHeight: 86,
    padding: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  dayRowLast: {
    borderBottomWidth: 0,
  },
  dayIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  dayShort: {
    width: 34,
    color: C.accentDark,
    fontSize: 11,
    fontWeight: '900',
  },
  dayName: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    fontWeight: '800',
  },
  timeInputs: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInput: {
    width: 88,
    height: 38,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: C.bg,
    color: C.text,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  timeSeparator: {
    color: C.subtle,
    fontSize: 11,
    fontWeight: '700',
  },
  closedDayPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#f4f4f5',
  },
  saveButton: {
    minHeight: 50,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: C.accent,
  },
  saveButtonText: {
    color: '#171717',
    fontSize: 14,
    fontWeight: '900',
  },
  infoCard: {
    marginTop: 16,
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
    opacity: 0.55,
  },
})
