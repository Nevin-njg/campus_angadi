import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { useSellerSession } from '../features/auth/session'
import {
  isSellerOfferAuthError,
  sellerOfferApi,
  type SaveSellerOfferInput,
  type SellerOffer,
  type SellerOfferDiscountType,
} from '../features/offers/offer-api'
import {
  isSellerProductAuthError,
  sellerProductApi,
  type SellerProduct,
} from '../features/products/product-api'

const C = {
  text: '#18181b',
  muted: '#71717a',
  border: '#e4e4e7',
  bg: '#fafafa',
  surface: '#ffffff',
  accent: '#f59e0b',
}

type EditorState =
  | { mode: 'CREATE'; offer: null }
  | { mode: 'EDIT'; offer: SellerOffer }

const money = (value: number) => `₹${value.toFixed(2)}`
const pad = (value: number) => String(value).padStart(2, '0')
const localDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const localTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`

function parseLocal(date: string, time: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim())
  const clock = /^(\d{2}):(\d{2})$/.exec(time.trim())
  if (!match || !clock) return null

  const parsed = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(clock[1]),
    Number(clock[2]),
  )

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function when(value: string) {
  const date = new Date(value)
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function OffersScreen() {
  const router = useRouter()
  const { session, refreshSession } = useSellerSession()
  const [offers, setOffers] = useState<SellerOffer[]>([])
  const [products, setProducts] = useState<SellerProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const accessToken = session?.accessToken ?? null

  const withFreshToken = useCallback(
    async <T,>(operation: (token: string) => Promise<T>): Promise<T> => {
      if (!accessToken) throw new Error('Seller session is unavailable.')

      try {
        return await operation(accessToken)
      } catch (requestError) {
        if (
          !isSellerOfferAuthError(requestError) &&
          !isSellerProductAuthError(requestError)
        ) {
          throw requestError
        }

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
        const [nextOffers, nextProducts] = await Promise.all([
          withFreshToken((token) => sellerOfferApi.list(token)),
          withFreshToken((token) => sellerProductApi.list(token)),
        ])
        setOffers(nextOffers)
        setProducts(nextProducts)
      } catch (requestError) {
        setError(
          requestError instanceof Error ? requestError.message : 'Unable to load offers.',
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

  const currentProductIds = useMemo(
    () => new Set(offers.filter((offer) => offer.isCurrent).map((offer) => offer.productId)),
    [offers],
  )

  const availableProducts = useMemo(
    () => products.filter((product) => !currentProductIds.has(product.id)),
    [currentProductIds, products],
  )

  const saveOffer = async (value: SaveSellerOfferInput) => {
    if (!editor) return
    setSaving(true)

    try {
      if (editor.mode === 'CREATE') {
        await withFreshToken((token) => sellerOfferApi.create(token, value))
      } else {
        await withFreshToken((token) =>
          sellerOfferApi.update(token, editor.offer.id, {
            discountType: value.discountType,
            discountValue: value.discountValue,
            startsAt: value.startsAt,
            endsAt: value.endsAt,
          }),
        )
      }

      setEditor(null)
      await load()
    } catch (requestError) {
      Alert.alert(
        editor.mode === 'CREATE' ? 'Unable to create offer' : 'Unable to save offer',
        requestError instanceof Error ? requestError.message : 'Please try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  const deleteOffer = (offer: SellerOffer) => {
    Alert.alert(
      'Delete offer?',
      offer.status === 'ACTIVE'
        ? 'The regular price will be restored immediately.'
        : 'This offer will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId(offer.id)
              try {
                await withFreshToken((token) => sellerOfferApi.remove(token, offer.id))
                await load()
              } catch (requestError) {
                Alert.alert(
                  'Unable to delete offer',
                  requestError instanceof Error ? requestError.message : 'Please try again.',
                )
              } finally {
                setBusyId(null)
              }
            })()
          },
        },
      ],
    )
  }

  const current = offers.filter((offer) => offer.isCurrent)
  const history = offers.filter((offer) => !offer.isCurrent)

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Offers</Text>
          <Text style={styles.subtitle}>Discount individual store products</Text>
        </View>
        <Pressable
          disabled={!availableProducts.length}
          onPress={() => setEditor({ mode: 'CREATE', offer: null })}
          style={[styles.primaryButton, !availableProducts.length && styles.disabled]}
        >
          <Ionicons name="add" size={19} color="#fff" />
          <Text style={styles.primaryText}>Add</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
        }
      >
        <View style={styles.info}>
          <Ionicons name="sparkles-outline" size={19} color="#92400e" />
          <Text style={styles.infoText}>
            One current offer per product. Scheduled offers start and end automatically.
          </Text>
        </View>

        {loading && !offers.length ? (
          <State icon="time-outline" text="Loading offers…" loading />
        ) : null}

        {error && !offers.length ? (
          <State icon="cloud-offline-outline" title="Couldn't load offers" text={error} />
        ) : null}

        {!loading && !error && !offers.length ? (
          <State
            icon="ticket-outline"
            title="No offers yet"
            text="Create a discount for one of your products."
          />
        ) : null}

        {current.length ? <Text style={styles.sectionTitle}>Current</Text> : null}
        {current.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            busy={busyId === offer.id}
            onEdit={() => setEditor({ mode: 'EDIT', offer })}
            onDelete={() => deleteOffer(offer)}
          />
        ))}

        {history.length ? <Text style={styles.sectionTitle}>History</Text> : null}
        {history.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            busy={busyId === offer.id}
            onDelete={() => deleteOffer(offer)}
          />
        ))}
      </ScrollView>

      <OfferEditor
        editor={editor}
        products={products}
        availableProducts={availableProducts}
        saving={saving}
        onClose={() => !saving && setEditor(null)}
        onSave={(value) => void saveOffer(value)}
      />
    </SafeAreaView>
  )
}

function State({
  icon,
  title,
  text,
  loading = false,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title?: string
  text: string
  loading?: boolean
}) {
  return (
    <View style={styles.state}>
      {loading ? (
        <ActivityIndicator size="large" color={C.accent} />
      ) : (
        <Ionicons name={icon} size={31} color={C.muted} />
      )}
      {title ? <Text style={styles.stateTitle}>{title}</Text> : null}
      <Text style={styles.stateText}>{text}</Text>
    </View>
  )
}

function OfferCard({
  offer,
  busy,
  onEdit,
  onDelete,
}: {
  offer: SellerOffer
  busy: boolean
  onEdit?: () => void
  onDelete: () => void
}) {
  const label =
    offer.status === 'ACTIVE'
      ? 'Active'
      : offer.status === 'SCHEDULED'
        ? 'Scheduled'
        : 'Expired'

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        {offer.productImage ? (
          <Image source={{ uri: offer.productImage }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={24} color="#a1a1aa" />
          </View>
        )}

        <View style={styles.cardCopy}>
          <View style={styles.row}>
            <Text style={styles.productTitle} numberOfLines={2}>
              {offer.productTitle}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{label}</Text>
            </View>
          </View>
          <View style={styles.rowLeft}>
            <Text style={styles.offerPrice}>{money(offer.discountedPrice)}</Text>
            <Text style={styles.oldPrice}>{money(offer.basePrice)}</Text>
          </View>
          <Text style={styles.discountText}>
            {offer.discountType === 'PERCENTAGE'
              ? `${offer.discountValue}% off`
              : `${money(offer.discountValue)} off`}
          </Text>
        </View>
      </View>

      <View style={styles.schedule}>
        <Text style={styles.scheduleText}>Starts {when(offer.startsAt)}</Text>
        <Text style={styles.scheduleText}>Ends {when(offer.endsAt)}</Text>
      </View>

      <View style={styles.actions}>
        {onEdit ? (
          <Pressable onPress={onEdit} disabled={busy} style={styles.secondaryButton}>
            <Ionicons name="create-outline" size={16} color={C.text} />
            <Text style={styles.secondaryText}>Edit</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onDelete} disabled={busy} style={styles.deleteButton}>
          {busy ? (
            <ActivityIndicator size="small" color="#b91c1c" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={16} color="#b91c1c" />
              <Text style={styles.deleteText}>Delete</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  )
}

function OfferEditor({
  editor,
  products,
  availableProducts,
  saving,
  onClose,
  onSave,
}: {
  editor: EditorState | null
  products: SellerProduct[]
  availableProducts: SellerProduct[]
  saving: boolean
  onClose: () => void
  onSave: (value: SaveSellerOfferInput) => void
}) {
  const [productId, setProductId] = useState('')
  const [discountType, setDiscountType] =
    useState<SellerOfferDiscountType>('PERCENTAGE')
  const [discountValue, setDiscountValue] = useState('')
  const [startMode, setStartMode] = useState<'NOW' | 'LATER'>('NOW')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')

  useEffect(() => {
    if (!editor) return

    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    if (editor.mode === 'EDIT') {
      const start = new Date(editor.offer.startsAt)
      const end = new Date(editor.offer.endsAt)
      setProductId(editor.offer.productId)
      setDiscountType(editor.offer.discountType)
      setDiscountValue(String(editor.offer.discountValue))
      setStartMode(editor.offer.status === 'ACTIVE' ? 'NOW' : 'LATER')
      setStartDate(localDate(start))
      setStartTime(localTime(start))
      setEndDate(localDate(end))
      setEndTime(localTime(end))
    } else {
      setProductId(availableProducts[0]?.id ?? '')
      setDiscountType('PERCENTAGE')
      setDiscountValue('')
      setStartMode('NOW')
      setStartDate(localDate(now))
      setStartTime(localTime(now))
      setEndDate(localDate(tomorrow))
      setEndTime(localTime(tomorrow))
    }
  }, [availableProducts, editor])

  const product = products.find((item) => item.id === productId)
  const basePrice =
    editor?.mode === 'EDIT'
      ? editor.offer.basePrice
      : product?.currentOffer?.basePrice ??
        product?.originalPrice ??
        product?.price ??
        0

  const discount = Number(discountValue)
  const preview = useMemo(() => {
    if (!Number.isFinite(discount) || discount <= 0 || basePrice <= 0) return null
    if (discountType === 'PERCENTAGE') {
      if (discount > 90) return null
      return Math.round(basePrice * (1 - discount / 100) * 100) / 100
    }
    if (discount >= basePrice) return null
    return Math.round((basePrice - discount) * 100) / 100
  }, [basePrice, discount, discountType])

  const submit = () => {
    if (!productId) {
      Alert.alert('Product required', 'Choose a product.')
      return
    }
    if (!Number.isFinite(discount) || discount <= 0) {
      Alert.alert('Invalid discount', 'Enter a discount greater than zero.')
      return
    }
    if (discountType === 'PERCENTAGE' && discount > 90) {
      Alert.alert('Invalid discount', 'Percentage discount cannot exceed 90%.')
      return
    }
    if (discountType === 'FLAT' && discount >= basePrice) {
      Alert.alert('Invalid discount', 'Flat discount must be lower than the regular price.')
      return
    }

    let startsAt: Date
    if (startMode === 'NOW') {
      startsAt =
        editor?.mode === 'EDIT' ? new Date(editor.offer.startsAt) : new Date()
    } else {
      const parsed = parseLocal(startDate, startTime)
      if (!parsed) {
        Alert.alert('Invalid start', 'Use YYYY-MM-DD and HH:MM.')
        return
      }
      startsAt = parsed
    }

    const endsAt = parseLocal(endDate, endTime)
    if (!endsAt) {
      Alert.alert('Invalid end', 'Use YYYY-MM-DD and HH:MM.')
      return
    }
    if (endsAt <= startsAt || endsAt <= new Date()) {
      Alert.alert('Invalid schedule', 'End time must be after start and in the future.')
      return
    }

    onSave({
      productId,
      discountType,
      discountValue: discount,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    })
  }

  return (
    <Modal
      visible={Boolean(editor)}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={saving ? undefined : onClose}
    >
      <SafeAreaView style={styles.editorScreen}>
        <View style={styles.header}>
          <Pressable onPress={onClose} disabled={saving} style={styles.iconButton}>
            <Ionicons name="close" size={22} color={C.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.editorTitle}>
              {editor?.mode === 'EDIT' ? 'Edit offer' : 'Create offer'}
            </Text>
          </View>
          <View style={{ width: 42 }} />
        </View>

        <ScrollView contentContainerStyle={styles.editorContent}>
          <Text style={styles.label}>Product</Text>
          {editor?.mode === 'EDIT' ? (
            <View style={styles.locked}>
              <Text style={styles.lockedText}>{editor.offer.productTitle}</Text>
              <Ionicons name="lock-closed-outline" size={16} color={C.muted} />
            </View>
          ) : (
            <View style={styles.choiceList}>
              {availableProducts.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setProductId(item.id)}
                  style={[
                    styles.choice,
                    item.id === productId && styles.choiceSelected,
                  ]}
                >
                  <Text style={styles.choiceText} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.choicePrice}>
                    {money(item.originalPrice ?? item.price)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={styles.labelGap}>Discount type</Text>
          <View style={styles.segment}>
            {(['PERCENTAGE', 'FLAT'] as const).map((type) => (
              <Pressable
                key={type}
                onPress={() => setDiscountType(type)}
                style={[
                  styles.segmentButton,
                  discountType === type && styles.segmentSelected,
                ]}
              >
                <Text style={styles.segmentText}>
                  {type === 'PERCENTAGE' ? 'Percentage %' : 'Flat ₹'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.labelGap}>Discount value</Text>
          <TextInput
            value={discountValue}
            onChangeText={setDiscountValue}
            keyboardType="decimal-pad"
            placeholder={discountType === 'PERCENTAGE' ? '10' : '25'}
            placeholderTextColor="#a1a1aa"
            style={styles.input}
          />

          <View style={styles.preview}>
            <Text style={styles.previewText}>Regular {money(basePrice)}</Text>
            <Ionicons name="arrow-forward" size={17} color={C.muted} />
            <Text style={styles.previewPrice}>
              Offer {preview === null ? '—' : money(preview)}
            </Text>
          </View>

          <Text style={styles.labelGap}>Starts</Text>
          <View style={styles.segment}>
            <Pressable
              onPress={() => setStartMode('NOW')}
              style={[styles.segmentButton, startMode === 'NOW' && styles.segmentSelected]}
            >
              <Text style={styles.segmentText}>Now</Text>
            </Pressable>
            <Pressable
              onPress={() => setStartMode('LATER')}
              style={[styles.segmentButton, startMode === 'LATER' && styles.segmentSelected]}
            >
              <Text style={styles.segmentText}>Schedule</Text>
            </Pressable>
          </View>

          {startMode === 'LATER' ? (
            <DateTimeInputs
              date={startDate}
              time={startTime}
              onDate={setStartDate}
              onTime={setStartTime}
            />
          ) : null}

          <Text style={styles.labelGap}>Ends</Text>
          <DateTimeInputs
            date={endDate}
            time={endTime}
            onDate={setEndDate}
            onTime={setEndTime}
          />

          <Text style={styles.hint}>
            Times use this phone's local timezone. Offers start and end automatically.
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable onPress={onClose} disabled={saving} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>
          <Pressable onPress={submit} disabled={saving} style={styles.saveButton}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>
                {editor?.mode === 'EDIT' ? 'Save changes' : 'Create offer'}
              </Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

function DateTimeInputs({
  date,
  time,
  onDate,
  onTime,
}: {
  date: string
  time: string
  onDate: (value: string) => void
  onTime: (value: string) => void
}) {
  return (
    <View style={styles.dateRow}>
      <TextInput
        value={date}
        onChangeText={onDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#a1a1aa"
        style={[styles.input, styles.dateInput]}
      />
      <TextInput
        value={time}
        onChangeText={onTime}
        placeholder="HH:MM"
        placeholderTextColor="#a1a1aa"
        style={[styles.input, styles.timeInput]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  editorScreen: { flex: 1, backgroundColor: C.bg },
  header: {
    minHeight: 76,
    padding: 16,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  title: { color: C.text, fontSize: 22, fontWeight: '900' },
  subtitle: { marginTop: 2, color: C.muted, fontSize: 11 },
  editorTitle: { color: C.text, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  primaryButton: {
    minHeight: 42,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: C.text,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  primaryText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 36 },
  info: {
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  infoText: { flex: 1, color: '#78350f', fontSize: 11, lineHeight: 17 },
  sectionTitle: { marginVertical: 9, color: C.text, fontSize: 13, fontWeight: '900' },
  card: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    borderRadius: 17,
    padding: 13,
    marginBottom: 11,
  },
  cardTop: { flexDirection: 'row', gap: 11 },
  image: { width: 66, height: 66, borderRadius: 13, backgroundColor: '#f4f4f5' },
  imagePlaceholder: {
    width: 66,
    height: 66,
    borderRadius: 13,
    backgroundColor: '#f4f4f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 7 },
  productTitle: { flex: 1, color: C.text, fontSize: 15, fontWeight: '800' },
  badge: { borderRadius: 999, backgroundColor: '#f4f4f5', paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: C.text, fontSize: 9, fontWeight: '800' },
  offerPrice: { color: C.text, fontSize: 17, fontWeight: '900' },
  oldPrice: { color: '#a1a1aa', fontSize: 11, textDecorationLine: 'line-through' },
  discountText: { marginTop: 3, color: '#c2410c', fontSize: 10, fontWeight: '800' },
  schedule: { marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f4f4f5', gap: 4 },
  scheduleText: { color: C.muted, fontSize: 10 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 11 },
  secondaryButton: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  secondaryText: { color: C.text, fontSize: 11, fontWeight: '800' },
  deleteButton: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  deleteText: { color: '#b91c1c', fontSize: 11, fontWeight: '800' },
  state: {
    minHeight: 220,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  stateTitle: { marginTop: 10, color: C.text, fontSize: 16, fontWeight: '800' },
  stateText: { marginTop: 7, color: C.muted, fontSize: 12, textAlign: 'center' },
  editorContent: { padding: 18, paddingBottom: 30 },
  label: { marginBottom: 8, color: C.text, fontSize: 12, fontWeight: '800' },
  labelGap: { marginTop: 18, marginBottom: 8, color: C.text, fontSize: 12, fontWeight: '800' },
  choiceList: { gap: 8 },
  choice: {
    minHeight: 50,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  choiceSelected: { borderColor: '#fbbf24', backgroundColor: '#fffbeb' },
  choiceText: { flex: 1, color: C.text, fontSize: 13, fontWeight: '700' },
  choicePrice: { color: C.muted, fontSize: 11 },
  locked: {
    minHeight: 50,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: '#f4f4f5',
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockedText: { flex: 1, color: C.text, fontSize: 13, fontWeight: '800' },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: C.surface,
  },
  segmentButton: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  segmentSelected: { backgroundColor: '#fffbeb' },
  segmentText: { color: C.text, fontSize: 12, fontWeight: '700' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    color: C.text,
    fontSize: 13,
  },
  preview: {
    marginTop: 13,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewText: { color: C.muted, fontSize: 11 },
  previewPrice: { color: C.text, fontSize: 14, fontWeight: '900' },
  dateRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  dateInput: { flex: 1.5 },
  timeInput: { flex: 1 },
  hint: { marginTop: 12, color: C.muted, fontSize: 10, lineHeight: 15 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.surface,
    flexDirection: 'row',
    gap: 9,
  },
  saveButton: {
    flex: 1.4,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: C.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.38 },
})
