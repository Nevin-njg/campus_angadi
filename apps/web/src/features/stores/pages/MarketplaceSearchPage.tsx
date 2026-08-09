import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
import {
  storesApi,
  type MarketplaceSearchProduct,
  type MarketplaceSearchStore,
} from '../api/stores.api'

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

function ProductActions({
  product,
  returnTo,
  compact = false,
}: {
  product: MarketplaceSearchProduct
  returnTo: string
  compact?: boolean
}) {
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

  const cartMutation = useMutation({
    mutationFn: () => cartApi.add({ productId: product.id, quantity: 1 }),
    onSuccess(cart) {
      if (user) queryClient.setQueryData(queryKeys.cart(user.id), cart)
      setAdded(true)
      if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current)
      feedbackTimer.current = window.setTimeout(() => setAdded(false), 1500)
    },
  })

  function add() {
    if (product.stock <= 0 || cartMutation.isPending) return
    if (!user) {
      void navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`)
      return
    }
    cartMutation.mutate()
  }

  function buyNow() {
    if (product.stock <= 0) return
    const destination = `/checkout?buyNow=${encodeURIComponent(product.slug)}&quantity=1`
    if (!user) {
      void navigate(`/login?returnTo=${encodeURIComponent(destination)}`)
      return
    }
    void navigate(destination)
  }

  if (compact) {
    return (
      <div className="marketplace-compare-actions">
        <Link
          className="button button-outline"
          to={product.store ? `/stores/${product.store.slug}` : `/products/${product.slug}`}
        >
          {product.store ? 'Store' : 'Details'}
        </Link>
        <button
          className="button button-primary"
          type="button"
          disabled={product.stock <= 0 || cartMutation.isPending}
          onClick={add}
        >
          <CartIcon />
          {product.stock <= 0 ? 'Sold out' : cartMutation.isPending ? 'Adding…' : 'Add'}
        </button>
      </div>
    )
  }

  return (
    <div className="marketplace-product-actions">
      <button
        className="button button-primary"
        type="button"
        disabled={product.stock <= 0 || cartMutation.isPending}
        onClick={add}
      >
        <CartIcon />
        {product.stock <= 0
          ? 'Sold out'
          : added
            ? 'Added'
            : cartMutation.isPending
              ? 'Adding…'
              : 'Add to cart'}
      </button>
      <button
        className="button button-outline"
        type="button"
        disabled={product.stock <= 0}
        onClick={buyNow}
      >
        Buy now
      </button>
      {cartMutation.isError ? (
        <small className="card-action-error" role="alert">
          {cartMutation.error.message}
        </small>
      ) : null}
    </div>
  )
}

function StoreResultCard({ store }: { store: MarketplaceSearchStore }) {
  return (
    <Link className="marketplace-store-card" to={`/stores/${store.slug}`}>
      <div className="marketplace-store-card-logo">
        {store.logoUrl ? <img src={store.logoUrl} alt="" loading="lazy" /> : store.name.slice(0, 2)}
      </div>
      <div className="marketplace-store-card-copy">
        <span className="marketplace-official-label">
          <ShieldIcon /> Verified store
        </span>
        <h3>{store.name}</h3>
        <p>{store.description || store.campusLocation || 'Campus delivery available'}</p>
        <div className="marketplace-store-card-stats">
          <span>
            <ClockIcon /> {store.deliveryTimeMinutes} min
          </span>
          <span>
            <ShoppingBagIcon /> {store.matchingProductCount} matching
          </span>
        </div>
        <div className="marketplace-store-card-footer">
          <span>
            {store.lowestMatchingPrice !== null
              ? `From ${formatPrice(store.lowestMatchingPrice)}`
              : 'Browse catalogue'}
          </span>
          {store.highestDiscountPercent > 0 ? (
            <strong>Up to {store.highestDiscountPercent}% off</strong>
          ) : null}
          <ArrowRightIcon />
        </div>
      </div>
    </Link>
  )
}

function SearchProductCard({
  product,
  returnTo,
}: {
  product: MarketplaceSearchProduct
  returnTo: string
}) {
  return (
    <article className="marketplace-product-card">
      <Link className="marketplace-product-media" to={`/products/${product.slug}`}>
        {product.primaryImage ? (
          <img src={product.primaryImage} alt={product.title} loading="lazy" />
        ) : (
          <div className="marketplace-product-fallback">
            <PackageIcon />
            <span>No image</span>
          </div>
        )}
        {product.discountPercent > 0 ? (
          <span className="discount-badge">-{product.discountPercent}%</span>
        ) : null}
      </Link>
      <div className="marketplace-product-body">
        {product.store ? (
          <Link className="marketplace-product-store" to={`/stores/${product.store.slug}`}>
            <span className="marketplace-product-store-logo">
              {product.store.logoUrl ? (
                <img src={product.store.logoUrl} alt="" loading="lazy" />
              ) : (
                product.store.name.slice(0, 1)
              )}
            </span>
            <span>
              <small>Sold by</small>
              <strong>{product.store.name}</strong>
            </span>
            <ArrowRightIcon />
          </Link>
        ) : (
          <div className="marketplace-product-store">
            <span className="marketplace-product-store-logo">
              <ShieldIcon />
            </span>
            <span>
              <small>Sold by</small>
              <strong>Campus Angadi Official</strong>
            </span>
          </div>
        )}
        <span className="catalog-category">{product.storeCategoryName || 'Store product'}</span>
        <Link className="marketplace-product-title" to={`/products/${product.slug}`}>
          {product.title}
        </Link>
        <p>{product.description}</p>
        <div className="catalog-price-row">
          <strong>{formatPrice(product.price)}</strong>
          {product.originalPrice ? <del>{formatPrice(product.originalPrice)}</del> : null}
          {product.savings > 0 ? <span>Save {formatPrice(product.savings)}</span> : null}
        </div>
        <div className="marketplace-product-meta">
          <span className={product.stock > 0 ? 'is-available' : 'is-unavailable'}>
            <i /> {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
          </span>
          {product.store ? (
            <>
              <span>
                <ClockIcon /> {product.store.deliveryTimeMinutes} min
              </span>
              <span>
                <MapPinIcon /> {product.store.campusLocation || 'Campus'}
              </span>
            </>
          ) : (
            <span>
              <ShieldIcon /> Official campus product
            </span>
          )}
        </div>
        <ProductActions product={product} returnTo={returnTo} />
      </div>
    </article>
  )
}

type SortOption = 'recommended' | 'price_asc' | 'price_desc' | 'discount' | 'delivery'
type ResultView = 'stores' | 'products'

export function MarketplaceSearchPage() {
  const [params, setParams] = useSearchParams()
  const query = (params.get('q') ?? '').trim()
  const resultView: ResultView = params.get('type') === 'products' ? 'products' : 'stores'
  const [searchInput, setSearchInput] = useState(query)
  const [sort, setSort] = useState<SortOption>('recommended')
  const [inStockOnly, setInStockOnly] = useState(false)

  useEffect(() => {
    setSearchInput(query)
  }, [query])

  const marketplace = useQuery({
    queryKey: ['marketplace-search', query],
    queryFn: () => storesApi.searchMarketplace(query),
    staleTime: 30_000,
  })

  const products = useMemo(() => {
    const next = [...(marketplace.data?.products ?? [])]
    const filtered = inStockOnly ? next.filter((product) => product.stock > 0) : next
    return filtered.sort((left, right) => {
      if (sort === 'price_asc') return left.price - right.price
      if (sort === 'price_desc') return right.price - left.price
      if (sort === 'discount') return right.discountPercent - left.discountPercent
      if (sort === 'delivery') {
        return (
          (left.store?.deliveryTimeMinutes ?? Number.MAX_SAFE_INTEGER) -
          (right.store?.deliveryTimeMinutes ?? Number.MAX_SAFE_INTEGER)
        )
      }
      if (left.stock > 0 !== right.stock > 0) return left.stock > 0 ? -1 : 1
      if (right.discountPercent !== left.discountPercent) {
        return right.discountPercent - left.discountPercent
      }
      return left.price - right.price
    })
  }, [inStockOnly, marketplace.data?.products, sort])

  const featuredProducts = useMemo(
    () => (marketplace.data?.products ?? []).filter((product) => product.stock > 0).slice(0, 8),
    [marketplace.data?.products],
  )

  const returnTo = query
    ? `/search?q=${encodeURIComponent(query)}&type=${resultView}`
    : `/search?type=${resultView}`

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextQuery = searchInput.trim()
    setParams(nextQuery ? { q: nextQuery, type: resultView } : { type: resultView })
  }

  function searchFor(value: string) {
    setSearchInput(value)
    setParams({ q: value, type: 'stores' })
  }

  function selectView(view: ResultView) {
    setParams(query ? { q: query, type: view } : { type: view })
  }

  function browseCampus() {
    setSearchInput('')
    setParams({ type: 'stores' })
  }

  return (
    <main className="marketplace-search-page">
      <section className="marketplace-search-hero">
        <div className="container marketplace-search-hero-inner">
          <div className="marketplace-search-copy">
            <span className="eyebrow">
              <span /> Campus stores
            </span>
            <h1>Find products from every campus store.</h1>
            <p>
              Search by product or store, then choose whether you want to browse verified sellers or
              see every matching product in one place.
            </p>
          </div>
          <form className="marketplace-global-search" onSubmit={submitSearch} role="search">
            <SearchIcon />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search products or stores, like shoes or Campus Mart"
              aria-label="Search stores and products"
              autoComplete="off"
            />
            {searchInput ? (
              <button
                type="button"
                className="marketplace-search-clear"
                onClick={() => {
                  setSearchInput('')
                  setParams({})
                }}
                aria-label="Clear search"
              >
                <XIcon />
              </button>
            ) : null}
            <button className="button button-primary" type="submit">
              Search
            </button>
          </form>
          <div className="marketplace-quick-searches" aria-label="Popular searches">
            <span>Try:</span>
            {['Shoes', 'Mouse', 'Snacks', 'Stationery'].map((item) => (
              <button type="button" onClick={() => searchFor(item)} key={item}>
                {item}
              </button>
            ))}
            <button type="button" className="marketplace-browse-campus" onClick={browseCampus}>
              Browse campus <ArrowRightIcon />
            </button>
          </div>
        </div>
      </section>

      <section className="section marketplace-search-content">
        <div className="container">
          {marketplace.isLoading ? (
            <div className="marketplace-search-loading" aria-label="Loading marketplace results">
              <div />
              <div />
              <div />
            </div>
          ) : marketplace.isError ? (
            <div className="catalog-empty" role="alert">
              <PackageIcon />
              <strong>Unable to search the marketplace</strong>
              <span>{marketplace.error.message}</span>
              <button className="button button-primary" onClick={() => void marketplace.refetch()}>
                Try again
              </button>
            </div>
          ) : (
            <>
              <div className="marketplace-result-summary">
                <div>
                  <span className="section-kicker">
                    {query ? 'Search results' : 'Explore stores'}
                  </span>
                  <h2>{query ? `Results for “${query}”` : 'Stores and products around campus'}</h2>
                  <p>
                    {marketplace.data?.meta.storeCount ?? 0} stores ·{' '}
                    {marketplace.data?.meta.productCount ?? 0} products ·{' '}
                    {marketplace.data?.meta.inStockCount ?? 0} available now
                  </p>
                </div>
                {query ? (
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => {
                      setSearchInput('')
                      setParams({})
                    }}
                  >
                    Clear search
                  </button>
                ) : null}
              </div>

              {!query && featuredProducts.length ? (
                <section
                  className="marketplace-featured-section"
                  aria-labelledby="top-campus-picks"
                >
                  <div className="marketplace-section-heading">
                    <div>
                      <span className="section-kicker">Popular around campus</span>
                      <h2 id="top-campus-picks">Top picks from campus stores</h2>
                      <p>In-stock products recently added by verified sellers.</p>
                    </div>
                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={() => selectView('products')}
                    >
                      See all products <ArrowRightIcon />
                    </button>
                  </div>
                  <div className="marketplace-featured-rail">
                    {featuredProducts.map((product) => (
                      <SearchProductCard product={product} returnTo={returnTo} key={product.id} />
                    ))}
                  </div>
                </section>
              ) : null}

              <div className="marketplace-result-switch" aria-label="Choose result type">
                <button
                  type="button"
                  className={resultView === 'stores' ? 'is-active' : ''}
                  onClick={() => selectView('stores')}
                  aria-pressed={resultView === 'stores'}
                >
                  <ShoppingBagIcon />
                  <span>
                    <strong>Stores</strong>
                    <small>{marketplace.data?.meta.storeCount ?? 0} verified sellers</small>
                  </span>
                </button>
                <button
                  type="button"
                  className={resultView === 'products' ? 'is-active' : ''}
                  onClick={() => selectView('products')}
                  aria-pressed={resultView === 'products'}
                >
                  <PackageIcon />
                  <span>
                    <strong>Products</strong>
                    <small>{marketplace.data?.meta.productCount ?? 0} matching items</small>
                  </span>
                </button>
              </div>

              {resultView === 'stores' ? (
                <section className="marketplace-result-section" aria-labelledby="matching-stores">
                  <div className="marketplace-section-heading">
                    <div>
                      <span className="section-kicker">
                        {query ? 'Stores matching your search' : 'Campus store directory'}
                      </span>
                      <h2 id="matching-stores">
                        {query ? `Stores for “${query}”` : 'Browse verified campus stores'}
                      </h2>
                      <p>Open a store to search its catalogue and browse products by category.</p>
                    </div>
                  </div>
                  {(marketplace.data?.stores.length ?? 0) > 0 ? (
                    <div className="marketplace-store-grid">
                      {marketplace.data?.stores.map((store) => (
                        <StoreResultCard store={store} key={store.id} />
                      ))}
                    </div>
                  ) : (
                    <div className="marketplace-no-products">
                      <ShoppingBagIcon />
                      <h3>No stores matched this search</h3>
                      <p>Try the Products filter or use a broader search.</p>
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={() => selectView('products')}
                      >
                        Search products instead
                      </button>
                    </div>
                  )}
                </section>
              ) : (
                <section
                  className="marketplace-result-section"
                  aria-labelledby="all-product-results"
                >
                  <div className="marketplace-section-heading marketplace-comparison-heading">
                    <div>
                      <span className="section-kicker">Products from different stores</span>
                      <h2 id="all-product-results">
                        {query ? `Products for “${query}”` : 'All products around campus'}
                      </h2>
                      <p>
                        Compare sellers, prices, availability and delivery before adding to cart.
                      </p>
                    </div>
                    <div className="marketplace-result-controls">
                      <label className="marketplace-stock-toggle">
                        <input
                          type="checkbox"
                          checked={inStockOnly}
                          onChange={(event) => setInStockOnly(event.target.checked)}
                        />
                        In stock only
                      </label>
                      <label>
                        <span className="sr-only">Sort products</span>
                        <select
                          value={sort}
                          onChange={(event) => setSort(event.target.value as SortOption)}
                        >
                          <option value="recommended">Recommended</option>
                          <option value="price_asc">Price: low to high</option>
                          <option value="price_desc">Price: high to low</option>
                          <option value="discount">Biggest offer</option>
                          <option value="delivery">Fastest delivery</option>
                        </select>
                      </label>
                    </div>
                  </div>
                  {products.length ? (
                    <div className="marketplace-product-grid">
                      {products.map((product) => (
                        <SearchProductCard product={product} returnTo={returnTo} key={product.id} />
                      ))}
                    </div>
                  ) : (
                    <div className="marketplace-no-products">
                      <SearchIcon />
                      <h3>No products matched this search</h3>
                      <p>Try a broader product name or turn off the in-stock filter.</p>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  )
}
