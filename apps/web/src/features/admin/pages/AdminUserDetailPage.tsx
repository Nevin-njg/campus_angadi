import type { UpdateAdminUserInput } from '@campusbaza/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { adminPlatformApi } from '../api/admin-platform.api'
import { useAuthStore } from '../../auth/store/use-auth-store'
import { useConfirmation } from '../../../components/feedback/ConfirmationProvider'

export function AdminUserDetailPage() {
  const { id = '' } = useParams()
  const currentUser = useAuthStore((state) => state.user)
  const canManageRoles = currentUser?.role === 'SUPER_ADMIN'
  const confirm = useConfirmation()
  const c = useQueryClient()
  const q = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => adminPlatformApi.user(id) })

  const [reason, setReason] = useState('Administrative account review.')
  const [notes, setNotes] = useState('')

  const m = useMutation({
    mutationFn: (input: UpdateAdminUserInput) => adminPlatformApi.updateUser(id, input),
    onSuccess: async () => {
      await c.invalidateQueries({ queryKey: ['admin', 'user', id] })
      await c.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })

  const u = q.data
  useEffect(() => setNotes(q.data?.internalNotes ?? ''), [q.data?.internalNotes])

  if (q.isLoading)
    return (
      <div className="py-20 flex justify-center">
        <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
      </div>
    )

  if (!u)
    return (
      <div className="py-20 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">User not found</h2>
        <p className="text-gray-400">The requested user could not be located.</p>
      </div>
    )

  const update = async (x: Omit<UpdateAdminUserInput, 'reason'>, label: string) => {
    if (await confirm({ title: `Confirm ${label}?`, description: `${label} for ${u.email}. The user will be notified with your stated reason.`, confirmLabel: 'Apply change', tone: x.status === 'BLOCKED' || x.status === 'DELETED' ? 'danger' : 'default' }))
      m.mutate({ ...x, reason })
  }

  const inputClass =
    'w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-gray-500 mt-1'
  const labelClass = 'block text-sm font-medium text-gray-300 mb-4'

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-amber-400 font-bold tracking-wider text-xs uppercase mb-2 block">
            User account
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
            {u.displayName}
          </h1>
          <p className="text-gray-400 text-lg">{u.email}</p>
        </div>
        <span
          className={`px-4 py-1.5 rounded-full text-sm font-bold tracking-wider uppercase border inline-flex ${
            u.status === 'ACTIVE'
              ? 'bg-green-500/20 text-green-400 border-green-500/20'
              : u.status === 'BLOCKED'
                ? 'bg-red-500/20 text-red-400 border-red-500/20'
                : 'bg-gray-500/20 text-gray-400 border-gray-500/20'
          }`}
        >
          {u.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl h-fit">
          <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-white/10">
            Profile information
          </h2>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-gray-400 text-sm uppercase tracking-wider font-medium">
                Full name
              </span>
              <strong className="text-white font-medium">{u.fullName ?? 'Not provided'}</strong>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-gray-400 text-sm uppercase tracking-wider font-medium">
                Department
              </span>
              <strong className="text-white font-medium">{u.department ?? 'Not provided'}</strong>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-gray-400 text-sm uppercase tracking-wider font-medium">
                Phone
              </span>
              <strong className="text-white font-medium">{u.phoneNumber ?? 'Not provided'}</strong>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-gray-400 text-sm uppercase tracking-wider font-medium">
                Listings
              </span>
              <strong className="text-white font-medium bg-white/10 px-3 py-1 rounded-full">
                {u.listingCount}
              </strong>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-gray-400 text-sm uppercase tracking-wider font-medium">
                Orders
              </span>
              <strong className="text-white font-medium bg-white/10 px-3 py-1 rounded-full">
                {u.orderCount}
              </strong>
            </div>
            <div className="flex justify-between items-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-gray-400 text-sm uppercase tracking-wider font-medium">
                Completed sales
              </span>
              <strong className="text-green-400 font-bold bg-green-500/10 px-3 py-1 rounded-full">
                {u.completedSalesCount}
              </strong>
            </div>
          </div>
        </section>

        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl relative">
          {m.isPending && (
            <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-2xl">
              <div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
            </div>
          )}

          <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-white/10">
            Account controls
          </h2>

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
              onChange={(e) => void update({ status: e.target.value as UpdateAdminUserInput['status'] }, `change account status to ${e.target.value}`)}
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
              onChange={(e) => void update({ canSell: e.target.value === 'true' }, e.target.value === 'true' ? 'allow selling' : 'suspend selling')}
            >
              <option value="true">Allowed to list items</option>
              <option value="false">Suspended from selling</option>
            </select>
          </label>

          <label className={labelClass}>
            Role
            <select
              className={`${inputClass} appearance-none disabled:cursor-not-allowed disabled:opacity-50`}
              disabled={!canManageRoles}
              value={u.role}
              onChange={(e) => void update({ role: e.target.value as UpdateAdminUserInput['role'] }, `change role to ${e.target.value}`)}
            >
              <option value="USER">Standard User</option>
              <option value="MODERATOR">Moderator — Assigned conversations only</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
            <span className="mt-2 block text-xs font-normal text-gray-500">
              {canManageRoles
                ? 'Promote trusted accounts here. Moderators can only work with assigned conversations.'
                : 'Only a super administrator can promote or demote accounts.'}
            </span>
          </label>

          <label className={labelClass}>
            Mediator workspace
            <select className={`${inputClass} appearance-none disabled:cursor-not-allowed disabled:opacity-50`} disabled={!canManageRoles} value={String(u.canMediateOrders)} onChange={(e) => void update({ canMediateOrders: e.target.value === 'true' }, e.target.value === 'true' ? 'enable mediator access' : 'remove mediator access')}>
              <option value="true">Enabled — can handle buyer conversations</option>
              <option value="false">Not enabled</option>
            </select>
            <span className="mt-2 block text-xs font-normal text-gray-500">Admin and super-admin roles remain unchanged when mediator access is enabled.</span>
          </label>

          <label className={labelClass}>
            Internal notes
            <textarea
              className={`${inputClass} min-h-[100px] resize-y`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes only visible to administrators..."
            />
          </label>
          <button className="button button-outline" disabled={notes === (u.internalNotes ?? '') || m.isPending} onClick={() => void update({ internalNotes: notes || null }, 'save internal notes')}>Save internal notes</button>

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
