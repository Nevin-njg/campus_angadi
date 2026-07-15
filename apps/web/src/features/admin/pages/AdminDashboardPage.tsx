import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton'
import { adminPlatformApi } from '../api/admin-platform.api'

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`

export function AdminDashboardPage() {
  const q = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: adminPlatformApi.dashboard })
  const d = q.data

  if (q.isLoading) return <LoadingSkeleton variant="dashboard" label="Loading dashboard" />
  if (!d) return <p className="text-gray-400">Unable to load dashboard.</p>

  const cards = [
    ['Users', d.users.total, `${d.users.active} active · ${d.users.blocked} blocked`],
    ['Products', d.products.total, `${d.products.pendingApproval} awaiting review`],
    ['Orders this month', d.orders.thisMonth, `${d.orders.waitingForDealer} waiting for dealer`],
    [
      'Completed sales',
      money(d.sales.completedValue),
      `${money(d.sales.thisMonthValue)} this month`,
    ],
    ['Active dealers', d.dealers.active, `${d.dealers.atCapacity} at capacity`],
    ['Open reports', d.reports.open, `${d.reports.inReview} in review`],
  ]

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-indigo-400 font-bold tracking-wider text-xs uppercase mb-2 block">
            Operations overview
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">Dashboard</h1>
          <p className="text-gray-400 text-lg">Live marketplace, order, dealer and safety metrics.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map(([title, value, subtitle]) => (
          <article 
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-indigo-500/50 transition-colors duration-300" 
            key={String(title)}
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500">
              <div className="w-24 h-24 rounded-full bg-indigo-500 blur-2xl"></div>
            </div>
            <span className="text-gray-400 font-medium text-sm block mb-2">{title}</span>
            <strong className="text-4xl font-black text-white block mb-2">{value}</strong>
            <small className="text-gray-500 font-medium">{subtitle}</small>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Recent orders</h2>
            <Link to="/admin/orders" className="text-sm font-medium text-indigo-400 hover:text-indigo-300">View all &rarr;</Link>
          </div>
          <div className="divide-y divide-white/5">
            {d.recentOrders.map((o) => (
              <Link 
                className="flex items-center justify-between p-6 hover:bg-white/[0.02] transition-colors" 
                key={o.id} 
                to={`/admin/orders/${o.id}`}
              >
                <div>
                  <strong className="text-white font-medium block">{o.orderNumber}</strong>
                  <small className="text-gray-400">
                    {o.itemCount} items · <span className="uppercase text-xs tracking-wider">{o.status.replaceAll('_', ' ')}</span>
                  </small>
                </div>
                <span className="text-white font-bold bg-white/10 px-3 py-1 rounded-full text-sm">{money(o.totalAmount)}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Recent users</h2>
            <Link to="/admin/users" className="text-sm font-medium text-indigo-400 hover:text-indigo-300">View all &rarr;</Link>
          </div>
          <div className="divide-y divide-white/5">
            {d.recentUsers.map((u) => (
              <Link 
                className="flex items-center justify-between p-6 hover:bg-white/[0.02] transition-colors" 
                key={u.id} 
                to={`/admin/users/${u.id}`}
              >
                <div>
                  <strong className="text-white font-medium block">{u.displayName}</strong>
                  <small className="text-gray-400">{u.email}</small>
                </div>
                <span className="text-xs font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/20">
                  {u.role}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}
