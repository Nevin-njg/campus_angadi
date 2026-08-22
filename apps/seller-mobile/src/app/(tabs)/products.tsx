import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { useSellerSession } from '../../features/auth/session'
import {
  ProductEditorModal,
  type ProductEditorValue,
} from '../../features/products/product-editor-modal'
import {
  isSellerProductAuthError,
  sellerProductApi,
  type SellerProduct,
} from '../../features/products/product-api'
import {
  isSellerStoreAuthError,
  sellerStoreApi,
  type StoreCategory,
} from '../../features/store/store-api'

type Filter =
  | 'ALL'
  | 'IN_STOCK'
  | 'OUT_OF_STOCK'
  | 'HAS_OFFER'
  | 'NO_OFFER'

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'IN_STOCK', label: 'In Stock' },
  { key: 'OUT_OF_STOCK', label: 'Out of Stock' },
  { key: 'HAS_OFFER', label: 'Has Offer' },
  { key: 'NO_OFFER', label: 'No Offer' },
]

const TEXT = '#18181b'
const MUTED = '#71717a'
const BORDER = '#e4e4e7'
const BACKGROUND = '#fafafa'
const SURFACE = '#ffffff'
const ACCENT = '#f59e0b'

function money(value: number) {
  return `₹${value.toFixed(2)}`
}

function hasOffer(product: SellerProduct) {
  return (
    product.originalPrice !== null &&
    product.originalPrice > 0 &&
    product.originalPrice > product.price
  )
}

