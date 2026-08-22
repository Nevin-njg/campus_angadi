import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRightIcon,
  CartIcon,
  ClockIcon,
  MapPinIcon,
  PackageIcon,
  SearchIcon,
  ShieldIcon,
  ShoppingBagIcon,
  XIcon,
} from '../../../components/ui/icons'
import { queryKeys } from '../../../lib/query-keys'
import { useAuthStore } from '../../auth/store/use-auth-store'
import { cartApi } from '../../cart/api/cart.api'
import { storesApi, type Store, type StoreProduct } from '../api/stores.api'

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

function categoryName(store: Store, product: StoreProduct) {
  return (
    store.categories.find((category) => category.id === product.storeCategoryId)?.name ??
    'Store product'
  )
}

function StoreProductCard({ product, store }: { product: StoreProduct; store: Store }) {
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [added, setAdded] = useState(false)
  const feedbackTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current)
    },
    [],
  )

  const storeIsOpen = store.availability?.isOpen !== false
  const addToCart = useMutation({
    mutationFn: () => cartApi.add({ productId: product.id, quantity: 1 }),
    onSuccess(cart) {
      if (user) queryClient.setQueryData(queryKeys.cart(user.id), cart)
      setAdded(true)
      if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current)
      feedbackTimer.current = window.setTimeout(() => setAdded(false), 1500)
    },
  })

  const discount =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : null

  function handleAdd() {
    if (!storeIsOpen || product.stock <= 0 || addToCart.isPending) return
    if (!user) {
      void navigate(`/login?returnTo=${encodeURIComponent(`/stores/${store.slug}`)}`)
      return
    }
    addToCart.mutate()
  }

  function handleBuyNow() {
    if (!storeIsOpen || product.stock <= 0) return
    const checkoutPath = `/checkout?buyNow=${encodeURIComponent(product.slug)}&quantity=1`
    if (!user) {
      void navigate(`/login?returnTo=${encodeURIComponent(checkoutPath)}`)
      return
    }
    void navigate(checkoutPath)
  }

  return (
    <article className="public-store-product-card">
      <Link
        className="public-store-product-media"
        to={`/products/${product.slug}`}
        aria-label={`View ${product.title}`}
      >
        {product.primaryImage ? (
          <img src={product.primaryImage} alt={product.title} loading="lazy" />
        ) : (
          <div className="public-store-product-fallback">
            <PackageIcon />
            <span>No image</span>
          </div>
        )}
        <span className="public-store-official-badge">
          <ShieldIcon /> Official
        </span>
        {discount ? <span className="discount-badge">-{discount}%</span> : null}
      </Link>

      <div className="public-store-product-body">
        <span className="catalog-category">{categoryName(store, product)}</span>
        <Link className="public-store-product-title" to={`/products/${product.slug}`}>
          {product.title}
        </Link>
        {product.description ? (
          <p className="public-store-product-description">{product.description}</p>
        ) : null}

        <div className="catalog-price-row">
          <strong>{formatPrice(product.price)}</strong>
          {product.originalPrice ? <del>{formatPrice(product.originalPrice)}</del> : null}
        </div>

        <div className="public-store-stock-row">
          <span className={product.stock > 0 ? 'is-available' : 'is-unavailable'}>
            <i /> {product.stock > 0 ? `${product.stock} available` : 'Out of stock'}
          </span>
        </div>

        <div className="public-store-product-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={handleAdd}
            disabled={!storeIsOpen || product.stock <= 0 || addToCart.isPending}
          >
            <CartIcon />
            {!storeIsOpen
              ? 'Store closed'
              : product.stock <= 0
                ? 'Sold out'
                : added
                ? 'Added'
                : addToCart.isPending
                  ? 'Adding…'
                  : 'Add'}
          </button>
          <button
            type="button"
            className="button button-outline"
            onClick={handleBuyNow}
            disabled={!storeIsOpen || product.stock <= 0}
          >
            {storeIsOpen ? 'Buy now' : 'Store closed'}
          </button>
        </div>

        {addToCart.isError ? (
          <small className="card-action-error" role="alert">
            {addToCart.error.message}
          </small>
        ) : null}
      </div>
    </article>
  )
}

