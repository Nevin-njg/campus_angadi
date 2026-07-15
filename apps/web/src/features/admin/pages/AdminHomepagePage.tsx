import type { HomepageSectionKey, ProductSummary } from '@campusbaza/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { ProductGrid } from '../../products/components/ProductGrid'
import { ApiClientError } from '../../../lib/api-client'
import { adminCatalogApi } from '../api/admin-catalog.api'
import { SearchIcon, PackageIcon, AlertIcon } from '../../../components/ui/icons'

const labels: Record<HomepageSectionKey, string> = {
  FEATURED: 'Featured',
  OFFICIAL: 'Official Store',
  SECOND_HAND: 'Second-Hand',
  RECENT: 'Recently Added',
}

export function AdminHomepagePage() {
  const client = useQueryClient()
  const [section, setSection] = useState<HomepageSectionKey>('FEATURED')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const homepage = useQuery({ queryKey: ['admin', 'homepage'], queryFn: adminCatalogApi.homepage })
  const products = useQuery({
    queryKey: ['admin', 'homepage-products', search],
    queryFn: () =>
      adminCatalogApi.products({
        q: search || undefined,
        page: 1,
        limit: 48,
        sort: 'latest',
        status: 'APPROVED',
      }),
  })

  const config = homepage.data?.configuration.find((item) => item.key === section)
  useEffect(() => setSelected(config?.manualProductIds ?? []), [config?.manualProductIds, section])

  const productMap = useMemo(() => {
    const all: ProductSummary[] = [
      ...(products.data?.items ?? []),
      ...(homepage.data?.sections[section]?.products ?? []),
    ]
    return new Map(all.map((product) => [product.id, product]))
  }, [homepage.data, products.data, section])

  const candidates = (products.data?.items ?? []).filter((product) => matches(product, section))
  const limit = config?.limit ?? 8
  
  const save = useMutation({
    mutationFn: () => adminCatalogApi.saveHomepage(section, selected),
    onSuccess: async () => {
      setMessage('Homepage section saved successfully.')
      await client.invalidateQueries({ queryKey: ['admin', 'homepage'] })
      await client.invalidateQueries({ queryKey: ['homepage'] })
    },
    onError: (error) =>
      setMessage(
        error instanceof ApiClientError ? error.message : 'Unable to save homepage section.',
      ),
  })
  
  const reset = useMutation({
    mutationFn: () => adminCatalogApi.resetHomepage(section),
    onSuccess: async () => {
      setSelected([])
      setMessage('Section reset to automatic selection.')
      await client.invalidateQueries({ queryKey: ['admin', 'homepage'] })
      await client.invalidateQueries({ queryKey: ['homepage'] })
    },
  })

  function add(id: string) {
    if (selected.includes(id) || selected.length >= limit) return
    setSelected([...selected, id])
  }
  
  function remove(id: string) {
    setSelected(selected.filter((value) => value !== id))
  }
  
  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= selected.length) return
    const copy = [...selected]
    ;[copy[index], copy[target]] = [copy[target]!, copy[index]!]
    setSelected(copy)
  }

  const preview = homepage.data?.sections[section]

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-indigo-400 font-bold tracking-wider text-xs uppercase mb-2 block">
            Merchandising
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">Homepage products</h1>
          <p className="text-gray-400 text-lg">Manual selections appear first. Automatic products fill every remaining position.</p>
        </div>
      </div>

      <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2 -mb-2 border-b border-white/10">
        {(Object.keys(labels) as HomepageSectionKey[]).map((key) => (
          <button
            key={key}
            className={`px-6 py-3 font-medium text-sm rounded-t-xl transition-all whitespace-nowrap border-b-2 ${
              section === key 
                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500' 
                : 'text-gray-400 hover:bg-white/5 hover:text-white border-transparent'
            }`}
            onClick={() => {
              setSection(key)
              setMessage('')
            }}
          >
            {labels[key]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col h-[600px]">
          <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b border-white/10 shrink-0">
            <div>
              <h2 className="text-xl font-bold text-white">Manual order</h2>
              <p className="text-gray-400 text-sm mt-1">
                {selected.length} of {limit} positions selected
              </p>
            </div>
            <button
              className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 px-4 py-2 rounded-lg"
              onClick={() => reset.mutate()}
              disabled={reset.isPending}
            >
              Reset to automatic
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {selected.map((id, index) => {
              const product = productMap.get(id)
              return (
                <div className="bg-black/40 border border-white/10 rounded-xl p-3 flex items-center gap-4 group hover:border-white/20 transition-all" key={id}>
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0 border border-indigo-500/20">
                    {index + 1}
                  </div>
                  
                  <div className="w-12 h-12 rounded-lg bg-black/60 border border-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                    {product?.primaryImage ? (
                      <img src={product.primaryImage.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <PackageIcon className="text-gray-500 w-5 h-5" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <strong className="text-white block truncate text-sm">{product?.title ?? 'Selected product'}</strong>
                    <small className="text-gray-500 truncate block">{product?.category.name ?? id}</small>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      disabled={index === 0} 
                      onClick={() => move(index, -1)}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button 
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      disabled={index === selected.length - 1} 
                      onClick={() => move(index, 1)}
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button 
                      className="ml-1 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors"
                      onClick={() => remove(id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
            
            {!selected.length ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-black/20 rounded-xl border border-white/5 border-dashed">
                <strong className="text-lg font-medium text-white mb-2">Automatic mode</strong>
                <span className="text-gray-400">The backend will dynamically choose all {limit} products.</span>
              </div>
            ) : null}
          </div>
          
          <div className="shrink-0 pt-6 mt-4 border-t border-white/10">
            {message ? (
              <div className={`mb-4 p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
                message.includes('successfully') || message.includes('reset')
                  ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}>
                {message.includes('Unable') && <AlertIcon className="w-4 h-4" />}
                {message}
              </div>
            ) : null}
            <button
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? 'Saving changes…' : 'Publish selection'}
            </button>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col h-[600px]">
          <div className="mb-6 pb-4 border-b border-white/10 shrink-0">
            <h2 className="text-xl font-bold text-white">Find products</h2>
            <p className="text-gray-400 text-sm mt-1">Only currently eligible products can be selected.</p>
          </div>
          
          <div className="relative mb-6 shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
              <SearchIcon />
            </div>
            <input
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-gray-500"
              placeholder="Search products by title..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-2">
            {candidates.map((product) => {
              const isSelected = selected.includes(product.id)
              const isFull = selected.length >= limit
              
              return (
                <button
                  key={product.id}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-4 ${
                    isSelected 
                      ? 'bg-indigo-500/10 border-indigo-500/30' 
                      : 'bg-black/40 border-white/5 hover:border-white/20 hover:bg-white/5'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  disabled={isSelected || isFull}
                  onClick={() => add(product.id)}
                >
                  <div className="w-12 h-12 rounded-lg bg-black/60 border border-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                    {product.primaryImage ? (
                      <img src={product.primaryImage.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <PackageIcon className="text-gray-500 w-5 h-5" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <strong className="text-white block truncate text-sm">{product.title}</strong>
                    <div className="flex items-center gap-2 text-xs mt-1">
                      <span className="text-gray-400 truncate max-w-[120px]">{product.category.name}</span>
                      <span className="text-gray-600">•</span>
                      <span className="text-emerald-400 font-medium">₹{product.price.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                  
                  <div className="shrink-0">
                    {isSelected ? (
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/20 px-3 py-1.5 rounded-lg border border-indigo-500/20">Selected</span>
                    ) : (
                      <span className="text-xs font-bold uppercase tracking-wider text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors border border-white/10">Add</span>
                    )}
                  </div>
                </button>
              )
            })}
            
            {!products.isLoading && !candidates.length ? (
              <div className="p-8 text-center text-gray-500">
                No eligible products match this section's rules.
              </div>
            ) : null}
            
            {products.isLoading ? (
              <div className="p-8 flex justify-center">
                <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      
      <div className="pt-8 border-t border-white/10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-indigo-400 font-bold tracking-wider text-xs uppercase mb-2 block">
              Published preview
            </span>
            <h2 className="text-2xl font-bold text-white">{labels[section]}</h2>
          </div>
          <span className="px-4 py-1.5 rounded-full bg-black/40 border border-white/10 text-sm font-medium text-gray-300">
            <span className="text-white">{preview?.manualCount ?? 0}</span> manual <span className="text-gray-500 mx-1">•</span> <span className="text-white">{preview?.automaticCount ?? 0}</span> automatic
          </span>
        </div>
        
        <ProductGrid
          products={preview?.products ?? []}
          emptyMessage="No eligible products are currently available to show."
        />
      </div>
    </section>
  )
}

function matches(product: ProductSummary, section: HomepageSectionKey) {
  if (section === 'OFFICIAL') return product.productType === 'NEW' && product.sellerType === 'ADMIN'
  if (section === 'SECOND_HAND')
    return product.productType === 'SECOND_HAND' && product.sellerType === 'USER'
  return true
}
