import type { AuditLogQuery } from '@campusbaza/contracts'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { adminPlatformApi } from '../api/admin-platform.api'
import { ShieldIcon, SearchIcon, FilterIcon, ClockIcon, UserIcon, ActivityIcon, FileTextIcon, MapPinIcon } from '../../../components/ui/icons'

export function AdminAuditPage() {
  const [q, setQ] = useState<AuditLogQuery>({ page: 1, limit: 30 })
  const r = useQuery({ queryKey: ['admin', 'audit', q], queryFn: () => adminPlatformApi.audit(q) })
  
  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-indigo-400 font-bold tracking-wider text-xs uppercase mb-2 block flex items-center gap-2">
            <ShieldIcon className="w-4 h-4" /> Accountability
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">Audit logs</h1>
          <p className="text-gray-400 text-lg">Successful administrative mutations are recorded with actor and request metadata.</p>
        </div>
      </div>
      
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
            <SearchIcon />
          </div>
          <input
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-gray-500"
            placeholder="Search action, actor or entity"
            onChange={(e) => setQ({ ...q, q: e.target.value || undefined, page: 1 })}
          />
        </div>
        <div className="relative w-full md:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
            <FilterIcon />
          </div>
          <input
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-gray-500"
            placeholder="Filter by entity type"
            onChange={(e) => setQ({ ...q, entityType: e.target.value || undefined, page: 1 })}
          />
        </div>
        <div className="shrink-0 text-sm font-medium text-gray-400 bg-white/5 px-4 py-2 rounded-lg border border-white/5 self-stretch flex items-center">
          <span className="text-white mr-1">{r.data?.meta.total ?? 0}</span> events
        </div>
      </div>
      
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-black/20">
                <th className="p-4 text-xs font-bold tracking-wider text-gray-400 uppercase"><div className="flex items-center gap-2"><ClockIcon className="w-4 h-4" /> Time</div></th>
                <th className="p-4 text-xs font-bold tracking-wider text-gray-400 uppercase"><div className="flex items-center gap-2"><UserIcon className="w-4 h-4" /> Actor</div></th>
                <th className="p-4 text-xs font-bold tracking-wider text-gray-400 uppercase"><div className="flex items-center gap-2"><ActivityIcon className="w-4 h-4" /> Action</div></th>
                <th className="p-4 text-xs font-bold tracking-wider text-gray-400 uppercase"><div className="flex items-center gap-2"><FileTextIcon className="w-4 h-4" /> Entity</div></th>
                <th className="p-4 text-xs font-bold tracking-wider text-gray-400 uppercase"><div className="flex items-center gap-2"><MapPinIcon className="w-4 h-4" /> IP</div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {r.isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <div className="flex justify-center">
                      <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                    </div>
                  </td>
                </tr>
              ) : r.data?.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    No audit logs found matching your criteria.
                  </td>
                </tr>
              ) : (
                r.data?.items.map((x) => (
                  <tr key={x.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4 whitespace-nowrap">
                      <span className="text-gray-300 text-sm">{new Date(x.createdAt).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs shrink-0 border border-indigo-500/20">
                          <UserIcon className="w-3 h-3" />
                        </div>
                        <span className="font-medium text-white text-sm">{x.actorLabel}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-gray-200 border border-white/5">
                        {x.action}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-indigo-300 text-sm">{x.entityType}</span>
                        <span className="text-gray-500 text-xs font-mono mt-0.5 truncate max-w-[200px]" title={x.entityId || ''}>{x.entityId ?? '—'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-xs text-gray-400 bg-black/40 px-2 py-1 rounded border border-white/5">
                        {x.ipAddress ?? '—'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
