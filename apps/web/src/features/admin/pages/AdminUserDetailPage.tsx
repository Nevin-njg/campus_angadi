import type { UpdateAdminUserInput } from '@campusbaza/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { adminPlatformApi } from '../api/admin-platform.api'

export function AdminUserDetailPage() {
  const { id = '' } = useParams()
  const c = useQueryClient()
  const q = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => adminPlatformApi.user(id) })
  
  const [reason, setReason] = useState('Administrative account review.')
  
  const m = useMutation({
    mutationFn: (input: UpdateAdminUserInput) => adminPlatformApi.updateUser(id, input),
    onSuccess: async () => {
      await c.invalidateQueries({ queryKey: ['admin', 'user', id] })
      await c.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
  
  const u = q.data
  
  if (q.isLoading) return (
    <div className="py-20 flex justify-center">
      <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
    </div>
  )
  
  if (!u) return (
    <div className="py-20 text-center">
      <h2 className="text-2xl font-bold text-white mb-2">User not found</h2>
      <p className="text-gray-400">The requested user could not be located.</p>
    </div>
  )
  
  const update = (x: Omit<UpdateAdminUserInput, 'reason'>) => m.mutate({ ...x, reason })

  const inputClass = "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-gray-500 mt-1"
  const labelClass = "block text-sm font-medium text-gray-300 mb-4"
  
  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-indigo-400 font-bold tracking-wider text-xs uppercase mb-2 block">
            User account
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">{u.displayName}</h1>
          <p className="text-gray-400 text-lg">{u.email}</p>
        </div>
        <span className={`px-4 py-1.5 rounded-full text-sm font-bold tracking-wider uppercase border inline-flex ${
          u.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400 border-green-500/20' : 
          u.status === 'BLOCKED' ? 'bg-red-500/20 text-red-400 border-red-500/20' : 
          'bg-gray-500/20 text-gray-400 border-gray-500/20'
        }`}>
          {u.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl h-fit">
          <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-white/10">Profile information</h2>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-gray-400 text-sm uppercase tracking-wider font-medium">Full name</span>
              <strong className="text-white font-medium">{u.fullName ?? 'Not provided'}</strong>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-gray-400 text-sm uppercase tracking-wider font-medium">Department</span>
              <strong className="text-white font-medium">{u.department ?? 'Not provided'}</strong>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-gray-400 text-sm uppercase tracking-wider font-medium">Phone</span>
              <strong className="text-white font-medium">{u.phoneNumber ?? 'Not provided'}</strong>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-gray-400 text-sm uppercase tracking-wider font-medium">Listings</span>
              <strong className="text-white font-medium bg-white/10 px-3 py-1 rounded-full">{u.listingCount}</strong>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-gray-400 text-sm uppercase tracking-wider font-medium">Orders</span>
              <strong className="text-white font-medium bg-white/10 px-3 py-1 rounded-full">{u.orderCount}</strong>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-gray-400 text-sm uppercase tracking-wider font-medium">Completed sales</span>
              <strong className="text-green-400 font-bold bg-green-500/10 px-3 py-1 rounded-full">{u.completedSalesCount}</strong>
            </div>
          </div>
        </section>

        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl relative">
          {m.isPending && (
            <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-2xl">
              <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
          )}
          
          <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-white/10">Account controls</h2>
          
          <label className={labelClass}>
            Reason for change
            <input 
              className={inputClass}
              value={reason} 
              onChange={(e) => setReason(e.target.value)} 
              placeholder="Why are you making this change?"
            />
          </label>
          
          <label className={labelClass}>
            Status
            <select
              className={`${inputClass} appearance-none`}
              value={u.status}
              onChange={(e) => update({ status: e.target.value as UpdateAdminUserInput['status'] })}
            >
              <option value="ACTIVE">Active - Normal usage</option>
              <option value="BLOCKED">Blocked - Cannot log in</option>
              <option value="DELETED">Deleted - Account removed</option>
            </select>
          </label>
          
          <label className={labelClass}>
            Selling permission
            <select
              className={`${inputClass} appearance-none`}
              value={String(u.canSell)}
              onChange={(e) => update({ canSell: e.target.value === 'true' })}
            >
              <option value="true">Allowed to list items</option>
              <option value="false">Suspended from selling</option>
            </select>
          </label>
          
          <label className={labelClass}>
            Role
            <select
              className={`${inputClass} appearance-none`}
              value={u.role}
              onChange={(e) => update({ role: e.target.value as UpdateAdminUserInput['role'] })}
            >
              <option value="USER">Standard User</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </label>
          
          <label className={labelClass}>
            Internal notes
            <textarea
              className={`${inputClass} min-h-[100px] resize-y`}
              defaultValue={u.internalNotes ?? ''}
              onBlur={(e) => update({ internalNotes: e.target.value || null })}
              placeholder="Notes only visible to administrators..."
            />
          </label>
          
          {m.error ? (
            <div className="mt-4 text-red-400 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm">
              {m.error.message}
            </div>
          ) : null}
        </section>
      </div>
    </section>
  )
}
