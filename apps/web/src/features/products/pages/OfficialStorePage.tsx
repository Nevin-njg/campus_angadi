import type { ProductCondition, ProductSort, ProductType, SellerType } from '@campusbaza/contracts'
import { useQuery } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchIcon } from '../../../components/ui/icons'
import { catalogApi } from '../api/catalog.api'
import { ProductGrid, ProductGridSkeleton } from '../components/ProductGrid'

export function OfficialStorePage() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  useEffect(() => setSearch(params.get('q') ?? ''), [params])

  const query = {
    q: params.get('q') || undefined,
    category: params.get('category') || undefined,
    productType: 'NEW' as ProductType,
    sellerType: 'ADMIN' as SellerType,
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-500">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent dark:from-blue-900/20"></div>
        <div className="container relative z-10 px-4 py-20 mx-auto sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="inline-flex items-center px-3 py-1 mb-6 text-xs font-medium text-blue-800 bg-blue-100 rounded-full dark:bg-blue-900/30 dark:text-blue-300 ring-1 ring-inset ring-blue-200 dark:ring-blue-800/50 backdrop-blur-sm shadow-sm animate-fade-in-up">
              Official Campus Store
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl lg:text-6xl drop-shadow-sm mb-6 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
              Premium Campus Essentials
            </h1>
            <p className="max-w-xl text-lg text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
              Discover official merchandise, top-quality supplies, and exclusive deals brought to you directly by the campus administration. Quality guaranteed.
            </p>
            <form className="flex items-center max-w-md gap-3 bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-lg ring-1 ring-gray-200/50 dark:ring-gray-700/50 focus-within:ring-2 focus-within:ring-blue-500 transition-all duration-300 transform hover:scale-[1.01]" onSubmit={submitSearch}>
              <div className="pl-4 text-gray-400">
                <SearchIcon />
              </div>
              <input
                className="w-full bg-transparent border-0 focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400 text-base"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search official products..."
              />
              <button className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-md hover:shadow-lg active:scale-95">
                Search
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="container px-4 py-12 mx-auto sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-10">
          {/* Sidebar Filters */}
          <aside className="w-full lg:w-72 flex-shrink-0 space-y-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/60 sticky top-28">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                <span className="w-1.5 h-6 bg-blue-500 rounded-full mr-3"></span> Filters
              </h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <div className="relative">
                    <select
                      className="w-full pl-4 pr-10 py-2.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none transition-shadow cursor-pointer text-gray-900 dark:text-white"
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
                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Condition
                  </label>
                  <div className="relative">
                    <select
                      className="w-full pl-4 pr-10 py-2.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none transition-shadow cursor-pointer text-gray-900 dark:text-white"
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
                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>

                <button 
                  className="w-full py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 dark:focus:ring-gray-700 mt-4"
                  onClick={() => setParams({})}
                >
                  Clear all filters
                </button>
              </div>
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
              <div className="text-gray-600 dark:text-gray-400 font-medium">
                <span className="text-gray-900 dark:text-white font-bold">{products.data?.meta.total ?? 0}</span> products found
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Sort by:</label>
                <div className="relative">
                  <select 
                    className="pl-3 pr-8 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none font-medium text-gray-900 dark:text-white cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-sm"
                    value={query.sort} 
                    onChange={(event) => update('sort', event.target.value)}
                  >
                    <option value="latest">Latest arrivals</option>
                    <option value="popular">Most popular</option>
                    <option value="price_asc">Price: low to high</option>
                    <option value="price_desc">Price: high to low</option>
                    <option value="oldest">Oldest</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>
            </div>

            {products.isLoading ? (
              <ProductGridSkeleton count={8} />
            ) : products.isError ? (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="w-16 h-16 mb-4 text-gray-400 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                </div>
                <strong className="text-xl font-bold text-gray-900 dark:text-white mb-2">Unable to load products</strong>
                <span className="text-gray-500 dark:text-gray-400">There was an error fetching the store inventory. Please try again later.</span>
              </div>
            ) : (
              <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                <ProductGrid products={products.data?.items ?? []} />
              </div>
            )}

            {(products.data?.meta.totalPages ?? 0) > 1 ? (
              <div className="flex justify-center items-center gap-6 mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
                <button
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 hover:text-blue-600 focus:ring-4 focus:outline-none focus:ring-blue-300 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-white"
                  disabled={query.page <= 1}
                  onClick={() => update('page', String(query.page - 1))}
                >
                  &larr; Previous
                </button>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-lg">
                  Page <strong className="text-gray-900 dark:text-white">{query.page}</strong> of <strong className="text-gray-900 dark:text-white">{products.data?.meta.totalPages}</strong>
                </span>
                <button
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 hover:text-blue-600 focus:ring-4 focus:outline-none focus:ring-blue-300 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-white"
                  disabled={query.page >= (products.data?.meta.totalPages ?? 1)}
                  onClick={() => update('page', String(query.page + 1))}
                >
                  Next &rarr;
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
