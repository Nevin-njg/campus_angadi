import {
  Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback,
  useEffect,
  useMemo,
  useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useSellerSession } from '../features/auth/session'
import {
  isSellerProductAuthError,
  sellerProductApi,
  type SellerProduct,
} from '../features/products/product-api'
import {
  isSellerStoreAuthError,
  sellerStoreApi,
  type StoreCategory,
} from '../features/store/store-api'

const TEXT = '#18181b'
const MUTED = '#71717a'
const BORDER = '#e4e4e7'
const BACKGROUND = '#fafafa'
const SURFACE = '#ffffff'
const ACCENT = '#f59e0b'

type EditorState =
  | { mode: 'CREATE'; category: null }
  | { mode: 'EDIT'; category: StoreCategory }

export default function CategoriesScreen() {
  const router = useRouter()
  const { session, refreshSession } = useSellerSession()

  const [categories, setCategories] = useState<StoreCategory[]>([])
  const [products, setProducts] = useState<SellerProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [saving, setSaving] = useState(false)

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
          isSellerStoreAuthError(requestError) ||
          isSellerProductAuthError(requestError)

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

        const [dashboard, nextProducts] = await Promise.all([
          withFreshToken((token) => sellerStoreApi.dashboard(token)),
          withFreshToken((token) => sellerProductApi.list(token)),
        ])

        setCategories(
          [...dashboard.store.categories].sort(
            (left, right) => left.displayOrder - right.displayOrder,
          ),
        )
        setProducts(nextProducts)
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load categories.',
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [accessToken, withFreshToken],
  )

  useEffect(() => {
    void load()
  }, [load])

  const productCountByCategory = useMemo(() => {
    const counts = new Map<string, number>()

    for (const product of products) {
      if (!product.storeCategoryId) continue

      counts.set(
        product.storeCategoryId,
        (counts.get(product.storeCategoryId) ?? 0) + 1,
      )
    }

    return counts
  }, [products])

  const saveCategory = async (value: {
    name: string
    description: string
  }) => {
    if (!editor) return

    setSaving(true)

    try {
      const store =
        editor.mode === 'CREATE'
          ? await withFreshToken((token) =>
              sellerStoreApi.createCategory(token, value),
            )
          : await withFreshToken((token) =>
              sellerStoreApi.updateCategory(token, editor.category.id, value),
            )

      setCategories(
        [...store.categories].sort(
          (left, right) => left.displayOrder - right.displayOrder,
        ),
      )
      setEditor(null)
    } catch (requestError) {
      Alert.alert(
        editor.mode === 'CREATE'
          ? 'Unable to add category'
          : 'Unable to save category',
        requestError instanceof Error
          ? requestError.message
          : 'Please try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (category: StoreCategory) => {
    if (busyId) return

    setBusyId(category.id)

    try {
      const store = await withFreshToken((token) =>
        sellerStoreApi.updateCategory(token, category.id, {
          isActive: !category.isActive,
        }),
      )

      setCategories(
        [...store.categories].sort(
          (left, right) => left.displayOrder - right.displayOrder,
        ),
      )
    } catch (requestError) {
      Alert.alert(
        'Unable to update category',
        requestError instanceof Error
          ? requestError.message
          : 'Please try again.',
      )
    } finally {
      setBusyId(null)
    }
  }

  const requestDelete = (category: StoreCategory) => {
    const productCount = productCountByCategory.get(category.id) ?? 0

    if (productCount > 0) {
      Alert.alert(
        'Category is being used',
        `${productCount} product${productCount === 1 ? '' : 's'} ${
          productCount === 1 ? 'is' : 'are'
        } still in ${category.name}. Move or delete those products first.`,
      )
      return
    }

    Alert.alert(
      'Delete category?',
      `${category.name} will be permanently removed from this store.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId(category.id)

              try {
                const store = await withFreshToken((token) =>
                  sellerStoreApi.deleteCategory(token, category.id),
                )

                setCategories(
                  [...store.categories].sort(
                    (left, right) =>
                      left.displayOrder - right.displayOrder,
                  ),
                )
              } catch (requestError) {
                Alert.alert(
                  'Unable to delete category',
                  requestError instanceof Error
                    ? requestError.message
                    : 'Please try again.',
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

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="arrow-back" size={22} color={TEXT} />
        </Pressable>

        <View style={styles.topBarCopy}>
          <Text style={styles.title}>Categories</Text>
          <Text style={styles.subtitle}>
            Organise products in your store
          </Text>
        </View>

        <Pressable
          onPress={() => setEditor({ mode: 'CREATE', category: null })}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="add" size={20} color="#ffffff" />
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={ACCENT}
          />
        }
      >
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color="#92400e" />
          <Text style={styles.infoText}>
            Category order is also used when sellers choose a category for a
            product. A category cannot be deleted while products still use it.
          </Text>
        </View>

        {loading && !categories.length ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={styles.stateText}>Loading categories…</Text>
          </View>
        ) : null}

        {error && !categories.length ? (
          <View style={styles.stateCard}>
            <Ionicons name="cloud-offline-outline" size={32} color={MUTED} />
            <Text style={styles.stateTitle}>Couldn't load categories</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && !categories.length ? (
          <View style={styles.stateCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="pricetags-outline" size={30} color={MUTED} />
            </View>
            <Text style={styles.stateTitle}>No categories yet</Text>
            <Text style={styles.stateText}>
              Create your first category before adding products.
            </Text>
            <Pressable
              onPress={() => setEditor({ mode: 'CREATE', category: null })}
              style={styles.emptyAddButton}
            >
              <Ionicons name="add" size={18} color="#ffffff" />
              <Text style={styles.emptyAddText}>Add category</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.list}>
          {categories.map((category, index) => {
            const productCount = productCountByCategory.get(category.id) ?? 0
            const busy = busyId === category.id

            return (
              <View key={category.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.categoryIcon}>
                    <Ionicons name="pricetag-outline" size={20} color={TEXT} />
                  </View>

                  <View style={styles.cardCopy}>
                    <View style={styles.nameRow}>
                      <Text style={styles.categoryName}>{category.name}</Text>
                      <View
                        style={[
                          styles.statusPill,
                          category.isActive
                            ? styles.activePill
                            : styles.inactivePill,
                        ]}
                      >
                        <Text style={styles.statusText}>
                          {category.isActive ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.categoryMeta}>
                      {productCount} product{productCount === 1 ? '' : 's'}
                    </Text>

                    {category.description ? (
                      <Text style={styles.description} numberOfLines={2}>
                        {category.description}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.actions}>
                  <Pressable
                    disabled={busy}
                    onPress={() =>
                      setEditor({ mode: 'EDIT', category })
                    }
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
                    onPress={() => void toggleActive(category)}
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
                            category.isActive
                              ? 'eye-off-outline'
                              : 'eye-outline'
                          }
                          size={17}
                          color={TEXT}
                        />
                        <Text style={styles.actionText}>
                          {category.isActive ? 'Disable' : 'Enable'}
                        </Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    disabled={busy}
                    onPress={() => requestDelete(category)}
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

      <CategoryEditorModal
        editor={editor}
        saving={saving}
        onClose={() => {
          if (!saving) setEditor(null)
        }}
        onSave={(value) => void saveCategory(value)}
      />
    </SafeAreaView>
  )
}

function CategoryEditorModal({
  editor,
  saving,
  onClose,
  onSave,
}: {
  editor: EditorState | null
  saving: boolean
  onClose: () => void
  onSave: (value: { name: string; description: string }) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!editor) return

    setName(editor.category?.name ?? '')
    setDescription(editor.category?.description ?? '')
  }, [editor])

  const submit = () => {
    const cleanName = name.trim()

    if (cleanName.length < 2) {
      Alert.alert('Category name required', 'Enter at least 2 characters.')
      return
    }

    onSave({
      name: cleanName,
      description: description.trim(),
    })
  }

  return (
    <Modal
      visible={Boolean(editor)}
      transparent
      animationType="fade"
      onRequestClose={saving ? undefined : onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalTitle}>
                {editor?.mode === 'EDIT' ? 'Edit category' : 'Add category'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {editor?.mode === 'EDIT'
                  ? 'Update how this category appears'
                  : 'Create a category for your products'}
              </Text>
            </View>

            <Pressable
              disabled={saving}
              onPress={onClose}
              style={styles.modalClose}
            >
              <Ionicons name="close" size={22} color={TEXT} />
            </Pressable>
          </View>

          <Text style={styles.label}>Category name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            editable={!saving}
            placeholder="Example: Beverages"
            placeholderTextColor="#a1a1aa"
            maxLength={80}
            style={styles.input}
          />

          <Text style={[styles.label, styles.descriptionLabel]}>
            Description
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            editable={!saving}
            placeholder="Optional short description"
            placeholderTextColor="#a1a1aa"
            multiline
            textAlignVertical="top"
            maxLength={300}
            style={[styles.input, styles.descriptionInput]}
          />

          <View style={styles.modalActions}>
            <Pressable
              disabled={saving}
              onPress={onClose}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>

            <Pressable
              disabled={saving}
              onPress={submit}
              style={[styles.saveButton, saving && styles.disabled]}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveText}>
                  {editor?.mode === 'EDIT' ? 'Save changes' : 'Add category'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  topBar: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: SURFACE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCopy: {
    flex: 1,
  },
  title: {
    color: TEXT,
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 2,
    color: MUTED,
    fontSize: 11,
  },
  addButton: {
    minHeight: 42,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: TEXT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  infoCard: {
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 14,
    backgroundColor: '#fffbeb',
    padding: 13,
    flexDirection: 'row',
    gap: 9,
    marginBottom: 14,
  },
  infoText: {
    flex: 1,
    color: '#78350f',
    fontSize: 11,
    lineHeight: 17,
  },
  list: {
    gap: 11,
  },
  card: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 17,
    backgroundColor: SURFACE,
    padding: 13,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 11,
  },
  categoryIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#f4f4f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryName: {
    flex: 1,
    color: TEXT,
    fontSize: 15,
    fontWeight: '800',
  },
  categoryMeta: {
    marginTop: 4,
    color: MUTED,
    fontSize: 11,
    fontWeight: '600',
  },
  description: {
    marginTop: 6,
    color: MUTED,
    fontSize: 11,
    lineHeight: 16,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activePill: {
    backgroundColor: '#f0fdf4',
  },
  inactivePill: {
    backgroundColor: '#f4f4f5',
  },
  statusText: {
    color: TEXT,
    fontSize: 9,
    fontWeight: '800',
  },
  actions: {
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: '#f4f4f5',
    flexDirection: 'row',
    gap: 7,
  },
  actionButton: {
    flex: 1,
    minHeight: 39,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: '#fafafa',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  actionText: {
    color: TEXT,
    fontSize: 10,
    fontWeight: '800',
  },
  deleteButton: {
    width: 42,
    minHeight: 39,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateCard: {
    minHeight: 230,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(24, 24, 27, 0.35)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    borderRadius: 20,
    backgroundColor: SURFACE,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  modalHeaderCopy: {
    flex: 1,
  },
  modalTitle: {
    color: TEXT,
    fontSize: 19,
    fontWeight: '900',
  },
  modalSubtitle: {
    marginTop: 3,
    color: MUTED,
    fontSize: 11,
  },
  modalClose: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginBottom: 7,
    color: TEXT,
    fontSize: 12,
    fontWeight: '800',
  },
  descriptionLabel: {
    marginTop: 14,
  },
  input: {
    minHeight: 49,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: '#fafafa',
    paddingHorizontal: 13,
    color: TEXT,
    fontSize: 14,
  },
  descriptionInput: {
    minHeight: 94,
    paddingTop: 12,
    paddingBottom: 12,
  },
  modalActions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 9,
  },
  cancelButton: {
    flex: 1,
    minHeight: 47,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '800',
  },
  saveButton: {
    flex: 1.4,
    minHeight: 47,
    borderRadius: 12,
    backgroundColor: TEXT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.62,
  },
  disabled: {
    opacity: 0.38,
  },
})
