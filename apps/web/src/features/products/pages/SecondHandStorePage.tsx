import type { ProductCondition, ProductSort, ProductType, SellerType } from '@campusbaza/contracts'
import { useQuery } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchIcon } from '../../../components/ui/icons'
import { catalogApi } from '../api/catalog.api'
import { ProductGrid, ProductGridSkeleton } from '../components/ProductGrid'

export function SecondHandStorePage() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  useEffect(() => setSearch(params.get('q') ?? ''), [params])

  const query = {
    q: params.get('q') || undefined,
    category: params.get('category') || undefined,
    productType: 'SECOND_HAND' as ProductType,
    sellerType: 'USER' as SellerType,
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
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] transition-colors duration-500">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-[#111] text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-black to-black opacity-90"></div>
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3">
           <div className="w-96 h-96 bg-purple-500/30 rounded-full blur-3xl"></div>
        </div>
        <div className="container relative z-10 px-4 py-24 mx-auto sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="inline-flex items-center px-3 py-1 mb-6 text-xs font-bold tracking-wider text-purple-300 uppercase bg-purple-900/50 rounded-full ring-1 ring-inset ring-purple-500/30 backdrop-blur-md">
              Community Marketplace
            </span>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-7xl mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-100 to-purple-300">
              Second-Hand Store
            </h1>
            <p className="max-w-2xl text-lg text-gray-300 mb-10 leading-relaxed font-medium">
              Buy and sell pre-loved campus items. Find great deals on textbooks, electronics, dorm essentials, and more from your peers.
            </p>
            <form className="flex flex-col sm:flex-row items-center max-w-2xl gap-3 bg-white/10 p-2 rounded-2xl backdrop-blur-md ring-1 ring-white/20 focus-within:ring-2 focus-within:ring-purple-400 transition-all duration-300 shadow-2xl" onSubmit={submitSearch}>
              <div className="pl-4 text-purple-200 hidden sm:block">
                <SearchIcon />
              </div>
              <input
                className="w-full bg-transparent border-0 focus:ring-0 text-white placeholder-gray-400 text-lg py-2 px-4 sm:px-0"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="What are you looking for?"
              />
              <button className="w-full sm:w-auto px-8 py-3 text-sm font-bold text-white bg-purple-600 rounded-xl hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-black transition-all duration-200 shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] hover:-translate-y-0.5">
                Search Deals
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="container px-4 py-12 mx-auto sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-10">
          {/* Sidebar Filters */}
          <aside className="w-full lg:w-72 flex-shrink-0 space-y-8">
            <div className="p-6 bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 sticky top-28">
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-6 flex items-center">
                Filters
              </h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                    Category
                  </label>
                  <div className="relative">
                    <select
                      className="w-full pl-4 pr-10 py-3 text-sm font-medium bg-gray-50 dark:bg-gray-800 border-0 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 rounded-2xl focus:ring-2 focus:ring-inset focus:ring-purple-500 appearance-none transition-shadow cursor-pointer text-gray-900 dark:text-white"
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
                    <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                    Condition
                  </label>
                  <div className="relative">
                    <select
                      className="w-full pl-4 pr-10 py-3 text-sm font-medium bg-gray-50 dark:bg-gray-800 border-0 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 rounded-2xl focus:ring-2 focus:ring-inset focus:ring-purple-500 appearance-none transition-shadow cursor-pointer text-gray-900 dark:text-white"
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
                    <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>

                <button 
                  className="w-full py-3 mt-4 text-sm font-bold text-gray-600 dark:text-gray-400 bg-transparent border-2 border-gray-200 dark:border-gray-700 rounded-2xl hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-900 dark:hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 dark:focus:ring-gray-700"
                  onClick={() => setParams({})}
                >
                  Clear all filters
                </button>
              </div>
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
              <div className="text-gray-500 dark:text-gray-400 font-medium px-2">
                Showing <span className="text-gray-900 dark:text-white font-black">{products.data?.meta.total ?? 0}</span> listings
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <label className="text-sm font-bold text-gray-400 hidden sm:block">Sort</label>
                <div className="relative w-full sm:w-auto">
                  <select 
                    className="w-full pl-4 pr-10 py-2.5 text-sm font-bold bg-gray-50 dark:bg-gray-800 border-0 ring-1 ring-inset ring-gray-200 dark:ring-gray-700 rounded-xl focus:ring-2 focus:ring-inset focus:ring-purple-500 appearance-none text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    value={query.sort} 
                    onChange={(event) => update('sort', event.target.value)}
                  >
                    <option value="latest">Latest</option>
                    <option value="popular">Popular</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="oldest">Oldest</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>
            </div>

            {products.isLoading ? (
              <ProductGridSkeleton count={8} />
            ) : products.isError ? (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="w-20 h-20 mb-6 text-gray-300 dark:text-gray-700 bg-gray-50 dark:bg-gray-900 rounded-3xl flex items-center justify-center border-2 border-gray-100 dark:border-gray-800 rotate-12">
                  <svg className="w-10 h-10 -rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                </div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Oops! Something went wrong</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">We couldn't load the second-hand listings at the moment. Please try refreshing the page.</p>
              </div>
            ) : (
              <ProductGrid products={products.data?.items ?? []} />
            )}

            {(products.data?.meta.totalPages ?? 0) > 1 ? (
              <div className="flex justify-center items-center gap-4 mt-16">
                <button
                  className="w-12 h-12 flex items-center justify-center text-gray-600 bg-white border-2 border-gray-200 rounded-full hover:border-purple-500 hover:text-purple-600 focus:ring-4 focus:outline-none focus:ring-purple-100 transition-all shadow-sm disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-600 disabled:cursor-not-allowed dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800 dark:hover:border-purple-500 dark:hover:text-purple-400"
                  disabled={query.page <= 1}
                  onClick={() => update('page', String(query.page - 1))}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900 dark:text-white px-4 py-2 bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-800 rounded-full">
                    {query.page} <span className="text-gray-400 mx-1">/</span> {products.data?.meta.totalPages}
                  </span>
                </div>
                <button
                  className="w-12 h-12 flex items-center justify-center text-gray-600 bg-white border-2 border-gray-200 rounded-full hover:border-purple-500 hover:text-purple-600 focus:ring-4 focus:outline-none focus:ring-purple-100 transition-all shadow-sm disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-600 disabled:cursor-not-allowed dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800 dark:hover:border-purple-500 dark:hover:text-purple-400"
                  disabled={query.page >= (products.data?.meta.totalPages ?? 1)}
                  onClick={() => update('page', String(query.page + 1))}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
