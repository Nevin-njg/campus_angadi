import type { OrderStatus, SellerType } from '@campusbaza/contracts'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { PackageIcon } from '../../../components/ui/icons'
import { ordersApi } from '../../orders/api/orders.api'
import { OrderStatusBadge } from '../../orders/components/OrderStatusBadge'
import { useAuthStore } from '../../auth/store/use-auth-store'

function price(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function AdminOrdersPage() {
  const moderatorView = useAuthStore((state) => state.user?.role === 'MODERATOR')
  const mediatorPage = useLocation().pathname.includes('/admin/mediator')
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const status = (params.get('status') || undefined) as OrderStatus | undefined
  const sellerType = (params.get('sellerType') || undefined) as SellerType | undefined
  const assignment = (params.get('assignment') || undefined) as
    'ASSIGNED' | 'UNASSIGNED' | undefined
  const page = Number(params.get('page') || 1)

  const orders = useQuery({
    queryKey: ['admin-orders', q, status, sellerType, assignment, page],
    queryFn: () =>
      ordersApi.adminList({ q: q || undefined, status, sellerType, assignment, page, limit: 20 }),
  })

  const update = (values: Record<string, string>) => {
    const next = new URLSearchParams(params)
    Object.entries(values).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    )
    next.delete('page')
    setParams(next)
  }

  const inputClass =
    'bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-gray-500'

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-amber-400 font-bold tracking-wider text-xs uppercase mb-2 block">
            Operations
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
            {moderatorView || mediatorPage ? 'Mediator inbox' : 'Orders'}
          </h1>
          <p className="text-gray-400 text-lg">
            {moderatorView || mediatorPage
              ? moderatorView ? 'Open the buyer conversations assigned to you.' : 'Manage buyer conversations and coordinate every active order.'
              : 'Manage and monitor marketplace transactions.'}
          </p>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row gap-4 flex-wrap">
        <input
          className={`${inputClass} flex-1 min-w-[250px]`}
          placeholder="Order number, buyer or phone"
          value={q}
          onChange={(event) => update({ q: event.target.value })}
        />
        <select
          className={`${inputClass} appearance-none min-w-[180px]`}
          value={status ?? ''}
          onChange={(event) => update({ status: event.target.value })}
        >
          <option value="">All statuses</option>
          {(
            [
              'PENDING',
              'CONFIRMED',
              'PREPARING',
              'READY_FOR_PICKUP',
              'COMPLETED',
              'CANCELLED',
              'REJECTED',
            ] as OrderStatus[]
          ).map((value) => (
            <option key={value} value={value}>
              {value.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
        <select
          className={`${inputClass} appearance-none min-w-[180px]`}
          value={sellerType ?? ''}
          onChange={(event) => update({ sellerType: event.target.value })}
        >
          <option value="">All seller types</option>
          <option value="ADMIN">Official</option>
          <option value="USER">Second-hand</option>
        </select>
        <select
          className={`${inputClass} appearance-none min-w-[180px]`}
          value={assignment ?? ''}
          onChange={(event) => update({ assignment: event.target.value })}
        >
          <option value="">All assignments</option>
          <option value="ASSIGNED">Dealer assigned</option>
          <option value="UNASSIGNED">Waiting for dealer</option>
        </select>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl relative">
        {orders.isLoading && (
          <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Buyer
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Dealer
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {orders.data?.items.map((order) => (
                <tr key={order.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      to={`/admin/orders/${order.id}`}
                      className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <strong className="text-white font-medium block">{order.fullName}</strong>
                    <small className="text-gray-400">{order.phoneNumber}</small>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${
                        order.sellerType === 'ADMIN'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/20'
                          : 'bg-orange-500/20 text-orange-300 border-orange-500/20'
                      }`}
                    >
                      {order.sellerType === 'ADMIN' ? 'Official' : 'Second-hand'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {order.assignedDealer ? (
                      <span className="text-white font-medium">
                        {order.assignedDealer.displayName}
                      </span>
                    ) : (
                      <span className="text-amber-400 text-sm font-medium">Waiting</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-300 font-medium">
                    {order.itemCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-white font-bold bg-white/10 px-3 py-1 rounded-full text-sm">
                      {price(order.totalAmount)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-400 text-sm">
                    {new Date(order.createdAt).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
              {orders.data && !orders.data.items.length && !orders.isLoading && (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-500">
                      <PackageIcon />
                    </div>
                    <strong className="text-white text-lg font-medium block mb-1">
                      No matching orders
                    </strong>
                    <span className="text-gray-400">
                      Try adjusting your filters or search query.
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {orders.data && orders.data.meta.totalPages > 1 && (
          <div className="p-4 border-t border-white/10 flex items-center justify-between bg-white/[0.01]">
            <button
              className="px-4 py-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={page <= 1}
              onClick={() => {
                const next = new URLSearchParams(params)
                next.set('page', String(page - 1))
                setParams(next)
              }}
            >
              &larr; Previous
            </button>
            <span className="text-sm text-gray-400 font-medium">
              Page <span className="text-white">{page}</span> of{' '}
              <span className="text-white">{orders.data.meta.totalPages}</span>
            </span>
            <button
              className="px-4 py-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={page >= orders.data.meta.totalPages}
              onClick={() => {
                const next = new URLSearchParams(params)
                next.set('page', String(page + 1))
                setParams(next)
              }}
            >
              Next &rarr;
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
