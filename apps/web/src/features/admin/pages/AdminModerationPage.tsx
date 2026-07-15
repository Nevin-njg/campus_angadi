import type { ProductStatus } from '@campusbaza/contracts'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PackageIcon, SearchIcon, AlertTriangleIcon } from '../../../components/ui/icons'
import { ListingStatusBadge } from '../../listings/components/ListingStatusBadge'
import { adminModerationApi } from '../api/admin-moderation.api'

const statuses: ProductStatus[] = [
  'PENDING_APPROVAL',
  'CHANGES_REQUESTED',
  'REJECTED',
  'APPROVED',
  'HIDDEN',
  'SOLD',
  'DELETED',
]

export function AdminModerationPage() {
  const [status, setStatus] = useState<ProductStatus>('PENDING_APPROVAL')
  const [search, setSearch] = useState('')
  
  const queue = useQuery({
    queryKey: ['admin', 'moderation', status, search],
    queryFn: () => adminModerationApi.list({ status, q: search || undefined, limit: 30 }),
  })

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-indigo-400 font-bold tracking-wider text-xs uppercase mb-2 block flex items-center gap-2">
            <AlertTriangleIcon className="w-4 h-4" /> Marketplace safety
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">User product moderation</h1>
          <p className="text-gray-400 text-lg">Review every second-hand product before it becomes public.</p>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row gap-4 items-center justify-between sticky top-8 z-10">
        <div className="relative w-full md:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
            <SearchIcon />
          </div>
          <input
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-gray-500"
            type="search"
            placeholder="Search product title or seller email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        
        <div className="flex w-full md:w-auto items-center gap-4">
          <select 
            className="w-full md:w-auto bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all appearance-none pr-10"
            value={status} 
            onChange={(event) => setStatus(event.target.value as ProductStatus)}
            style={{ backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto' }}
          >
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
          <div className="shrink-0 text-sm font-medium text-gray-400 bg-white/5 px-4 py-2 rounded-lg border border-white/5">
            <span className="text-white mr-1">{queue.data?.meta.total ?? 0}</span> listings
          </div>
        </div>
      </div>

      {queue.isLoading ? (
        <div className="py-20 flex justify-center">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      ) : null}
      
      {queue.isError ? (
        <div className="p-4 rounded-xl border bg-red-500/10 border-red-500/20 text-red-400 text-center font-medium">
          Moderation queue could not be loaded. Please try again.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4">
        {(queue.data?.items ?? []).map((product) => (
          <article className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl hover:bg-white/[0.07] transition-all group flex flex-col sm:flex-row sm:items-center gap-6" key={product.id}>
            {product.primaryImage ? (
              <img
                src={product.primaryImage.url}
                alt={product.primaryImage.altText || product.title}
                className="w-full sm:w-32 h-48 sm:h-32 object-cover rounded-xl bg-black/40 border border-white/10 shrink-0 group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full sm:w-32 h-48 sm:h-32 bg-black/40 border border-white/10 rounded-xl flex items-center justify-center text-gray-600 shrink-0">
                <PackageIcon />
              </div>
            )}
            
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <strong className="text-xl font-bold text-white mb-2 block truncate">{product.title}</strong>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                <span className="bg-white/5 px-2 py-1 rounded-md border border-white/5">{product.category.name}</span>
                <span className="font-bold text-emerald-400">₹{product.price.toLocaleString('en-IN')}</span>
                <span className="px-2 py-1 rounded-md bg-white/5 border border-white/5 capitalize">{product.condition.replaceAll('_', ' ').toLowerCase()}</span>
              </div>
            </div>
            
            <div className="flex sm:flex-col items-center sm:items-end justify-between gap-4 mt-4 sm:mt-0 shrink-0">
              <ListingStatusBadge status={product.status} />
              <Link 
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] w-full sm:w-auto text-center" 
                to={`/admin/moderation/${product.id}`}
              >
                Review details
              </Link>
            </div>
          </article>
        ))}
      </div>
      
      {!queue.isLoading && !queue.data?.items.length ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-16 shadow-xl flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-black/40 rounded-full flex items-center justify-center mb-6 text-gray-500 border border-white/5">
            <PackageIcon />
          </div>
          <strong className="text-2xl font-bold text-white mb-2">No listings in this queue</strong>
          <span className="text-gray-400 text-lg">There are no products matching the selected moderation status.</span>
        </div>
      ) : null}
    </section>
  )
}
