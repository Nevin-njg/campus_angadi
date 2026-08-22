import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import type { StoreCategory } from '../store/store-api'
import type {
  ProductImageAsset,
  SellerProduct,
} from './product-api'

const TEXT = '#18181b'
const MUTED = '#71717a'
const BORDER = '#e4e4e7'
const BACKGROUND = '#fafafa'
const SURFACE = '#ffffff'
const ACCENT = '#f59e0b'

export type ProductEditorValue = {
  title: string
  description: string
  price: number
  categoryId: string
  inStock: boolean
  image: ProductImageAsset | null
}

type Props = {
  visible: boolean
  product: SellerProduct | null
  categories: StoreCategory[]
  saving: boolean
  onClose: () => void
  onSave: (value: ProductEditorValue) => void
}

export function ProductEditorModal({
  visible,
  product,
  categories,
  saving,
  onClose,
  onSave,
}: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [inStock, setInStock] = useState(true)
  const [image, setImage] = useState<ProductImageAsset | null>(null)

  useEffect(() => {
    if (!visible) return

    setTitle(product?.title ?? '')
    setDescription(product?.description ?? '')
    setPrice(
      product
        ? String(
            product.currentOffer?.basePrice ??
              product.originalPrice ??
              product.price,
          )
        : '',
    )
    const currentCategory = categories.find(
      (category) =>
        category.id === product?.storeCategoryId && category.isActive,
    )

    setCategoryId(
      currentCategory?.id ??
        categories.find((category) => category.isActive)?.id ??
        '',
    )
    setInStock(product ? product.stock > 0 : true)
    setImage(null)
  }, [categories, product, visible])

  const previewUri = image?.uri ?? product?.primaryImage ?? null

  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive),
    [categories],
  )

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId) ?? null,
    [categories, categoryId],
  )

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permission.granted) {
      Alert.alert(
        'Photos permission required',
        'Allow photo access to choose a product image.',
      )
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    })

    if (result.canceled || !result.assets[0]) return

    const asset = result.assets[0]

    setImage({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
    })
  }

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync()

    if (!permission.granted) {
      Alert.alert(
        'Camera permission required',
        'Allow camera access to take a product photo.',
      )
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    })

    if (result.canceled || !result.assets[0]) return

    const asset = result.assets[0]

    setImage({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
    })
  }

  const submit = () => {
    const cleanTitle = title.trim()
    const cleanDescription = description.trim()
    const numericPrice = Number(price)

    if (cleanTitle.length < 2) {
      Alert.alert('Product name required', 'Enter a product name.')
      return
    }

    if (cleanDescription.length < 5) {
      Alert.alert(
        'Description required',
        'Add a short product description.',
      )
      return
    }

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      Alert.alert('Invalid price', 'Enter a price greater than zero.')
      return
    }

    if (!categoryId) {
      Alert.alert('Category required', 'Select a product category.')
      return
    }

    onSave({
      title: cleanTitle,
      description: cleanDescription,
      price: numericPrice,
      categoryId,
      inStock,
      image,
    })
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={saving ? undefined : onClose}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            disabled={saving}
            onPress={onClose}
            style={styles.headerButton}
          >
            <Ionicons name="close" size={24} color={TEXT} />
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>
              {product ? 'Edit product' : 'Add product'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {product ? 'Update store listing' : 'Create a new store listing'}
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.imageCard}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.preview} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={34} color={MUTED} />
                <Text style={styles.imagePlaceholderText}>
                  Add a product image
                </Text>
              </View>
            )}

            <View style={styles.imageActions}>
              <Pressable
                disabled={saving}
                onPress={() => void takePhoto()}
                style={({ pressed }) => [
                  styles.imageButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="camera-outline" size={18} color={TEXT} />
                <Text style={styles.imageButtonText}>Camera</Text>
              </Pressable>

              <Pressable
                disabled={saving}
                onPress={() => void pickFromGallery()}
                style={({ pressed }) => [
                  styles.imageButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="images-outline" size={18} color={TEXT} />
                <Text style={styles.imageButtonText}>Gallery</Text>
              </Pressable>
            </View>

            {image ? (
              <Text style={styles.newImageHint}>
                New image selected. It will replace the current primary image.
              </Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Product name</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              editable={!saving}
              placeholder="Example: Chicken biryani"
              placeholderTextColor="#a1a1aa"
              style={styles.input}
              maxLength={120}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              editable={!saving}
              placeholder="Describe the product"
              placeholderTextColor="#a1a1aa"
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.descriptionInput]}
              maxLength={1000}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Price</Text>
            <View style={styles.priceInputWrap}>
              <Text style={styles.currency}>₹</Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                editable={!saving}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#a1a1aa"
                style={styles.priceInput}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>

            {!activeCategories.length ? (
              <View style={styles.notice}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={MUTED}
                />
                <Text style={styles.noticeText}>
                  Create a store category before adding products.
                </Text>
              </View>
            ) : (
              <View style={styles.chips}>
                {activeCategories.map((category) => {
                  const selected = category.id === categoryId

                  return (
                    <Pressable
                      key={category.id}
                      disabled={saving || !category.isActive}
                      onPress={() => setCategoryId(category.id)}
                      style={[
                        styles.chip,
                        selected && styles.chipSelected,
                        !category.isActive && styles.chipDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {category.name}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            )}

            {selectedCategory && !selectedCategory.isActive ? (
              <Text style={styles.warningText}>
                This category is currently inactive.
              </Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Availability</Text>

            <View style={styles.availabilityRow}>
              <Pressable
                disabled={saving}
                onPress={() => setInStock(true)}
                style={[
                  styles.availabilityChoice,
                  inStock && styles.availabilityChoiceSelected,
                ]}
              >
                <View style={[styles.dot, styles.dotGreen]} />
                <View style={styles.availabilityText}>
                  <Text style={styles.availabilityTitle}>In Stock</Text>
                  <Text style={styles.availabilitySubtitle}>
                    Customers can order this product
                  </Text>
                </View>
                {inStock ? (
                  <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
                ) : null}
              </Pressable>

              <Pressable
                disabled={saving}
                onPress={() => setInStock(false)}
                style={[
                  styles.availabilityChoice,
                  !inStock && styles.availabilityChoiceSelected,
                ]}
              >
                <View style={[styles.dot, styles.dotRed]} />
                <View style={styles.availabilityText}>
                  <Text style={styles.availabilityTitle}>Out of Stock</Text>
                  <Text style={styles.availabilitySubtitle}>
                    Keep visible but prevent ordering
                  </Text>
                </View>
                {!inStock ? (
                  <Ionicons name="checkmark-circle" size={22} color="#dc2626" />
                ) : null}
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            disabled={saving}
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>

          <Pressable
            disabled={saving || !activeCategories.length}
            onPress={submit}
            style={({ pressed }) => [
              styles.saveButton,
              (pressed || saving || !activeCategories.length) && styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={19} color="#ffffff" />
                <Text style={styles.saveText}>
                  {product ? 'Save changes' : 'Add product'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  header: {
    minHeight: 72,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: SURFACE,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    marginTop: 2,
    color: MUTED,
    fontSize: 11,
  },
  headerSpacer: {
    width: 42,
  },
  content: {
    padding: 18,
    paddingBottom: 32,
  },
  imageCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    padding: 12,
    marginBottom: 20,
  },
  preview: {
    width: '100%',
    aspectRatio: 1.45,
    borderRadius: 14,
    backgroundColor: '#f4f4f5',
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 1.45,
    borderRadius: 14,
    backgroundColor: '#f4f4f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    marginTop: 8,
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
  },
  imageActions: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  imageButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  imageButtonText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '700',
  },
  newImageHint: {
    marginTop: 9,
    color: MUTED,
    fontSize: 11,
    lineHeight: 16,
  },
  field: {
    marginBottom: 19,
  },
  label: {
    marginBottom: 8,
    color: TEXT,
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 13,
    backgroundColor: SURFACE,
    paddingHorizontal: 14,
    color: TEXT,
    fontSize: 15,
  },
  descriptionInput: {
    minHeight: 110,
    paddingTop: 13,
    paddingBottom: 13,
  },
  priceInputWrap: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 13,
    backgroundColor: SURFACE,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  currency: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '800',
  },
  priceInput: {
    flex: 1,
    paddingLeft: 7,
    color: TEXT,
    fontSize: 15,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    backgroundColor: SURFACE,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipSelected: {
    borderColor: '#fbbf24',
    backgroundColor: '#fffbeb',
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: '#92400e',
  },
  warningText: {
    marginTop: 8,
    color: '#b45309',
    fontSize: 11,
  },
  notice: {
    flexDirection: 'row',
    gap: 9,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 13,
    backgroundColor: SURFACE,
    padding: 13,
  },
  noticeText: {
    flex: 1,
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
  },
  availabilityRow: {
    gap: 9,
  },
  availabilityChoice: {
    minHeight: 66,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    backgroundColor: SURFACE,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  availabilityChoiceSelected: {
    borderColor: '#d4d4d8',
    backgroundColor: '#fafafa',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  dotGreen: {
    backgroundColor: '#22c55e',
  },
  dotRed: {
    backgroundColor: '#ef4444',
  },
  availabilityText: {
    flex: 1,
  },
  availabilityTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '800',
  },
  availabilitySubtitle: {
    marginTop: 2,
    color: MUTED,
    fontSize: 11,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: SURFACE,
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '800',
  },
  saveButton: {
    flex: 1.5,
    minHeight: 50,
    borderRadius: 13,
    backgroundColor: TEXT,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  saveText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.62,
  },
})
