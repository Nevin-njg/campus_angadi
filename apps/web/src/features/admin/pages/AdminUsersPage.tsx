import type { AdminUserListQuery } from '@campusbaza/contracts'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { adminPlatformApi } from '../api/admin-platform.api'
import { useAuthStore } from '../../auth/store/use-auth-store'

export function AdminUsersPage() {
  const canManageRoles = useAuthStore((state) => state.user?.role === 'SUPER_ADMIN')
  const [q, setQ] = useState<AdminUserListQuery>({ page: 1, limit: 20 })
  const r = useQuery({ queryKey: ['admin', 'users', q], queryFn: () => adminPlatformApi.users(q) })

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-amber-400 font-bold tracking-wider text-xs uppercase mb-2 block">
            Accounts
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">Users</h1>
          <p className="text-gray-400 text-lg">
            {canManageRoles
              ? 'Open an account to promote it to moderator or administrator.'
              : 'Search, review and control marketplace access.'}
          </p>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row gap-4">
        <input
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-gray-500"
          placeholder="Search email or name"
          onChange={(e) => setQ({ ...q, q: e.target.value || undefined, page: 1 })}
        />
        <select
          className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all appearance-none min-w-[200px]"
          onChange={(e) =>
            setQ({
              ...q,
              status: (e.target.value || undefined) as AdminUserListQuery['status'],
              page: 1,
            })
          }
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="BLOCKED">BLOCKED</option>
          <option value="DELETED">DELETED</option>
        </select>
        <select
          className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all appearance-none min-w-[200px]"
          onChange={(e) =>
            setQ({
              ...q,
              role: (e.target.value || undefined) as AdminUserListQuery['role'],
              page: 1,
            })
          }
        >
          <option value="">All roles</option>
          <option value="USER">USER</option>
          <option value="MODERATOR">MODERATOR</option>
          <option value="ADMIN">ADMIN</option>
          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
        </select>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Listings
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Orders
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {r.data?.items.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <strong className="text-white font-medium block">{u.displayName}</strong>
                    <small className="text-gray-400">{u.email}</small>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-xs font-bold tracking-wider uppercase bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/20">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`text-xs font-bold tracking-wider uppercase px-3 py-1 rounded-full border ${
                        u.status === 'ACTIVE'
                          ? 'bg-green-500/20 text-green-400 border-green-500/20'
                          : u.status === 'BLOCKED'
                            ? 'bg-red-500/20 text-red-400 border-red-500/20'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/20'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-300 font-medium">
                    {u.listingCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-300 font-medium">
                    {u.orderCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Link
                      to={`/admin/users/${u.id}`}
                      className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg transition-all"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
              {!r.data?.items.length && !r.isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    No users found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
