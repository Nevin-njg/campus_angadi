import type { ProductCondition, ProductSort, ProductType } from '@campusbaza/contracts'
import { useQuery } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchIcon } from '../../../components/ui/icons'
import { catalogApi } from '../api/catalog.api'
import { ProductGrid, ProductGridSkeleton } from '../components/ProductGrid'

export function ProductsPage() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  useEffect(() => setSearch(params.get('q') ?? ''), [params])

  const query = {
    q: params.get('q') || undefined,
    category: params.get('category') || undefined,
    productType: (params.get('productType') || undefined) as ProductType | undefined,
    condition: (params.get('condition') || undefined) as ProductCondition | undefined,
    sort: (params.get('sort') || 'latest') as ProductSort,
    page: Number(params.get('page') || 1),
    limit: 12,
  }
  const categories = useQuery({ queryKey: ['categories'], queryFn: catalogApi.categories })
  const products = useQuery({
    queryKey: ['products', query],
    queryFn: () => catalogApi.products(query),
  })

  function update(key: string, value?: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    update('q', search.trim() || undefined)
  }

  return (
    <section className="catalog-page section">
      <div className="container">
        <div className="catalog-page-head">
          <div>
            <span className="section-kicker">Marketplace</span>
            <h1>Browse products</h1>
            <p>Official campus products and approved second-hand listings.</p>
          </div>
          <form className="catalog-search" onSubmit={submitSearch}>
            <SearchIcon />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products"
            />
            <button className="button button-primary">Search</button>
          </form>
        </div>
        <div className="catalog-layout">
          <aside className="catalog-filters">
            <label>
              Category
              <select
                value={query.category ?? ''}
                onChange={(event) => update('category', event.target.value || undefined)}
              >
                <option value="">All categories</option>
                {(categories.data ?? []).map((category) => (
                  <option value={category.slug} key={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Product type
              <select
                value={query.productType ?? ''}
                onChange={(event) => update('productType', event.target.value || undefined)}
              >
                <option value="">All products</option>
                <option value="NEW">Official</option>
                <option value="SECOND_HAND">Second-Hand</option>
              </select>
            </label>
            <label>
              Condition
              <select
                value={query.condition ?? ''}
                onChange={(event) => update('condition', event.target.value || undefined)}
              >
                <option value="">Any condition</option>
                <option value="NEW">New</option>
                <option value="LIKE_NEW">Like new</option>
                <option value="GOOD">Good</option>
                <option value="FAIR">Fair</option>
                <option value="USED">Used</option>
                <option value="OPEN_BOX">Open box</option>
              </select>
            </label>
            <button className="button button-outline" onClick={() => setParams({})}>
              Clear filters
            </button>
          </aside>
          <div className="catalog-results">
            <div className="catalog-toolbar">
              <span>{products.data?.meta.total ?? 0} products</span>
              <label>
                Sort
                <select value={query.sort} onChange={(event) => update('sort', event.target.value)}>
                  <option value="latest">Latest</option>
                  <option value="popular">Popular</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                  <option value="oldest">Oldest</option>
                </select>
              </label>
            </div>
            {products.isLoading ? (
              <ProductGridSkeleton count={8} />
            ) : products.isError ? (
              <div className="catalog-empty">
                <strong>Unable to load products.</strong>
                <span>Please try again.</span>
              </div>
            ) : (
              <ProductGrid products={products.data?.items ?? []} />
            )}
            {(products.data?.meta.totalPages ?? 0) > 1 ? (
              <div className="pagination">
                <button
                  disabled={query.page <= 1}
                  onClick={() => update('page', String(query.page - 1))}
                >
                  Previous
                </button>
                <span>
                  Page {query.page} of {products.data?.meta.totalPages}
                </span>
                <button
                  disabled={query.page >= (products.data?.meta.totalPages ?? 1)}
                  onClick={() => update('page', String(query.page + 1))}
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