export function StoreBrowsePage() {
  const { slug = '' } = useParams()
  const [store, setStore] = useState<Store | null>(null)
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    void storesApi
      .browse(slug, searchQuery)
      .then((response) => {
        if (!active) return
        setStore(response.store)
        setProducts(response.products)
      })
      .catch((reason: unknown) => {
        if (!active) return
        setError(reason instanceof Error ? reason.message : 'Unable to load this store.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [searchQuery, slug])

  const visibleCategories = useMemo(
    () =>
      (store?.categories ?? [])
        .filter((category) => category.isActive)
        .sort((left, right) => left.displayOrder - right.displayOrder),
    [store],
  )

  const visibleProducts = useMemo(() => {
    if (activeCategory === 'all') return products
    return products.filter((product) => product.storeCategoryId === activeCategory)
  }, [activeCategory, products])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSearchQuery(searchInput.trim())
  }

  function clearSearch() {
    setSearchInput('')
    setSearchQuery('')
  }

  if (loading && !store) {
    return (
      <main className="public-store-page">
        <div className="container public-store-loading">
          <div className="public-store-loading-hero" />
          <div className="public-store-loading-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="public-store-loading-card" key={index} />
            ))}
          </div>
        </div>
      </main>
    )
  }

  if (error || !store) {
    return (
      <main className="public-store-page">
        <div className="container public-store-state-card">
          <ShoppingBagIcon />
          <h1>Store unavailable</h1>
          <p>{error || 'This store could not be found.'}</p>
          <Link className="button button-primary" to="/stores">
            Browse stores
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="public-store-page">
      <section
        className="public-store-hero"
        style={
          store.bannerUrl
            ? {
                backgroundImage: `linear-gradient(90deg, rgba(15,15,15,.94), rgba(15,15,15,.58)), url(${store.bannerUrl})`,
              }
            : undefined
        }
      >
        <div className="container public-store-hero-inner">
          <Link className="public-store-back" to="/stores">
            ← All stores
          </Link>

          <div className="public-store-identity">
            <div className="public-store-logo" aria-hidden={!store.logoUrl}>
              {store.logoUrl ? (
                <img src={store.logoUrl} alt={`${store.name} logo`} />
              ) : (
                store.name[0]
              )}
            </div>
            <div>
              <span className="public-store-label">
                <ShieldIcon /> Official campus store
              </span>
              <h1>{store.name}</h1>
              <p>
                {store.description || 'Campus essentials delivered conveniently inside campus.'}
              </p>
            </div>
          </div>

          <div className="public-store-facts">
            <span>
              <ClockIcon />
              <strong>{store.availability?.isOpen !== false ? 'Open now' : 'Closed'}</strong>
              <small>{store.availability?.message || 'Store availability'}</small>
            </span>
            <span>
              <ClockIcon />
              <strong>{store.deliveryTimeMinutes} min</strong>
              <small>Estimated delivery</small>
            </span>
            <span>
              <MapPinIcon />
              <strong>{store.campusLocation || 'Campus delivery'}</strong>
              <small>Delivery location</small>
            </span>
            <span>
              <ShoppingBagIcon />
              <strong>
                {store.minimumOrderAmount > 0
                  ? formatPrice(store.minimumOrderAmount)
                  : 'No minimum'}
              </strong>
              <small>Minimum order</small>
            </span>
          </div>
        </div>
      </section>

      <section className="public-store-catalog-section">
        <div className="container">
          <div className="public-store-toolbar">
            <div>
              <span className="eyebrow">Browse catalogue</span>
              <h2>What are you looking for?</h2>
            </div>
            <form className="public-store-search" onSubmit={submitSearch}>
              <SearchIcon />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={`Search in ${store.name}`}
                aria-label={`Search products in ${store.name}`}
              />
              {searchInput ? (
                <button
                  type="button"
                  className="public-store-search-clear"
                  onClick={clearSearch}
                  aria-label="Clear search"
                >
                  <XIcon />
                </button>
              ) : null}
              <button className="button button-primary" type="submit">
                Search
              </button>
            </form>
          </div>

          <div className="public-store-category-row" aria-label="Store categories">
            <button
              type="button"
              className={activeCategory === 'all' ? 'is-active' : ''}
              onClick={() => setActiveCategory('all')}
            >
              All products <span>{products.length}</span>
            </button>
            {visibleCategories.map((category) => {
              const count = products.filter(
                (product) => product.storeCategoryId === category.id,
              ).length
              return (
                <button
                  type="button"
                  className={activeCategory === category.id ? 'is-active' : ''}
                  onClick={() => setActiveCategory(category.id)}
                  key={category.id}
                >
                  {category.name} <span>{count}</span>
                </button>
              )
            })}
          </div>

          <div className="public-store-results-heading">
            <div>
              <strong>
                {searchQuery
                  ? `Results for “${searchQuery}”`
                  : activeCategory === 'all'
                    ? 'All products'
                    : visibleCategories.find((category) => category.id === activeCategory)?.name}
              </strong>
              <span>
                {visibleProducts.length} {visibleProducts.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            {searchQuery ? (
              <button type="button" className="button button-ghost" onClick={clearSearch}>
                Clear results
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="public-store-loading-grid">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="public-store-loading-card" key={index} />
              ))}
            </div>
          ) : visibleProducts.length ? (
            <div className="public-store-product-grid">
              {visibleProducts.map((product) => (
                <StoreProductCard product={product} store={store} key={product.id} />
              ))}
            </div>
          ) : (
            <div className="public-store-empty">
              <PackageIcon />
              <h3>No products found</h3>
              <p>
                {searchQuery
                  ? 'Try another search or clear the current filters.'
                  : 'This category does not have any products yet.'}
              </p>
              {searchQuery || activeCategory !== 'all' ? (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    clearSearch()
                    setActiveCategory('all')
                  }}
                >
                  View all products <ArrowRightIcon />
                </button>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
