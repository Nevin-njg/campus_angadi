import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '../../../components/layout/BrandLogo'
import { useConfirmation } from '../../../components/feedback/confirmation-context'
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  EditIcon,
  EyeIcon,
  LayersIcon,
  LogOutIcon,
  PackageIcon,
  RefreshCwIcon,
  SearchIcon,
  ShoppingBagIcon,
  TagIcon,
  TrashIcon,
} from '../../../components/ui/icons'
import { useAuthStore } from '../../auth/store/use-auth-store'
import {
  enablePushNotifications,
  pushNotificationsEnabled,
} from '../../notifications/lib/push-notifications'
import {
  storesApi,
  type CreateSellerProductInput,
  type SellerOrder,
  type SellerOverview,
  type StoreCategory,
  type StoreProduct,
} from '../api/stores.api'

type SellerSection = 'overview' | 'products' | 'categories' | 'orders' | 'offers'

type ProductForm = CreateSellerProductInput & { id?: string }

const emptyProduct: ProductForm = {
  title: '',
  description: '',
  price: 0,
  stock: Number.NaN,
  storeCategoryId: '',
  imageUrl: '',
  published: true,
  tags: [],
}

const money = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value)

const date = (value: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )

const statusLabel = (value: string) => value.replaceAll('_', ' ')

const nextStatuses: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  WAITING_FOR_DEALER_ASSIGNMENT: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  AWAITING_TEAM_CONFIRMATION: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONTACTED: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  PREPARING: ['COMPLETED', 'CANCELLED'],
  DELIVERING_TO_CAMPUS: ['COMPLETED', 'CANCELLED'],
  ARRIVED_AT_CAMPUS: ['COMPLETED', 'CANCELLED'],
  READY_FOR_PICKUP: ['COMPLETED', 'CANCELLED'],
}

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-500/70 focus:ring-4 focus:ring-amber-500/10'
const selectClass = `${fieldClass} appearance-none`

function SellerNavButton({
  active,
  icon,
  label,
  badge,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  badge?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
        active
          ? 'bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/15'
          : 'text-zinc-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-black/10 [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 ? (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
            active ? 'bg-black/15 text-zinc-950' : 'bg-amber-500/15 text-amber-400'
          }`}
        >
          {badge}
        </span>
      ) : null}
    </button>
  )
}

function MetricCard({
  label,
  value,
  note,
  icon,
  warning = false,
}: {
  label: string
  value: string
  note: string
  icon: ReactNode
  warning?: boolean
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-xl shadow-black/10">
      <div
        className={`absolute right-0 top-0 h-24 w-24 rounded-full blur-3xl ${
          warning ? 'bg-red-500/10' : 'bg-amber-500/10'
        }`}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500">{label}</p>
          <strong className="mt-3 block text-2xl font-extrabold tracking-tight text-white">
            {value}
          </strong>
          <span className="mt-2 block text-xs text-zinc-500">{note}</span>
        </div>
        <span
          className={`grid h-11 w-11 place-items-center rounded-xl border [&>svg]:h-5 [&>svg]:w-5 ${
            warning
              ? 'border-red-500/15 bg-red-500/10 text-red-400'
              : 'border-amber-500/15 bg-amber-500/10 text-amber-400'
          }`}
        >
          {icon}
        </span>
      </div>
    </article>
  )
}

function StatusPill({ status }: { status: string }) {
  const style =
    status === 'COMPLETED' || status === 'ACTIVE' || status === 'APPROVED'
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
      : status === 'CANCELLED' || status === 'REJECTED' || status === 'OUT_OF_STOCK'
        ? 'border-red-500/20 bg-red-500/10 text-red-400'
        : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${style}`}>
      {statusLabel(status)}
    </span>
  )
}

