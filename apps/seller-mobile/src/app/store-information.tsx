import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useSellerSession } from '../features/auth/session'
import {
  isSellerStoreAuthError,
  sellerStoreApi,
  type SellerStore,
} from '../features/store/store-api'

const C = {
  bg: '#fafafa',
  surface: '#ffffff',
  text: '#18181b',
  muted: '#71717a',
  subtle: '#a1a1aa',
  border: '#e4e4e7',
  accent: '#f59e0b',
  accentDark: '#92400e',
  success: '#15803d',
  successBg: '#f0fdf4',
}

type FormState = {
  name: string
  description: string
  campusLocation: string
  deliveryTimeMinutes: string
  minimumOrderAmount: string
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  campusLocation: '',
  deliveryTimeMinutes: '30',
  minimumOrderAmount: '0',
}

function formFromStore(store: SellerStore): FormState {
  return {
    name: store.name,
    description: store.description ?? '',
    campusLocation: store.campusLocation ?? '',
    deliveryTimeMinutes: String(store.deliveryTimeMinutes),
    minimumOrderAmount: String(store.minimumOrderAmount),
  }
}

export default function StoreInformationScreen() {
  const router = useRouter()
  const { session, refreshSession } = useSellerSession()
  const [store, setStore] = useState<SellerStore | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const accessToken = session?.accessToken ?? null

  const withFreshToken = useCallback(
    async <T,>(operation: (token: string) => Promise<T>): Promise<T> => {
      if (!accessToken) throw new Error('Seller session is unavailable.')

      try {
        return await operation(accessToken)
      } catch (requestError) {
        if (!isSellerStoreAuthError(requestError)) throw requestError

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
    setError(null)

    try {
      const dashboard = await withFreshToken((token) => sellerStoreApi.dashboard(token))
      setStore(dashboard.store)
      setForm(formFromStore(dashboard.store))
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load store information.',
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

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((current) => ({ ...current, [key]: value }))
      setSuccess(null)
    },
    [],
  )

  const save = useCallback(async () => {
    if (saving) return

    const name = form.name.trim()
    const description = form.description.trim()
    const campusLocation = form.campusLocation.trim()
    const deliveryTimeMinutes = Number(form.deliveryTimeMinutes)
    const minimumOrderAmount = Number(form.minimumOrderAmount)

    if (name.length < 2) {
      Alert.alert('Store name required', 'Enter a store name with at least 2 characters.')
      return
    }

    if (!Number.isInteger(deliveryTimeMinutes) || deliveryTimeMinutes < 1 || deliveryTimeMinutes > 240) {
      Alert.alert('Delivery time invalid', 'Delivery time must be between 1 and 240 minutes.')
      return
    }

    if (!Number.isFinite(minimumOrderAmount) || minimumOrderAmount < 0) {
      Alert.alert('Minimum order invalid', 'Minimum order amount cannot be negative.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const updated = await withFreshToken((token) =>
        sellerStoreApi.updateStoreInformation(token, {
          name,
          description,
          campusLocation,
          deliveryTimeMinutes,
          minimumOrderAmount,
        }),
      )

      setStore(updated)
      setForm(formFromStore(updated))
      setSuccess('Store information updated.')
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to update store information.',
      )
    } finally {
      setSaving(false)
    }
  }, [form, saving, withFreshToken])

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
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
          <Text style={styles.title}>Store information</Text>
          <Text style={styles.subtitle}>Manage what customers see about your store</Text>
        </View>
      </View>

      {loading && !store ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.loadingText}>Loading store information…</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color="#b91c1c" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {success ? (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle-outline" size={18} color={C.success} />
                <Text style={styles.successText}>{success}</Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Public store details</Text>
              <Text style={styles.sectionHint}>
                These details may be shown to customers in Campus Angadi.
              </Text>

              <Text style={styles.label}>Store name</Text>
              <TextInput
                value={form.name}
                onChangeText={(value) => updateField('name', value)}
                placeholder="Store name"
                placeholderTextColor={C.subtle}
                style={styles.input}
                maxLength={80}
                autoCapitalize="words"
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                value={form.description}
                onChangeText={(value) => updateField('description', value)}
                placeholder="Tell customers about your store"
                placeholderTextColor={C.subtle}
                style={[styles.input, styles.multiline]}
                multiline
                textAlignVertical="top"
                maxLength={1000}
              />

              <Text style={styles.label}>Campus location</Text>
              <TextInput
                value={form.campusLocation}
                onChangeText={(value) => updateField('campusLocation', value)}
                placeholder="Example: Near Main Canteen"
                placeholderTextColor={C.subtle}
                style={styles.input}
                maxLength={120}
              />

              <View style={styles.twoColumns}>
                <View style={styles.column}>
                  <Text style={styles.label}>Delivery time</Text>
                  <View style={styles.suffixInput}>
                    <TextInput
                      value={form.deliveryTimeMinutes}
                      onChangeText={(value) => updateField('deliveryTimeMinutes', value)}
                      placeholder="30"
                      placeholderTextColor={C.subtle}
                      keyboardType="number-pad"
                      style={styles.suffixTextInput}
                      maxLength={3}
                    />
                    <Text style={styles.suffix}>min</Text>
                  </View>
                </View>

                <View style={styles.column}>
                  <Text style={styles.label}>Minimum order</Text>
                  <View style={styles.suffixInput}>
                    <Text style={styles.prefix}>₹</Text>
                    <TextInput
                      value={form.minimumOrderAmount}
                      onChangeText={(value) => updateField('minimumOrderAmount', value)}
                      placeholder="0"
                      placeholderTextColor={C.subtle}
                      keyboardType="decimal-pad"
                      style={styles.suffixTextInput}
                      maxLength={8}
                    />
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.lockedCard}>
              <View style={styles.lockedTop}>
                <View style={styles.lockIcon}>
                  <Ionicons name="lock-closed-outline" size={20} color={C.accentDark} />
                </View>
                <View style={styles.lockedCopy}>
                  <Text style={styles.lockedTitle}>Platform commission</Text>
                  <Text style={styles.lockedDescription}>
                    Commission is controlled by Campus Angadi administrators and cannot be edited by sellers.
                  </Text>
                </View>
              </View>

              <View style={styles.commissionRow}>
                <Text style={styles.commissionLabel}>Current commission</Text>
                <Text style={styles.commissionValue}>
                  {store ? `${store.commissionPercent}%` : '—'}
                </Text>
              </View>
            </View>

            <View style={styles.noteCard}>
              <Ionicons name="information-circle-outline" size={20} color={C.muted} />
              <Text style={styles.noteText}>
                Store status, seller assignment, slug and commission remain administrator-controlled.
              </Text>
            </View>

            <Pressable
              disabled={saving || loading}
              onPress={() => void save()}
              style={({ pressed }) => [
                styles.saveButton,
                (pressed || saving || loading) && styles.saveButtonPressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#18181b" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={19} color="#18181b" />
                  <Text style={styles.saveText}>Save changes</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: C.bg },
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
  headerCopy: { flex: 1, marginLeft: 13 },
  title: { color: C.text, fontSize: 22, fontWeight: '900' },
  subtitle: { marginTop: 2, color: C.muted, fontSize: 11, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  loadingText: { marginTop: 12, color: C.muted, fontWeight: '600' },
  content: { padding: 16, paddingBottom: 36 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 13,
    backgroundColor: '#fef2f2',
  },
  errorText: { flex: 1, color: '#b91c1c', fontSize: 12, fontWeight: '700' },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 13,
    backgroundColor: C.successBg,
  },
  successText: { flex: 1, color: C.success, fontSize: 12, fontWeight: '700' },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 19,
    backgroundColor: C.surface,
  },
  sectionTitle: { color: C.text, fontSize: 17, fontWeight: '900' },
  sectionHint: { marginTop: 4, marginBottom: 7, color: C.muted, fontSize: 11, lineHeight: 16 },
  label: { marginTop: 14, marginBottom: 7, color: C.text, fontSize: 12, fontWeight: '800' },
  input: {
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 13,
    backgroundColor: '#fafafa',
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
  },
  multiline: { minHeight: 110 },
  twoColumns: { flexDirection: 'row', gap: 10 },
  column: { flex: 1 },
  suffixInput: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 13,
    backgroundColor: '#fafafa',
  },
  suffixTextInput: { flex: 1, color: C.text, fontSize: 14, fontWeight: '700', paddingVertical: 10 },
  suffix: { marginLeft: 4, color: C.muted, fontSize: 11, fontWeight: '700' },
  prefix: { marginRight: 4, color: C.text, fontSize: 14, fontWeight: '800' },
  lockedCard: {
    marginTop: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 19,
    backgroundColor: '#fffbeb',
  },
  lockedTop: { flexDirection: 'row', alignItems: 'flex-start' },
  lockIcon: {
    width: 39,
    height: 39,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#fef3c7',
  },
  lockedCopy: { flex: 1, marginLeft: 11 },
  lockedTitle: { color: C.text, fontSize: 14, fontWeight: '900' },
  lockedDescription: { marginTop: 3, color: C.muted, fontSize: 10, lineHeight: 15, fontWeight: '600' },
  commissionRow: {
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#fde68a',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commissionLabel: { color: C.muted, fontSize: 12, fontWeight: '700' },
  commissionValue: { color: C.accentDark, fontSize: 18, fontWeight: '900' },
  noteCard: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 13,
    borderRadius: 15,
    backgroundColor: '#f4f4f5',
  },
  noteText: { flex: 1, color: C.muted, fontSize: 10, lineHeight: 16, fontWeight: '600' },
  saveButton: {
    minHeight: 52,
    marginTop: 18,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: C.accent,
  },
  saveButtonPressed: { opacity: 0.65 },
  saveText: { color: '#18181b', fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.65 },
})
