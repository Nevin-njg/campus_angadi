import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FormEvent, useMemo, useState } from 'react'
import { adminPlatformApi } from '../../admin/api/admin-platform.api'
import { storesApi } from '../api/stores.api'

interface CreateStoreForm {
  name: string
  description: string
  sellerId: string
  commissionPercent: string
  campusLocation: string
  deliveryTimeMinutes: string
  minimumOrderAmount: string
}

const initialForm: CreateStoreForm = {
  name: '',
  description: '',
  sellerId: '',
  commissionPercent: '',
  campusLocation: '',
  deliveryTimeMinutes: '30',
  minimumOrderAmount: '0',
}

export function AdminStoresPage() {
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [ownerSearch, setOwnerSearch] = useState('')
  const [form, setForm] = useState<CreateStoreForm>(initialForm)
  const [formError, setFormError] = useState<string | null>(null)

  const storesQuery = useQuery({
    queryKey: ['admin', 'stores'],
    queryFn: storesApi.adminList,
  })

  const sellerUsersQuery = useQuery({
    queryKey: ['admin', 'users', 'sellers'],
    queryFn: () => adminPlatformApi.users({ page: 1, limit: 100, role: 'SELLER' }),
  })

  const ownerCandidatesQuery = useQuery({
    queryKey: ['admin', 'store-owner-candidates', ownerSearch],
    queryFn: () =>
      adminPlatformApi.users({
        page: 1,
        limit: 100,
        role: 'USER',
        status: 'ACTIVE',
        q: ownerSearch.trim() || undefined,
      }),
    enabled: isCreateOpen,
  })

  const sellerNames = useMemo(
    () =>
      new Map(
        (sellerUsersQuery.data?.items ?? []).map((user) => [
          user.id,
          user.fullName || user.displayName || user.email,
        ]),
      ),
    [sellerUsersQuery.data?.items],
  )

  const createStore = useMutation({
    mutationFn: storesApi.create,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'stores'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
      ])
      setForm(initialForm)
      setOwnerSearch('')
      setFormError(null)
      setIsCreateOpen(false)
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : 'The store could not be created.')
    },
  })

  function closeCreateModal() {
    if (createStore.isPending) return
    setIsCreateOpen(false)
    setForm(initialForm)
    setOwnerSearch('')
    setFormError(null)
  }

  function submitCreateStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const commissionPercent = Number(form.commissionPercent)
    const deliveryTimeMinutes = Number(form.deliveryTimeMinutes)
    const minimumOrderAmount = Number(form.minimumOrderAmount)

    if (!form.name.trim()) {
      setFormError('Enter the store name.')
      return
    }
    if (!form.sellerId) {
      setFormError('Select a user who will own this store.')
      return
    }
    if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
      setFormError('Commission must be between 0% and 100%.')
      return
    }
    if (!Number.isInteger(deliveryTimeMinutes) || deliveryTimeMinutes < 1) {
      setFormError('Delivery time must be at least 1 minute.')
      return
    }
    if (!Number.isFinite(minimumOrderAmount) || minimumOrderAmount < 0) {
      setFormError('Minimum order amount cannot be negative.')
      return
    }

    createStore.mutate({
      name: form.name.trim(),
      description: form.description.trim() || null,
      sellerId: form.sellerId,
      commissionPercent,
      campusLocation: form.campusLocation.trim() || null,
      deliveryTimeMinutes,
      minimumOrderAmount,
      status: 'ACTIVE',
    })
  }

  const stores = storesQuery.data ?? []

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-amber-400">
            Marketplace control
          </span>
          <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-white">Stores</h1>
          <p className="max-w-2xl text-lg text-gray-400">
            Create stores, assign one shop owner, and manage store-specific commission.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-5 py-3 font-bold text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-neutral-950"
        >
          Create store
        </button>
      </header>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-xl backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                {['Store', 'Status', 'Commission', 'Seller'].map((heading) => (
                  <th
                    key={heading}
                    className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {stores.map((store) => (
                <tr key={store.id} className="transition-colors hover:bg-white/[0.03]">
                  <td className="px-6 py-5">
                    <strong className="block font-semibold text-white">{store.name}</strong>
                    <small className="text-gray-400">
                      {store.campusLocation || 'Campus location not added'}
                    </small>
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                        store.status === 'ACTIVE'
                          ? 'border-green-500/20 bg-green-500/15 text-green-400'
                          : store.status === 'SUSPENDED'
                            ? 'border-red-500/20 bg-red-500/15 text-red-400'
                            : 'border-gray-500/20 bg-gray-500/15 text-gray-400'
                      }`}
                    >
                      {store.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 font-semibold text-white">
                    {store.commissionPercent}%
                  </td>
                  <td className="px-6 py-5">
                    <strong className="block font-medium text-white">
                      {sellerNames.get(store.sellerId) || 'Seller account'}
                    </strong>
                    <small className="text-gray-500">{store.sellerId}</small>
                  </td>
                </tr>
              ))}

              {!stores.length && !storesQuery.isLoading && (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="mx-auto max-w-md">
                      <h2 className="mb-2 text-xl font-bold text-white">No stores created yet</h2>
                      <p className="mb-5 text-gray-400">
                        Create the first store and assign an existing user as its shop owner.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsCreateOpen(true)}
                        className="rounded-xl bg-amber-500 px-5 py-3 font-bold text-black transition hover:bg-amber-400"
                      >
                        Create first store
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {storesQuery.isLoading && (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-gray-400">
                    Loading stores…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCreateModal()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-store-title"
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-white/10 px-6 py-5">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-400">
                  New marketplace store
                </p>
                <h2 id="create-store-title" className="text-2xl font-bold text-white">
                  Create store
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  The selected user will automatically become the seller for this store.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                aria-label="Close create store form"
                className="rounded-lg border border-white/10 px-3 py-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitCreateStore} className="space-y-6 p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-semibold text-gray-200">Store name *</span>
                  <input
                    autoFocus
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="Example: Campus Cafe"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
                  />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-semibold text-gray-200">Description</span>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    placeholder="What does this store sell?"
                    className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
                  />
                </label>

                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="owner-search" className="text-sm font-semibold text-gray-200">
                    Shop owner *
                  </label>
                  <input
                    id="owner-search"
                    value={ownerSearch}
                    onChange={(event) => setOwnerSearch(event.target.value)}
                    placeholder="Search a user by name or email"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
                  />
                  <select
                    value={form.sellerId}
                    onChange={(event) => setForm({ ...form, sellerId: event.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="">Select an active user</option>
                    {(ownerCandidatesQuery.data?.items ?? []).map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName || user.displayName} — {user.email}
                      </option>
                    ))}
                  </select>
                  {ownerCandidatesQuery.isLoading && (
                    <p className="text-xs text-gray-500">Loading eligible users…</p>
                  )}
                  {!ownerCandidatesQuery.isLoading &&
                    !ownerCandidatesQuery.data?.items.length && (
                      <p className="text-xs text-amber-300">
                        No eligible USER account was found. The person must sign in once before you
                        can assign the store.
                      </p>
                    )}
                </div>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-gray-200">Commission percentage *</span>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={form.commissionPercent}
                      onChange={(event) =>
                        setForm({ ...form, commissionPercent: event.target.value })
                      }
                      placeholder="7"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-white outline-none transition placeholder:text-gray-600 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
                    />
                    <span className="absolute right-4 top-3 text-gray-500">%</span>
                  </div>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-gray-200">Campus location</span>
                  <input
                    value={form.campusLocation}
                    onChange={(event) => setForm({ ...form, campusLocation: event.target.value })}
                    placeholder="Main gate, hostel area…"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-gray-600 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-gray-200">Delivery time (minutes)</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.deliveryTimeMinutes}
                    onChange={(event) =>
                      setForm({ ...form, deliveryTimeMinutes: event.target.value })
                    }
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-gray-200">Minimum order amount</span>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-gray-500">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.minimumOrderAmount}
                      onChange={(event) =>
                        setForm({ ...form, minimumOrderAmount: event.target.value })
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-9 pr-4 text-white outline-none transition focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </label>
              </div>

              {formError && (
                <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {formError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={createStore.isPending}
                  className="rounded-xl border border-white/10 px-5 py-3 font-semibold text-gray-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createStore.isPending || ownerCandidatesQuery.isLoading}
                  className="rounded-xl bg-amber-500 px-5 py-3 font-bold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createStore.isPending ? 'Creating store…' : 'Create store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