export default function ProductsScreen() {
  const { session, refreshSession } = useSellerSession()

  const [products, setProducts] = useState<SellerProduct[]>([])
  const [categories, setCategories] = useState<StoreCategory[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editorVisible, setEditorVisible] = useState(false)
  const [editingProduct, setEditingProduct] = useState<SellerProduct | null>(
    null,
  )
  const [saving, setSaving] = useState(false)
  const [busyProductId, setBusyProductId] = useState<string | null>(null)

  const accessToken = session?.accessToken ?? null

  const withFreshToken = useCallback(
    async <T,>(
      operation: (accessToken: string) => Promise<T>,
      originalToken = accessToken,
    ): Promise<T> => {
      if (!originalToken) throw new Error('Seller session is unavailable.')

      try {
        return await operation(originalToken)
      } catch (requestError) {
        const isAuthError =
          isSellerProductAuthError(requestError) ||
          isSellerStoreAuthError(requestError)

        if (!isAuthError) throw requestError

        const refreshed = await refreshSession(originalToken)
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

        const [nextProducts, dashboard] = await Promise.all([
          withFreshToken((token) => sellerProductApi.list(token)),
          withFreshToken((token) => sellerStoreApi.dashboard(token)),
        ])

        setProducts(nextProducts)
        setCategories(
          [...dashboard.store.categories].sort(
            (left, right) => left.displayOrder - right.displayOrder,
          ),
        )
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load products.',
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

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return products.filter((product) => {
      if (
        normalizedQuery &&
        !`${product.title} ${product.description}`
          .toLowerCase()
          .includes(normalizedQuery)
      ) {
        return false
      }

      if (filter === 'IN_STOCK' && product.stock <= 0) return false
      if (filter === 'OUT_OF_STOCK' && product.stock > 0) return false
      if (filter === 'HAS_OFFER' && !hasOffer(product)) return false
      if (filter === 'NO_OFFER' && hasOffer(product)) return false

      return true
    })
  }, [filter, products, query])

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  const counts = useMemo(
    () => ({
      total: products.length,
      inStock: products.filter((product) => product.stock > 0).length,
      outOfStock: products.filter((product) => product.stock <= 0).length,
    }),
    [products],
  )

  const openCreate = () => {
    if (!categories.length) {
      Alert.alert(
        'Create a category first',
        'Products need a store category. Add a category from More → Categories first.',
      )
      return
    }

    setEditingProduct(null)
    setEditorVisible(true)
  }

  const openEdit = (product: SellerProduct) => {
    setEditingProduct(product)
    setEditorVisible(true)
  }

  const saveProduct = async (value: ProductEditorValue) => {
    setSaving(true)

    try {
      let imageUploadIds: string[] | undefined

      if (value.image) {
        const uploaded = await withFreshToken((token) =>
          sellerProductApi.uploadImage(token, value.image!),
        )
        imageUploadIds = uploaded.map((image) => image.id)
      }

      if (editingProduct) {
        const updated = await withFreshToken((token) =>
          sellerProductApi.update(token, editingProduct.id, {
            title: value.title,
            description: value.description,
            price: value.price,
            storeCategoryId: value.categoryId,
            inStock: value.inStock,
            ...(imageUploadIds ? { imageUploadIds } : {}),
          }),
        )

        setProducts((current) =>
          current.map((product) =>
            product.id === updated.id ? updated : product,
          ),
        )
      } else {
        const created = await withFreshToken((token) =>
          sellerProductApi.create(token, {
            title: value.title,
            description: value.description,
            price: value.price,
            storeCategoryId: value.categoryId,
            inStock: value.inStock,
            imageUploadIds,
          }),
        )

        setProducts((current) => [created, ...current])
      }

      setEditorVisible(false)
      setEditingProduct(null)
    } catch (requestError) {
      Alert.alert(
        editingProduct ? 'Unable to save product' : 'Unable to add product',
        requestError instanceof Error
          ? requestError.message
          : 'Please try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  const toggleAvailability = async (product: SellerProduct) => {
    if (busyProductId) return

    setBusyProductId(product.id)

    try {
      const updated = await withFreshToken((token) =>
        sellerProductApi.update(token, product.id, {
          inStock: product.stock <= 0,
        }),
      )

      setProducts((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      )
    } catch (requestError) {
      Alert.alert(
        'Unable to update availability',
        requestError instanceof Error
          ? requestError.message
          : 'Please try again.',
      )
    } finally {
      setBusyProductId(null)
    }
  }

  const deleteProduct = (product: SellerProduct) => {
    Alert.alert(
      'Delete product?',
      `${product.title} will be removed from your store. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyProductId(product.id)

              try {
                await withFreshToken((token) =>
                  sellerProductApi.remove(token, product.id),
                )

                setProducts((current) =>
                  current.filter((item) => item.id !== product.id),
                )
              } catch (requestError) {
                Alert.alert(
                  'Unable to delete product',
                  requestError instanceof Error
                    ? requestError.message
                    : 'Please try again.',
                )
              } finally {
                setBusyProductId(null)
              }
            })()
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={ACCENT}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Products</Text>
            <Text style={styles.subtitle}>
              Manage your store catalogue and availability
            </Text>
          </View>

          <Pressable
            onPress={openCreate}
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="add" size={21} color="#ffffff" />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{counts.total}</Text>
            <Text style={styles.summaryLabel}>Products</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{counts.inStock}</Text>
            <Text style={styles.summaryLabel}>In Stock</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{counts.outOfStock}</Text>
            <Text style={styles.summaryLabel}>Out</Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={20} color={MUTED} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search products"
            placeholderTextColor="#a1a1aa"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={19} color="#a1a1aa" />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map((item) => {
            const selected = filter === item.key

            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[
                  styles.filterChip,
                  selected && styles.filterChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    selected && styles.filterTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {loading && !products.length ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={styles.stateText}>Loading products…</Text>
          </View>
        ) : null}

        {error && !products.length ? (
          <View style={styles.stateCard}>
            <Ionicons name="cloud-offline-outline" size={32} color={MUTED} />
            <Text style={styles.stateTitle}>Couldn't load products</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable
              onPress={() => void load()}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && !products.length ? (
          <View style={styles.stateCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="cube-outline" size={30} color={MUTED} />
            </View>
            <Text style={styles.stateTitle}>No products yet</Text>
            <Text style={styles.stateText}>
              Add your first product to start selling from this store.
            </Text>
            <Pressable
              onPress={openCreate}
              style={styles.emptyAddButton}
            >
              <Ionicons name="add" size={18} color="#ffffff" />
              <Text style={styles.emptyAddText}>Add product</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && products.length && !visibleProducts.length ? (
          <View style={styles.stateCard}>
            <Ionicons name="funnel-outline" size={30} color={MUTED} />
            <Text style={styles.stateTitle}>No matching products</Text>
            <Text style={styles.stateText}>
              Try changing the search or filter.
            </Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {visibleProducts.map((product) => {
            const category = product.storeCategoryId
              ? categoryById.get(product.storeCategoryId)
              : null
            const inStock = product.stock > 0
            const offer = hasOffer(product)
            const busy = busyProductId === product.id

            return (
              <View key={product.id} style={styles.productCard}>
                <View style={styles.productTop}>
                  {product.primaryImage ? (
                    <Image
                      source={{ uri: product.primaryImage }}
                      style={styles.productImage}
                    />
                  ) : (
                    <View style={styles.productImagePlaceholder}>
                      <Ionicons name="image-outline" size={25} color="#a1a1aa" />
                    </View>
                  )}

                  <View style={styles.productInfo}>
                    <View style={styles.productTitleRow}>
                      <Text style={styles.productTitle} numberOfLines={2}>
                        {product.title}
                      </Text>

                      <View
                        style={[
                          styles.stockPill,
                          inStock ? styles.inStockPill : styles.outStockPill,
                        ]}
                      >
                        <View
                          style={[
                            styles.stockDot,
                            {
                              backgroundColor: inStock
                                ? '#22c55e'
                                : '#ef4444',
                            },
                          ]}
                        />
                        <Text style={styles.stockText}>
                          {inStock ? 'In Stock' : 'Out'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.categoryText}>
                      {category?.name ?? 'Uncategorised'}
                    </Text>

                    <View style={styles.priceRow}>
                      <Text style={styles.price}>{money(product.price)}</Text>
                      {offer && product.originalPrice !== null ? (
                        <>
                          <Text style={styles.originalPrice}>
                            {money(product.originalPrice)}
                          </Text>
                          <View style={styles.offerPill}>
                            <Text style={styles.offerText}>Offer</Text>
                          </View>
                        </>
                      ) : null}
                    </View>
                  </View>
                </View>

                <Text style={styles.description} numberOfLines={2}>
                  {product.description}
                </Text>

                <View style={styles.actions}>
                  <Pressable
                    disabled={busy}
                    onPress={() => void toggleAvailability(product)}
                    style={({ pressed }) => [
                      styles.actionButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={TEXT} />
                    ) : (
                      <>
                        <Ionicons
                          name={
                            inStock
                              ? 'close-circle-outline'
                              : 'checkmark-circle-outline'
                          }
                          size={17}
                          color={TEXT}
                        />
                        <Text style={styles.actionText}>
                          {inStock ? 'Mark Out' : 'Mark In'}
                        </Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    disabled={busy}
                    onPress={() => openEdit(product)}
                    style={({ pressed }) => [
                      styles.actionButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons name="create-outline" size={17} color={TEXT} />
                    <Text style={styles.actionText}>Edit</Text>
                  </Pressable>

                  <Pressable
                    disabled={busy}
                    onPress={() => deleteProduct(product)}
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons name="trash-outline" size={18} color="#b91c1c" />
                  </Pressable>
                </View>
              </View>
            )
          })}
        </View>
      </ScrollView>

      <ProductEditorModal
        visible={editorVisible}
        product={editingProduct}
        categories={categories}
        saving={saving}
        onClose={() => {
          if (saving) return
          setEditorVisible(false)
          setEditingProduct(null)
        }}
        onSave={(value) => void saveProduct(value)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  container: {
    padding: 18,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: TEXT,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 4,
    color: MUTED,
    fontSize: 13,
    lineHeight: 18,
  },
  addButton: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 13,
    backgroundColor: TEXT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    minHeight: 72,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 15,
    backgroundColor: SURFACE,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  summaryValue: {
    color: TEXT,
    fontSize: 21,
    fontWeight: '900',
  },
  summaryLabel: {
    marginTop: 2,
    color: MUTED,
    fontSize: 11,
    fontWeight: '600',
  },
  searchWrap: {
    minHeight: 48,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    backgroundColor: SURFACE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  searchInput: {
    flex: 1,
    color: TEXT,
    fontSize: 14,
  },
  filters: {
    gap: 8,
    paddingVertical: 12,
  },
  filterChip: {
    minHeight: 36,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipSelected: {
    borderColor: '#fbbf24',
    backgroundColor: '#fffbeb',
  },
  filterText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  filterTextSelected: {
    color: '#92400e',
  },
  list: {
    gap: 12,
  },
  productCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    backgroundColor: SURFACE,
    padding: 13,
  },
  productTop: {
    flexDirection: 'row',
    gap: 12,
  },
  productImage: {
    width: 84,
    height: 84,
    borderRadius: 14,
    backgroundColor: '#f4f4f5',
  },
  productImagePlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 14,
    backgroundColor: '#f4f4f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
  },
  productTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  productTitle: {
    flex: 1,
    color: TEXT,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  stockPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  inStockPill: {
    backgroundColor: '#f0fdf4',
  },
  outStockPill: {
    backgroundColor: '#fef2f2',
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  stockText: {
    color: TEXT,
    fontSize: 10,
    fontWeight: '800',
  },
  categoryText: {
    marginTop: 6,
    color: MUTED,
    fontSize: 12,
  },
  priceRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  price: {
    color: TEXT,
    fontSize: 17,
    fontWeight: '900',
  },
  originalPrice: {
    color: '#a1a1aa',
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  offerPill: {
    borderRadius: 999,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  offerText: {
    color: '#c2410c',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  description: {
    marginTop: 11,
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    marginTop: 13,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f4f4f5',
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 11,
    backgroundColor: '#fafafa',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionText: {
    color: TEXT,
    fontSize: 11,
    fontWeight: '800',
  },
  deleteButton: {
    width: 44,
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 11,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateCard: {
    minHeight: 230,
    marginTop: 4,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#f4f4f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    marginTop: 11,
    color: TEXT,
    fontSize: 16,
    fontWeight: '800',
  },
  stateText: {
    marginTop: 7,
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 15,
    minHeight: 41,
    paddingHorizontal: 16,
    borderRadius: 11,
    backgroundColor: TEXT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyAddButton: {
    marginTop: 16,
    minHeight: 42,
    borderRadius: 11,
    paddingHorizontal: 15,
    backgroundColor: TEXT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyAddText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.62,
  },
})
