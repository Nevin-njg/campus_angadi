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
    mutationFn: ({ checkout }: { checkout: boolean }) =>
      cartApi.add({ productId: product.id, quantity: 1 }).then((cart) => ({ cart, checkout })),
    onSuccess({ cart, checkout }) {
      if (user) queryClient.setQueryData(queryKeys.cart(user.id), cart)
      if (checkout) {
        void navigate('/checkout')
        return
      }
      setAdded(true)
      if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current)
      feedbackTimer.current = window.setTimeout(() => setAdded(false), 1500)
    },
  })

  function add(checkout: boolean) {
    if (product.stock <= 0 || cartMutation.isPending) return
    if (!user) {
      void navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`)
      return
    }
    cartMutation.mutate({ checkout })
  }

  if (compact) {
    return (
      <div className="marketplace-compare-actions">
        <Link className="button button-outline" to={`/stores/${product.store.slug}`}>
          Store
        </Link>
        <button
          className="button button-primary"
          type="button"
          disabled={product.stock <= 0 || cartMutation.isPending}
          onClick={() => add(false)}
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
        onClick={() => add(false)}
      >
        <CartIcon />
        {product.stock <= 0
          ? 'Sold out'
          : added
            ? 'Added'
            : cartMutation.isPending && !cartMutation.variables?.checkout
              ? 'Adding…'
              : 'Add to cart'}
      </button>
      <button
        className="button button-outline"
        type="button"
        disabled={product.stock <= 0 || cartMutation.isPending}
        onClick={() => add(true)}
      >
        {cartMutation.isPending && cartMutation.variables?.checkout ? 'Opening…' : 'Buy now'}
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
          <span>
            <ClockIcon /> {product.store.deliveryTimeMinutes} min
          </span>
          <span>
            <MapPinIcon /> {product.store.campusLocation || 'Campus'}
          </span>
        </div>
        <ProductActions product={product} returnTo={returnTo} />
      </div>
    </article>
  )
}

type SortOption = 'recommended' | 'price_asc' | 'price_desc' | 'discount' | 'delivery'

export function MarketplaceSearchPage() {
  const [params, setParams] = useSearchParams()
  const query = (params.get('q') ?? '').trim()
  const [searchInput, setSearchInput] = useState(query)
  const [sort, setSort] = useState<SortOption>('recommended')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [showAllComparison, setShowAllComparison] = useState(false)

  useEffect(() => {
    setSearchInput(query)
    setShowAllComparison(false)
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
        return left.store.deliveryTimeMinutes - right.store.deliveryTimeMinutes
      }
      if ((left.stock > 0) !== (right.stock > 0)) return left.stock > 0 ? -1 : 1
      if (right.discountPercent !== left.discountPercent) {
        return right.discountPercent - left.discountPercent
      }
      return left.price - right.price
    })
  }, [inStockOnly, marketplace.data?.products, sort])

  const bestPrice = useMemo(() => {
    const availablePrices = products
      .filter((product) => product.stock > 0)
      .map((product) => product.price)
    return availablePrices.length ? Math.min(...availablePrices) : null
  }, [products])

  const returnTo = query ? `/search?q=${encodeURIComponent(query)}` : '/search'
  const comparisonProducts = showAllComparison ? products : products.slice(0, 8)

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextQuery = searchInput.trim()
    setParams(nextQuery ? { q: nextQuery } : {})
  }

  function searchFor(value: string) {
    setSearchInput(value)
    setParams({ q: value })
  }

  return (
    <main className="marketplace-search-page">
      <section className="marketplace-search-hero">
        <div className="container marketplace-search-hero-inner">
          <div className="marketplace-search-copy">
            <span className="eyebrow">
              <span /> Campus stores
            </span>
            <h1>Search once. Compare every store.</h1>
            <p>
              Find a store by name or compare the same kind of product across nearby campus stores
              by price, offer, stock and delivery time.
            </p>
          </div>
          <form className="marketplace-global-search" onSubmit={submitSearch} role="search">
            <SearchIcon />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search a store or product, like shoes or mouse"
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
              Compare
            </button>
          </form>
          <div className="marketplace-quick-searches" aria-label="Popular searches">
            <span>Try:</span>
            {['Shoes', 'Mouse', 'Snacks', 'Stationery'].map((item) => (
              <button type="button" onClick={() => searchFor(item)} key={item}>
                {item}
              </button>
            ))}
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
                  <span className="section-kicker">{query ? 'Search results' : 'Explore stores'}</span>
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

              {(marketplace.data?.stores.length ?? 0) > 0 ? (
                <section className="marketplace-result-section" aria-labelledby="matching-stores">
                  <div className="marketplace-section-heading">
                    <div>
                      <span className="section-kicker">Store matches</span>
                      <h2 id="matching-stores">
                        {query ? 'Stores selling what you searched' : 'Browse campus stores'}
                      </h2>
                    </div>
                    <Link className="button button-ghost" to="/stores">
                      View store directory <ArrowRightIcon />
                    </Link>
                  </div>
                  <div className="marketplace-store-grid">
                    {marketplace.data?.stores.map((store) => (
                      <StoreResultCard store={store} key={store.id} />
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="marketplace-result-section" aria-labelledby="compare-products">
                <div className="marketplace-section-heading marketplace-comparison-heading">
                  <div>
                    <span className="section-kicker">Store-wise comparison</span>
                    <h2 id="compare-products">Compare matching products</h2>
                    <p>Check every store’s price, offer, availability and delivery before buying.</p>
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
                  <>
                    <div className="marketplace-comparison-table" role="table">
                      <div className="marketplace-comparison-row is-header" role="row">
                        <span role="columnheader">Store</span>
                        <span role="columnheader">Product</span>
                        <span role="columnheader">Price</span>
                        <span role="columnheader">Offer</span>
                        <span role="columnheader">Stock</span>
                        <span role="columnheader">Delivery</span>
                        <span role="columnheader">Action</span>
                      </div>
                      {comparisonProducts.map((product) => (
                        <div className="marketplace-comparison-row" role="row" key={product.id}>
                          <div className="marketplace-compare-store" role="cell" data-label="Store">
                            <span>
                              {product.store.logoUrl ? (
                                <img src={product.store.logoUrl} alt="" loading="lazy" />
                              ) : (
                                product.store.name.slice(0, 1)
                              )}
                            </span>
                            <Link to={`/stores/${product.store.slug}`}>{product.store.name}</Link>
                          </div>
                          <div className="marketplace-compare-product" role="cell" data-label="Product">
                            {product.primaryImage ? (
                              <img src={product.primaryImage} alt="" loading="lazy" />
                            ) : (
                              <span className="marketplace-compare-image-fallback">
                                <PackageIcon />
                              </span>
                            )}
                            <div>
                              <Link to={`/products/${product.slug}`}>{product.title}</Link>
                              <small>{product.storeCategoryName || 'Store product'}</small>
                            </div>
                          </div>
                          <div className="marketplace-compare-price" role="cell" data-label="Price">
                            <strong>{formatPrice(product.price)}</strong>
                            {product.originalPrice ? <del>{formatPrice(product.originalPrice)}</del> : null}
                            {bestPrice !== null && product.price === bestPrice && product.stock > 0 ? (
                              <span>Best price</span>
                            ) : null}
                          </div>
                          <div role="cell" data-label="Offer">
                            {product.discountPercent > 0 ? (
                              <strong className="marketplace-offer-value">
                                {product.discountPercent}% off
                              </strong>
                            ) : (
                              <span className="marketplace-muted-value">No offer</span>
                            )}
                          </div>
                          <div role="cell" data-label="Stock">
                            <span
                              className={`marketplace-stock-value ${product.stock > 0 ? 'is-available' : 'is-unavailable'}`}
                            >
                              <i /> {product.stock > 0 ? `${product.stock} left` : 'Out of stock'}
                            </span>
                          </div>
                          <div role="cell" data-label="Delivery">
                            <span className="marketplace-delivery-value">
                              <ClockIcon /> {product.store.deliveryTimeMinutes} min
                            </span>
                          </div>
                          <div role="cell" data-label="Action">
                            <ProductActions product={product} returnTo={returnTo} compact />
                          </div>
                        </div>
                      ))}
                    </div>
                    {products.length > 8 ? (
                      <button
                        type="button"
                        className="button button-outline marketplace-show-more"
                        onClick={() => setShowAllComparison((value) => !value)}
                      >
                        {showAllComparison ? 'Show fewer comparisons' : `Compare all ${products.length} products`}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <div className="marketplace-no-products">
                    <SearchIcon />
                    <h3>{query ? 'No store products matched this search' : 'No store products yet'}</h3>
                    <p>
                      {query
                        ? 'Try a broader product name or search for a store directly.'
                        : 'Products added by campus stores will appear here.'}
                    </p>
                  </div>
                )}
              </section>

              {products.length ? (
                <section className="marketplace-result-section" aria-labelledby="all-product-results">
                  <div className="marketplace-section-heading">
                    <div>
                      <span className="section-kicker">Product results</span>
                      <h2 id="all-product-results">Products from different stores</h2>
                    </div>
                    <span className="marketplace-product-count">{products.length} results</span>
                  </div>
                  <div className="marketplace-product-grid">
                    {products.map((product) => (
                      <SearchProductCard product={product} returnTo={returnTo} key={product.id} />
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>
      </section>
    </main>
  )
}