function EmptyState({
  title,
  message,
  action,
}: {
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-8 text-center">
      <div>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-zinc-500 [&>svg]:h-6 [&>svg]:w-6">
          <PackageIcon />
        </span>
        <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">{message}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  )
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string
  subtitle: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
      <div className="mx-auto my-4 w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#202020] shadow-2xl shadow-black/50 sm:my-6">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <h2 className="text-xl font-extrabold text-white">{title}</h2>
            <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-zinc-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

export function SellerDashboardPage() {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const confirm = useConfirmation()
  const [section, setSection] = useState<SellerSection>(() => {
    const requestedSection = new URLSearchParams(window.location.search).get('section')

    if (
      requestedSection === 'overview' ||
      requestedSection === 'products' ||
      requestedSection === 'categories' ||
      requestedSection === 'orders' ||
      requestedSection === 'offers'
    ) {
      return requestedSection
    }

    return 'overview'
  })
  const [overview, setOverview] = useState<SellerOverview | null>(null)
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [orders, setOrders] = useState<SellerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushChecking, setPushChecking] = useState(true)
  const [pushBusy, setPushBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [orderStatus, setOrderStatus] = useState('')
  const [productModal, setProductModal] = useState<ProductForm | null>(null)
  const [productImages, setProductImages] = useState<Array<{ file: File; preview: string }>>([])
  const productImagesRef = useRef<Array<{ file: File; preview: string }>>([])
  const [categoryModal, setCategoryModal] = useState(false)
  const [newCategory, setNewCategory] = useState({ name: '', description: '' })
  const [offer, setOffer] = useState({
    scope: 'PRODUCT' as 'PRODUCT' | 'CATEGORY',
    targetId: '',
    discountPercent: 10,
  })

  const categories = useMemo(() => overview?.store.categories ?? [], [overview?.store.categories])

  useEffect(() => {
    productImagesRef.current = productImages
  }, [productImages])

  useEffect(() => {
    let active = true

    void pushNotificationsEnabled()
      .then((enabled) => {
        if (active) setPushEnabled(enabled)
      })
      .catch(() => {
        if (active) setPushEnabled(false)
      })
      .finally(() => {
        if (active) setPushChecking(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    return () => {
      productImagesRef.current.forEach(({ preview }) => URL.revokeObjectURL(preview))
    }
  }, [])

  const notify = (message: string, kind: 'success' | 'error' = 'success') => {
    if (kind === 'success') {
      setSuccess(message)
      setError(null)
    } else {
      setError(message)
      setSuccess(null)
    }
    window.setTimeout(() => {
      setSuccess(null)
      setError(null)
    }, 4000)
  }

  const enableOrderNotifications = async () => {
    setPushBusy(true)

    try {
      await enablePushNotifications()
      setPushEnabled(true)
      notify('Order notifications enabled successfully.')
    } catch (caught) {
      notify(
        caught instanceof Error
          ? caught.message
          : 'Could not enable order notifications.',
        'error',
      )
    } finally {
      setPushBusy(false)
    }
  }

  const loadOverview = useCallback(async () => {
    const value = await storesApi.seller()
    setOverview(value)
    return value
  }, [])

  const loadProducts = useCallback(async (search = '') => {
    setProducts(await storesApi.sellerProducts(search))
  }, [])

  const loadOrders = useCallback(async (status = '') => {
    setOrders(await storesApi.sellerOrders(status))
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([loadOverview(), loadProducts(), loadOrders()])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the seller panel.')
    } finally {
      setLoading(false)
    }
  }, [loadOrders, loadOverview, loadProducts])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadProducts(query).catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : 'Could not search products.'),
      )
    }, 250)
    return () => window.clearTimeout(handle)
  }, [loadProducts, query])

  useEffect(() => {
    void loadOrders(orderStatus).catch((caught: unknown) =>
      setError(caught instanceof Error ? caught.message : 'Could not filter orders.'),
    )
  }, [loadOrders, orderStatus])

  const categoryName = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  )

  const clearSelectedProductImages = () => {
    setProductImages((current) => {
      current.forEach(({ preview }) => URL.revokeObjectURL(preview))
      return []
    })
  }

  const removeSelectedProductImage = (index: number) => {
    setProductImages((current) => {
      const target = current[index]
      if (target) URL.revokeObjectURL(target.preview)
      return current.filter((_, imageIndex) => imageIndex !== index)
    })
  }

  const openNewProduct = () => {
    clearSelectedProductImages()
    setProductModal({ ...emptyProduct, storeCategoryId: categories[0]?.id ?? '' })
  }

  const editProduct = (product: StoreProduct) => {
    clearSelectedProductImages()
    setProductModal({
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      stock: product.stock,
      storeCategoryId: product.storeCategoryId ?? categories[0]?.id ?? '',
      imageUrl: product.primaryImage ?? '',
      published: product.published,
      tags: [],
    })
  }

  const selectProductImages = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!selectedFiles.length) return

    const validFiles: File[] = []

    for (const file of selectedFiles) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        notify('Choose only JPEG, PNG or WebP images.', 'error')
        return
      }
      if (file.size > 5_000_000) {
        notify(`“${file.name}” is larger than 5 MB.`, 'error')
        return
      }
      validFiles.push(file)
    }

    setProductImages((current) => {
      const remainingSlots = 8 - current.length
      if (remainingSlots <= 0) {
        notify('You can upload a maximum of 8 product photos.', 'error')
        return current
      }

      const uniqueFiles = validFiles.filter(
        (file) =>
          !current.some(
            ({ file: existing }) =>
              existing.name === file.name &&
              existing.size === file.size &&
              existing.lastModified === file.lastModified,
          ),
      )

      const acceptedFiles = uniqueFiles.slice(0, remainingSlots)

      if (uniqueFiles.length > remainingSlots) {
        notify('Only the first 8 product photos were selected.', 'error')
      }

      return [
        ...current,
        ...acceptedFiles.map((file) => ({
          file,
          preview: URL.createObjectURL(file),
        })),
      ]
    })
  }

  const saveProduct = async (event: FormEvent) => {
    event.preventDefault()
    if (!productModal) return
    setBusy(true)

    let uploadedImages: Awaited<ReturnType<typeof storesApi.uploadSellerProductImages>> = []

    try {
      if (productImages.length) {
        uploadedImages = await storesApi.uploadSellerProductImages(
          productImages.map(({ file }) => file),
        )
      }

      const primaryUploadedImage = uploadedImages[0]

      const body: CreateSellerProductInput = {
        title: productModal.title.trim(),
        description: productModal.description.trim(),
        price: Number(productModal.price),
        stock: Number(productModal.stock),
        storeCategoryId: productModal.storeCategoryId,
        ...(primaryUploadedImage
          ? {
              imageUploadIds: uploadedImages.map((image) => image.id),
              imageUploadId: primaryUploadedImage.id,
              imageUrl: primaryUploadedImage.url,
            }
          : productModal.imageUrl?.trim()
            ? { imageUrl: productModal.imageUrl.trim() }
            : {}),
        ...(productModal.published !== undefined ? { published: productModal.published } : {}),
        ...(productModal.tags ? { tags: productModal.tags } : {}),
      }

      if (productModal.id) {
        await storesApi.updateSellerProduct(productModal.id, body)
        notify('Product updated successfully.')
      } else {
        await storesApi.createSellerProduct(body)
        notify('Product added to your store.')
      }

      setProductModal(null)
      clearSelectedProductImages()
      await Promise.all([loadProducts(query), loadOverview()])
    } catch (caught) {
      await Promise.allSettled(
        uploadedImages.map((image) => storesApi.removeSellerProductUpload(image.id)),
      )
      notify(caught instanceof Error ? caught.message : 'Could not save the product.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const removeProduct = async (product: StoreProduct) => {
    if (
      !(await confirm({
        title: `Delete “${product.title}”?`,
        description: 'The product will be removed from your public store and cannot be restored.',
        confirmLabel: 'Delete product',
        tone: 'danger',
      }))
    )
      return
    setBusy(true)
    try {
      await storesApi.deleteSellerProduct(product.id)
      notify('Product removed from the store.')
      await Promise.all([loadProducts(query), loadOverview()])
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Could not delete the product.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const saveCategory = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const updated = await storesApi.createSellerCategory(newCategory)
      setOverview((current) => (current ? { ...current, store: updated } : current))
      setNewCategory({ name: '', description: '' })
      setCategoryModal(false)
      notify('Category created successfully.')
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Could not create the category.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const toggleCategory = async (category: StoreCategory) => {
    if (
      category.isActive &&
      !(await confirm({
        title: `Hide ${category.name}?`,
        description: 'Customers will no longer see this category on your public store.',
        confirmLabel: 'Hide category',
      }))
    ) {
      return
    }

    setBusy(true)
    try {
      const updated = await storesApi.updateSellerCategory(category.id, {
        isActive: !category.isActive,
      })
      setOverview((current) => (current ? { ...current, store: updated } : current))
      notify(category.isActive ? 'Category hidden from the store.' : 'Category activated.')
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Could not update the category.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const updateOrder = async (order: SellerOrder, status: string) => {
    if (!status) return
    if (
      !(await confirm({
        title: `Move ${order.orderNumber} to ${statusLabel(status)}?`,
        description: 'This updates the order for both the seller and the customer.',
        confirmLabel: 'Update status',
      }))
    ) {
      return
    }

    setBusy(true)
    try {
      await storesApi.updateSellerOrderStatus(order.id, status)
      notify(`Order moved to ${statusLabel(status).toLowerCase()}.`)
      await Promise.all([loadOrders(orderStatus), loadOverview()])
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Could not update the order.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const applyOffer = async (event: FormEvent) => {
    event.preventDefault()
    if (
      !(await confirm({
        title: offer.discountPercent === 0 ? 'Remove this offer?' : 'Apply this offer?',
        description:
          offer.scope === 'CATEGORY'
            ? 'This price change will apply to every product in the selected category.'
            : 'This price change will be visible to customers immediately.',
        confirmLabel: offer.discountPercent === 0 ? 'Remove offer' : 'Apply offer',
      }))
    ) {
      return
    }

    setBusy(true)
    try {
      const result = await storesApi.applySellerOffer(offer)
      notify(
        offer.discountPercent === 0
          ? `Offer removed from ${result.updatedCount} product(s).`
          : `${offer.discountPercent}% offer applied to ${result.updatedCount} product(s).`,
      )
      await loadProducts(query)
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Could not apply the offer.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="seller-workspace grid min-h-screen place-items-center bg-[#171717] text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-amber-500/20 border-t-amber-500" />
          <p className="mt-4 text-sm text-zinc-500">Preparing your seller workspace…</p>
        </div>
      </div>
    )
  }

  if (!overview) {
    return (
      <div className="seller-workspace grid min-h-screen place-items-center bg-[#171717] p-6 text-white">
        <div className="max-w-md rounded-3xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <AlertTriangleIcon className="mx-auto h-8 w-8 text-red-400" />
          <h1 className="mt-4 text-xl font-bold">Seller panel unavailable</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {error ?? 'No store is assigned to this account.'}
          </p>
          <Link className="button button-primary mt-6" to="/">
            Return to storefront
          </Link>
        </div>
      </div>
    )
  }

  const { store, analytics } = overview
  const sellerName = user?.profile.displayName || user?.profile.fullName || user?.email || 'Seller'

  return (
    <div className="seller-workspace min-h-screen bg-[#171717] text-zinc-100">
      <div className="flex min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-white/10 bg-[#202020] p-4 lg:flex">
          <div className="px-2 py-2">
            <BrandLogo />
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500 text-sm font-black text-zinc-950">
                {store.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <strong className="block truncate text-sm text-white">{store.name}</strong>
                <span className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {store.status === 'ACTIVE' ? 'Store is live' : statusLabel(store.status)}
                </span>
              </div>
            </div>
          </div>

          <p className="mb-2 mt-7 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
            Store workspace
          </p>
          <nav className="space-y-1.5">
            <SellerNavButton
              active={section === 'overview'}
              icon={<ActivityIcon />}
              label="Overview"
              onClick={() => setSection('overview')}
            />
            <SellerNavButton
              active={section === 'products'}
              icon={<PackageIcon />}
              label="Products"
              badge={analytics.lowStockCount}
              onClick={() => setSection('products')}
            />
            <SellerNavButton
              active={section === 'categories'}
              icon={<LayersIcon />}
              label="Categories"
              onClick={() => setSection('categories')}
            />
            <SellerNavButton
              active={section === 'orders'}
              icon={<ShoppingBagIcon />}
              label="Orders"
              badge={analytics.activeOrderCount}
              onClick={() => setSection('orders')}
            />
            <SellerNavButton
              active={section === 'offers'}
              icon={<TagIcon />}
              label="Offers"
              onClick={() => setSection('offers')}
            />
          </nav>

          <div className="mt-auto border-t border-white/10 pt-4">
            <Link
              to={`/stores/${store.slug}`}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              <EyeIcon className="h-4 w-4" />
              View public store
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-zinc-400 transition hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOutIcon className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 lg:ml-72">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-[#171717]/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-400">
                  Seller workspace
                </p>
                <h1 className="mt-1 text-lg font-extrabold capitalize text-white">{section}</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadAll()}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                  aria-label="Refresh seller data"
                >
                  <RefreshCwIcon className="h-4 w-4" />
                </button>
                <div className="hidden items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 sm:flex">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500 text-xs font-black text-zinc-950">
                    {sellerName.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong className="block max-w-32 truncate text-xs text-white">
                      {sellerName}
                    </strong>
                    <span className="block text-[10px] text-zinc-500">Store owner</span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="border-b border-white/10 bg-[#1d1d1d] px-4 py-2 lg:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(
                [
                  ['overview', 'Overview'],
                  ['products', 'Products'],
                  ['categories', 'Categories'],
                  ['orders', 'Orders'],
                  ['offers', 'Offers'],
                ] as Array<[SellerSection, string]>
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSection(value)}
                  className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold ${
                    section === value ? 'bg-amber-500 text-zinc-950' : 'bg-white/5 text-zinc-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
            {error ? (
              <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            ) : null}
            {success ? (
              <div className="mb-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {success}
              </div>
            ) : null}

            {section === 'overview' ? (
              <section>
                <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                  <div>
                    <span className="inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-amber-400">
                      {store.commissionPercent}% platform commission
                    </span>
                    <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                      Welcome back to {store.name}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm text-zinc-500 sm:text-base">
                      Manage your products, process campus orders and keep track of every rupee your
                      store earns.
                    </p>
                  </div>
                  <button type="button" onClick={openNewProduct} className="button button-primary">
                    + Add new product
                  </button>
                </div>

                <div className="mt-7 flex flex-col gap-4 rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-amber-500/[0.04] to-transparent p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
                      <ShoppingBagIcon className="h-5 w-5" />
                    </span>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-white">Order notifications</h3>

                        {pushEnabled ? (
                          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                            Enabled
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 max-w-2xl text-sm text-zinc-500">
                        Get notified immediately when a new official-store order arrives,
                        including when Campus Angadi is running in the background.
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {pushChecking ? (
                      <span className="text-xs font-semibold text-zinc-500">
                        Checking notifications…
                      </span>
                    ) : pushEnabled ? (
                      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                        <CheckCircleIcon className="h-4 w-4" />
                        Notifications enabled
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void enableOrderNotifications()}
                        disabled={pushBusy}
                        className="button button-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {pushBusy ? 'Enabling…' : 'Enable notifications'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label="Gross sales"
                    value={money(analytics.grossSales)}
                    note="Completed orders"
                    icon={<ActivityIcon />}
                  />
                  <MetricCard
                    label="Net earnings"
                    value={money(analytics.netEarnings)}
                    note={`${money(analytics.commissionAmount)} commission deducted`}
                    icon={<CheckCircleIcon />}
                  />
                  <MetricCard
                    label="Active orders"
                    value={String(analytics.activeOrderCount)}
                    note={`${money(analytics.pendingRevenue)} in progress`}
                    icon={<ShoppingBagIcon />}
                  />
                  <MetricCard
                    label="Low stock"
                    value={String(analytics.lowStockCount)}
                    note={`${analytics.productCount} products listed`}
                    icon={<AlertTriangleIcon />}
                    warning={analytics.lowStockCount > 0}
                  />
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
                    <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                      <div>
                        <h3 className="font-bold text-white">Recent orders</h3>
                        <p className="mt-1 text-xs text-zinc-500">Latest activity in your store</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSection('orders')}
                        className="text-xs font-bold text-amber-400 hover:text-amber-300"
                      >
                        View all →
                      </button>
                    </div>
                    {overview.recentOrders.length ? (
                      <div className="divide-y divide-white/5">
                        {overview.recentOrders.map((order) => (
                          <div
                            key={order.id}
                            className="flex flex-col gap-3 px-5 py-4 transition hover:bg-white/[0.025] sm:flex-row sm:items-center"
                          >
                            <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-400 [&>svg]:h-4 [&>svg]:w-4">
                              <ShoppingBagIcon />
                            </span>
                            <div className="min-w-0 flex-1">
                              <strong className="block text-sm text-white">
                                {order.orderNumber}
                              </strong>
                              <span className="mt-1 block truncate text-xs text-zinc-500">
                                {order.fullName} · {order.itemCount} item(s)
                              </span>
                            </div>
                            <StatusPill status={order.status} />
                            <strong className="text-sm text-white">
                              {money(order.totalAmount)}
                            </strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-sm text-zinc-500">No orders have arrived yet.</div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-amber-500/10 to-transparent p-5">
                    <h3 className="text-lg font-bold text-white">Store information</h3>
                    <dl className="mt-4 space-y-4 text-sm">
                      <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                        <dt className="text-zinc-500">Campus location</dt>
                        <dd className="text-right font-semibold text-white">
                          {store.campusLocation || 'Not configured'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                        <dt className="text-zinc-500">Delivery time</dt>
                        <dd className="font-semibold text-white">
                          {store.deliveryTimeMinutes} min
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
                        <dt className="text-zinc-500">Minimum order</dt>
                        <dd className="font-semibold text-white">
                          {money(store.minimumOrderAmount)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-zinc-500">Categories</dt>
                        <dd className="font-semibold text-white">{categories.length}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </section>
            ) : null}

            {section === 'products' ? (
              <section>
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-400">
                      Catalogue
                    </p>
                    <h2 className="mt-2 text-3xl font-extrabold text-white">Products</h2>
                    <p className="mt-2 text-sm text-zinc-500">
                      Add items, update stock and control what customers can see.
                    </p>
                  </div>
                  <button type="button" onClick={openNewProduct} className="button button-primary">
                    + Add product
                  </button>
                </div>

                <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <SearchIcon className="ml-2 h-4 w-4 text-zinc-500" />
                  <input
                    className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-zinc-600"
                    placeholder="Search your products"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  <span className="rounded-lg bg-white/5 px-3 py-2 text-xs font-bold text-zinc-500">
                    {products.length} item(s)
                  </span>
                </div>

                {products.length ? (
                  <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[850px] text-left">
                        <thead className="border-b border-white/10 bg-white/[0.02] text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                          <tr>
                            <th className="px-5 py-4">Product</th>
                            <th className="px-5 py-4">Category</th>
                            <th className="px-5 py-4">Price</th>
                            <th className="px-5 py-4">Stock</th>
                            <th className="px-5 py-4">Visibility</th>
                            <th className="px-5 py-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {products.map((product) => (
                            <tr key={product.id} className="transition hover:bg-white/[0.025]">
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <span className="grid h-12 w-12 overflow-hidden rounded-xl bg-white/5">
                                    {product.primaryImage ? (
                                      <img
                                        src={product.primaryImage}
                                        alt=""
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <PackageIcon className="m-auto h-5 w-5 text-zinc-600" />
                                    )}
                                  </span>
                                  <div className="min-w-0">
                                    <strong className="block max-w-64 truncate text-sm text-white">
                                      {product.title}
                                    </strong>
                                    <span className="mt-1 block text-xs text-zinc-600">
                                      Added{' '}
                                      {new Date(product.createdAt).toLocaleDateString('en-IN')}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-sm text-zinc-400">
                                {categoryName.get(product.storeCategoryId ?? '') ?? 'Uncategorised'}
                              </td>
                              <td className="px-5 py-4">
                                <strong className="text-sm text-white">
                                  {money(product.price)}
                                </strong>
                                {product.originalPrice ? (
                                  <span className="ml-2 text-xs text-zinc-600 line-through">
                                    {money(product.originalPrice)}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-5 py-4">
                                <span
                                  className={`text-sm font-bold ${
                                    product.stock <= 5 ? 'text-red-400' : 'text-zinc-300'
                                  }`}
                                >
                                  {product.stock}
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                <StatusPill
                                  status={product.published ? product.status : 'HIDDEN'}
                                />
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => editProduct(product)}
                                    className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-zinc-400 transition hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400"
                                    aria-label={`Edit ${product.title}`}
                                  >
                                    <EditIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void removeProduct(product)}
                                    className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-zinc-400 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                                    aria-label={`Delete ${product.title}`}
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5">
                    <EmptyState
                      title="No products yet"
                      message="Add the first product to start selling through your campus store."
                      action={
                        <button
                          type="button"
                          onClick={openNewProduct}
                          className="button button-primary"
                        >
                          Add first product
                        </button>
                      }
                    />
                  </div>
                )}
              </section>
            ) : null}

            {section === 'categories' ? (
              <section>
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-400">
                      Store organisation
                    </p>
                    <h2 className="mt-2 text-3xl font-extrabold text-white">Categories</h2>
                    <p className="mt-2 text-sm text-zinc-500">
                      Organise products into sections customers can browse easily.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCategoryModal(true)}
                    className="button button-primary"
                  >
                    + New category
                  </button>
                </div>

                {categories.length ? (
                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {categories.map((category, index) => {
                      const count = products.filter(
                        (product) => product.storeCategoryId === category.id,
                      ).length
                      return (
                        <article
                          key={category.id}
                          className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-white/20"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500/10 text-amber-400 [&>svg]:h-5 [&>svg]:w-5">
                              <LayersIcon />
                            </span>
                            <StatusPill status={category.isActive ? 'ACTIVE' : 'HIDDEN'} />
                          </div>
                          <h3 className="mt-5 text-lg font-bold text-white">{category.name}</h3>
                          <p className="mt-2 min-h-10 text-sm text-zinc-500">
                            {category.description || 'No category description added.'}
                          </p>
                          <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                            <span className="text-xs text-zinc-500">
                              {count} product{count === 1 ? '' : 's'} · Position {index + 1}
                            </span>
                            <button
                              type="button"
                              aria-label={`${category.isActive ? 'Hide' : 'Activate'} ${category.name}`}
                              disabled={busy}
                              onClick={() => void toggleCategory(category)}
                              className="text-xs font-bold text-amber-400 hover:text-amber-300 disabled:opacity-50"
                            >
                              {category.isActive ? 'Hide' : 'Activate'}
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <div className="mt-6">
                    <EmptyState
                      title="Create your first category"
                      message="Categories are required before you can add products to the store."
                      action={
                        <button
                          type="button"
                          onClick={() => setCategoryModal(true)}
                          className="button button-primary"
                        >
                          Create category
                        </button>
                      }
                    />
                  </div>
                )}
              </section>
            ) : null}

            {section === 'orders' ? (
              <section>
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-400">
                      Fulfilment
                    </p>
                    <h2 className="mt-2 text-3xl font-extrabold text-white">Orders</h2>
                    <p className="mt-2 text-sm text-zinc-500">
                      Confirm or reject new orders, then mark fulfilled orders complete.
                    </p>
                  </div>
                  <select
                    aria-label="Filter seller orders by status"
                    className={`${selectClass} max-w-56`}
                    value={orderStatus}
                    onChange={(event) => setOrderStatus(event.target.value)}
                  >
                    <option value="">All order statuses</option>
                    {['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REJECTED'].map(
                      (status) => (
                        <option key={status} value={status}>
                          {statusLabel(status)}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                {orders.length ? (
                  <div className="mt-6 space-y-4">
                    {orders.map((order) => (
                      <article
                        key={order.id}
                        className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]"
                      >
                        <div className="flex flex-col justify-between gap-4 border-b border-white/10 px-5 py-4 md:flex-row md:items-center">
                          <div className="flex items-center gap-3">
                            <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500/10 text-amber-400 [&>svg]:h-5 [&>svg]:w-5">
                              <ShoppingBagIcon />
                            </span>
                            <div>
                              <strong className="text-sm text-white">{order.orderNumber}</strong>
                              <span className="mt-1 block text-xs text-zinc-500">
                                {date(order.createdAt)}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <StatusPill status={order.status} />
                            <strong className="text-base text-white">
                              {money(order.totalAmount)}
                            </strong>
                          </div>
                        </div>
                        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_0.8fr_0.9fr]">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600">
                              Customer
                            </p>
                            <strong className="mt-2 block text-sm text-white">
                              {order.fullName}
                            </strong>
                            <span className="mt-1 block text-sm text-zinc-500">
                              {order.phoneNumber}
                            </span>
                            <span className="mt-1 block text-sm text-zinc-500">
                              Pickup: {order.pickupLocation}
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600">
                              Items
                            </p>
                            <div className="mt-2 space-y-2">
                              {order.items.length ? (
                                order.items.map((item) => (
                                  <div key={item.id} className="flex justify-between gap-3 text-sm">
                                    <span className="truncate text-zinc-400">
                                      {item.quantity}× {item.productName}
                                    </span>
                                    <span className="font-semibold text-white">
                                      {money(item.totalPrice)}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <span className="text-sm text-zinc-500">
                                  {order.itemCount} item(s)
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600">
                              Update status
                            </p>
                            {(nextStatuses[order.status] ?? []).length ? (
                              <div className="mt-2 flex gap-2">
                                <select
                                  id={`status-${order.id}`}
                                  aria-label={`Update status for ${order.orderNumber}`}
                                  className={selectClass}
                                  defaultValue=""
                                >
                                  <option value="" disabled>
                                    Select next step
                                  </option>
                                  {(nextStatuses[order.status] ?? []).map((status) => (
                                    <option key={status} value={status}>
                                      {statusLabel(status)}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  aria-label={`Update ${order.orderNumber}`}
                                  disabled={busy}
                                  onClick={() => {
                                    const input = document.getElementById(
                                      `status-${order.id}`,
                                    ) as HTMLSelectElement | null
                                    void updateOrder(order, input?.value ?? '')
                                  }}
                                  className="button button-primary shrink-0"
                                >
                                  Update
                                </button>
                              </div>
                            ) : (
                              <p className="mt-2 text-sm text-zinc-500">
                                This order has reached its final status.
                              </p>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6">
                    <EmptyState
                      title="No matching orders"
                      message="New official-store orders will appear here as soon as customers check out."
                    />
                  </div>
                )}
              </section>
            ) : null}

            {section === 'offers' ? (
              <section>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-400">
                    Promotions
                  </p>
                  <h2 className="mt-2 text-3xl font-extrabold text-white">Create an offer</h2>
                  <p className="mt-2 max-w-2xl text-sm text-zinc-500">
                    Apply a discount to one product or every product in a category. Enter 0% to
                    remove an existing offer and restore the original price.
                  </p>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                  <form
                    onSubmit={(event) => void applyOffer(event)}
                    className="rounded-2xl border border-white/10 bg-white/[0.035] p-6"
                  >
                    <div className="grid gap-5">
                      <label className="grid gap-2 text-sm font-semibold text-zinc-300">
                        Offer applies to
                        <select
                          className={selectClass}
                          value={offer.scope}
                          onChange={(event) =>
                            setOffer({
                              ...offer,
                              scope: event.target.value as 'PRODUCT' | 'CATEGORY',
                              targetId: '',
                            })
                          }
                        >
                          <option value="PRODUCT">A single product</option>
                          <option value="CATEGORY">An entire category</option>
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm font-semibold text-zinc-300">
                        {offer.scope === 'PRODUCT' ? 'Select product' : 'Select category'}
                        <select
                          required
                          className={selectClass}
                          value={offer.targetId}
                          onChange={(event) => setOffer({ ...offer, targetId: event.target.value })}
                        >
                          <option value="">Choose one</option>
                          {offer.scope === 'PRODUCT'
                            ? products.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.title}
                                </option>
                              ))
                            : categories.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm font-semibold text-zinc-300">
                        Discount percentage
                        <div className="relative">
                          <input
                            required
                            min={0}
                            max={90}
                            type="number"
                            className={`${fieldClass} pr-12`}
                            value={offer.discountPercent}
                            onChange={(event) =>
                              setOffer({ ...offer, discountPercent: Number(event.target.value) })
                            }
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">
                            %
                          </span>
                        </div>
                      </label>
                      <button
                        disabled={busy || !offer.targetId}
                        className="button button-primary mt-2"
                        type="submit"
                      >
                        {busy ? 'Applying…' : 'Apply offer'}
                      </button>
                    </div>
                  </form>

                  <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent p-6">
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-amber-500 text-zinc-950 [&>svg]:h-5 [&>svg]:w-5">
                      <TagIcon />
                    </span>
                    <h3 className="mt-5 text-xl font-bold text-white">Offer preview</h3>
                    <p className="mt-2 text-sm text-zinc-500">
                      Customers will see the original price crossed out and the discounted price on
                      your public store page.
                    </p>
                    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs text-zinc-500">Example original price</span>
                          <strong className="mt-1 block text-lg text-zinc-500 line-through">
                            ₹100.00
                          </strong>
                        </div>
                        <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-zinc-950">
                          {offer.discountPercent}% OFF
                        </span>
                      </div>
                      <strong className="mt-5 block text-3xl font-extrabold text-white">
                        {money(100 * (1 - Math.min(90, Math.max(0, offer.discountPercent)) / 100))}
                      </strong>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </main>
        </div>
      </div>

      {productModal ? (
        <Modal
          title={productModal.id ? 'Edit product' : 'Add new product'}
          subtitle="Products are published directly inside your assigned store."
          onClose={() => {
            setProductModal(null)
            clearSelectedProductImages()
          }}
        >
          <form onSubmit={(event) => void saveProduct(event)} className="grid gap-5 p-6">
            {!categories.length ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-300">
                Create a category before adding products.
              </div>
            ) : null}
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-zinc-300 sm:col-span-2">
                Product name
                <input
                  required
                  minLength={2}
                  className={fieldClass}
                  placeholder="Example: Chicken biryani"
                  value={productModal.title}
                  onChange={(event) =>
                    setProductModal({ ...productModal, title: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-zinc-300 sm:col-span-2">
                Description
                <textarea
                  required
                  minLength={5}
                  rows={3}
                  className={fieldClass}
                  placeholder="Tell customers what they will receive"
                  value={productModal.description}
                  onChange={(event) =>
                    setProductModal({ ...productModal, description: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-zinc-300 sm:col-span-2">
                Category
                <select
                  required
                  className={selectClass}
                  value={productModal.storeCategoryId}
                  onChange={(event) =>
                    setProductModal({ ...productModal, storeCategoryId: event.target.value })
                  }
                >
                  <option value="">Select category</option>
                  {categories
                    .filter((category) => category.isActive)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </label>
              <div className="grid gap-3 text-sm font-semibold text-zinc-300 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <span>Product images</span>
                  <span className="text-[11px] font-normal text-zinc-500">
                    {productImages.length}/8 selected
                  </span>
                </div>

                {productImages.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {productImages.map(({ file, preview }, index) => (
                      <div
                        key={`${file.name}-${file.lastModified}-${index}`}
                        className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black/20"
                      >
                        <img
                          className="h-full w-full object-cover"
                          src={preview}
                          alt={`Product preview ${index + 1}`}
                        />
                        {index === 0 ? (
                          <span className="absolute left-2 top-2 rounded-full bg-amber-500 px-2 py-1 text-[9px] font-black text-zinc-950">
                            PRIMARY
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/75 text-sm text-white transition hover:bg-red-500"
                          onClick={() => removeSelectedProductImage(index)}
                          aria-label={`Remove ${file.name}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : productModal.imageUrl ? (
                  <div className="grid gap-2">
                    <div className="relative aspect-[4/3] max-h-56 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                      <img
                        className="h-full w-full object-contain"
                        src={productModal.imageUrl}
                        alt="Current primary product image"
                      />
                      <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[9px] font-black text-zinc-900">
                        CURRENT IMAGE
                      </span>
                    </div>
                    <span className="text-[11px] font-normal text-zinc-500">
                      Upload new photos only if you want to replace the current product gallery.
                    </span>
                  </div>
                ) : (
                  <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-white/15 bg-black/20">
                    <span className="grid place-items-center gap-2 p-6 text-center">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-2xl text-amber-400">
                        +
                      </span>
                      <strong className="text-sm text-white">Add product photos</strong>
                      <span className="text-xs font-normal text-zinc-500">
                        Up to 8 JPEG, PNG or WebP images · maximum 5 MB each
                      </span>
                    </span>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label
                    className={`group flex items-center justify-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-4 py-3 text-center transition ${
                      productImages.length >= 8
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-pointer hover:border-amber-500/60 hover:bg-amber-500/[0.13]'
                    }`}
                  >
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      disabled={productImages.length >= 8}
                      onChange={selectProductImages}
                    />
                    <span>
                      <strong className="block text-sm text-amber-300">Take photo</strong>
                      <span className="mt-0.5 block text-[11px] font-normal text-zinc-500">
                        Add one photo from the rear camera
                      </span>
                    </span>
                  </label>

                  <label
                    className={`group flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-center transition ${
                      productImages.length >= 8
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-pointer hover:border-white/20 hover:bg-white/[0.06]'
                    }`}
                  >
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      disabled={productImages.length >= 8}
                      onChange={selectProductImages}
                    />
                    <span>
                      <strong className="block text-sm text-white">Upload photos</strong>
                      <span className="mt-0.5 block text-[11px] font-normal text-zinc-500">
                        Choose up to {Math.max(0, 8 - productImages.length)} more
                      </span>
                    </span>
                  </label>
                </div>

                {productImages.length ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.06] px-3 py-2 text-xs">
                    <span className="text-emerald-300">
                      The first photo will be used as the primary image.
                    </span>
                    <button
                      type="button"
                      className="shrink-0 font-bold text-zinc-400 hover:text-white"
                      onClick={clearSelectedProductImages}
                    >
                      Remove all
                    </button>
                  </div>
                ) : null}
              </div>
              <label className="grid gap-2 text-sm font-semibold text-zinc-300">
                Selling price
                <input
                  required
                  min={1}
                  step="0.01"
                  type="number"
                  className={fieldClass}
                  value={productModal.price || ''}
                  onChange={(event) =>
                    setProductModal({ ...productModal, price: Number(event.target.value) })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-zinc-300">
                Available stock
                <input
                  required
                  min={0}
                  step={1}
                  type="number"
                  inputMode="numeric"
                  className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                  value={Number.isFinite(productModal.stock) ? productModal.stock : ''}
                  onChange={(event) =>
                    setProductModal({
                      ...productModal,
                      stock:
                        event.target.value === ''
                          ? Number.NaN
                          : Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 p-4 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={productModal.published}
                onChange={(event) =>
                  setProductModal({ ...productModal, published: event.target.checked })
                }
              />
              Publish this product immediately
            </label>
            <div className="flex justify-end gap-3 border-t border-white/10 pt-5">
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  setProductModal(null)
                  clearSelectedProductImages()
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !categories.length}
                className="button button-primary"
              >
                {busy ? 'Saving…' : productModal.id ? 'Save changes' : 'Add product'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {categoryModal ? (
        <Modal
          title="Create category"
          subtitle="This category will be visible only inside your store."
          onClose={() => setCategoryModal(false)}
        >
          <form onSubmit={(event) => void saveCategory(event)} className="grid gap-5 p-6">
            <label className="grid gap-2 text-sm font-semibold text-zinc-300">
              Category name
              <input
                required
                minLength={2}
                className={fieldClass}
                placeholder="Example: Beverages"
                value={newCategory.name}
                onChange={(event) => setNewCategory({ ...newCategory, name: event.target.value })}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-zinc-300">
              Description
              <textarea
                rows={3}
                className={fieldClass}
                placeholder="Optional short description"
                value={newCategory.description}
                onChange={(event) =>
                  setNewCategory({ ...newCategory, description: event.target.value })
                }
              />
            </label>
            <div className="flex justify-end gap-3 border-t border-white/10 pt-5">
              <button
                type="button"
                className="button button-outline"
                onClick={() => setCategoryModal(false)}
              >
                Cancel
              </button>
              <button type="submit" disabled={busy} className="button button-primary">
                {busy ? 'Creating…' : 'Create category'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
