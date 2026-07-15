import type { SalesPeriod } from '@campusbaza/contracts'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { adminPlatformApi } from '../api/admin-platform.api'

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

export function AdminSalesPage() {
  const [period, setPeriod] = useState<SalesPeriod>('30d')
  const q = useQuery({
    queryKey: ['admin', 'sales', period],
    queryFn: () => adminPlatformApi.sales({ period }),
  })
  const d = q.data

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-indigo-400 font-bold tracking-wider text-xs uppercase mb-2 block">
            Revenue intelligence
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">Sales</h1>
          <p className="text-gray-400 text-lg">Completed revenue is separated from pending and cancelled order value.</p>
        </div>
        <select 
          className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all min-w-[150px] appearance-none"
          value={period} 
          onChange={(e) => setPeriod(e.target.value as SalesPeriod)}
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="12m">Last 12 months</option>
        </select>
      </div>

      {!d && q.isLoading ? (
        <div className="py-20 flex justify-center">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      ) : d ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <article className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-gray-400 text-sm font-medium uppercase tracking-wider block mb-2">Order value</span>
              <strong className="text-3xl font-extrabold text-white block mb-1">{money(d.totals.orderValue)}</strong>
              <small className="text-indigo-400 font-medium">All created orders</small>
            </article>
            <article className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-gray-400 text-sm font-medium uppercase tracking-wider block mb-2">Confirmed value</span>
              <strong className="text-3xl font-extrabold text-white block mb-1">{money(d.totals.confirmedValue)}</strong>
              <small className="text-blue-400 font-medium">Confirmed or later</small>
            </article>
            <article className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-gray-400 text-sm font-medium uppercase tracking-wider block mb-2">Completed sales</span>
              <strong className="text-3xl font-extrabold text-green-400 block mb-1">{money(d.totals.completedValue)}</strong>
              <small className="text-green-500/80 font-medium">{d.totals.completedOrders} completed orders</small>
            </article>
            <article className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-gray-400 text-sm font-medium uppercase tracking-wider block mb-2">Cancelled value</span>
              <strong className="text-3xl font-extrabold text-white block mb-1">{money(d.totals.cancelledValue)}</strong>
              <small className="text-red-400 font-medium">Cancelled and rejected</small>
            </article>
            <article className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-gray-400 text-sm font-medium uppercase tracking-wider block mb-2">Average order</span>
              <strong className="text-3xl font-extrabold text-white block mb-1">{money(d.totals.averageOrderValue)}</strong>
              <small className="text-purple-400 font-medium">Completed orders only</small>
            </article>
            <article className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-gray-400 text-sm font-medium uppercase tracking-wider block mb-2">Second-hand sales</span>
              <strong className="text-3xl font-extrabold text-white block mb-1">{money(d.bySellerType.secondHand)}</strong>
              <small className="text-orange-400 font-medium">Official: {money(d.bySellerType.official)}</small>
            </article>
          </div>

          <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-6">Sales timeline</h2>
            <div className="space-y-4">
              {d.timeline.map((x) => (
                <div className="flex items-center gap-4" key={x.label}>
                  <span className="w-24 text-sm text-gray-400 text-right whitespace-nowrap">{x.label}</span>
                  <div className="flex-1 h-3 bg-black/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-1000"
                      style={{
                        width: `${Math.max(3, d.totals.completedValue ? (x.completedValue / d.totals.completedValue) * 100 : 0)}%`,
                      }}
                    />
                  </div>
                  <strong className="w-24 text-right text-white font-medium">{money(x.completedValue)}</strong>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-6">Top products</h2>
              <div className="space-y-3">
                {d.topProducts.map((x) => (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-colors" key={x.productId}>
                    <div>
                      <strong className="text-white block font-medium">{x.name}</strong>
                      <small className="text-gray-400">{x.quantity} units</small>
                    </div>
                    <span className="text-indigo-400 font-bold bg-indigo-500/10 px-3 py-1 rounded-full">{money(x.value)}</span>
                  </div>
                ))}
                {!d.topProducts.length && (
                  <div className="text-center py-6 text-gray-400">No top products for this period.</div>
                )}
              </div>
            </section>
            <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-6">Dealer performance</h2>
              <div className="space-y-3">
                {d.dealerPerformance.map((x) => (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-colors" key={x.dealerId}>
                    <div>
                      <strong className="text-white block font-medium">{x.name}</strong>
                      <small className="text-gray-400">{x.completedOrders} completed</small>
                    </div>
                    <span className="text-green-400 font-bold bg-green-500/10 px-3 py-1 rounded-full">{money(x.completedValue)}</span>
                  </div>
                ))}
                {!d.dealerPerformance.length && (
                  <div className="text-center py-6 text-gray-400">No dealer performance for this period.</div>
                )}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </section>
  )
}
