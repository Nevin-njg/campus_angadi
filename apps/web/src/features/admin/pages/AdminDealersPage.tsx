import type { CreateDealerInput, Dealer, EnrollMediatorInput } from '@campusbaza/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { MessageIcon, TrashIcon } from '../../../components/ui/icons'
import { useConfirmation } from '../../../components/feedback/confirmation-context'
import { useAuthStore } from '../../auth/store/use-auth-store'
import { adminPlatformApi } from '../api/admin-platform.api'
import { dealersApi } from '../api/dealers.api'

const defaultForm: CreateDealerInput = {
  mediatorUserId: '',
  displayName: '',
  phoneNumber: '',
  isActive: true,
  maxOpenOrders: 10,
  workingHours: {
    timeZone: 'Asia/Kolkata',
    startTime: '00:00',
    endTime: '23:59',
    days: [0, 1, 2, 3, 4, 5, 6],
  },
  notes: null,
}

export function AdminDealersPage() {
  const client = useQueryClient()
  const confirm = useConfirmation()
  const actor = useAuthStore((state) => state.user)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Dealer | null>(null)
  const [form, setForm] = useState<CreateDealerInput>(defaultForm)
  const [accessForm, setAccessForm] = useState<EnrollMediatorInput>({
    email: '',
    access: 'MEDIATOR',
    reason: 'Added to the Campus Angadi order support team.',
  })

  const dealers = useQuery({
    queryKey: ['dealers', q],
    queryFn: () => dealersApi.list({ q: q || undefined, page: 1, limit: 100 }),
  })
  const mediatorAccounts = useQuery({
    queryKey: ['mediator-accounts'],
    queryFn: () =>
      adminPlatformApi.users({ canMediateOrders: true, status: 'ACTIVE', page: 1, limit: 100 }),
  })
  const enroll = useMutation({
    mutationFn: (input: EnrollMediatorInput) => adminPlatformApi.enrollMediator(input),
    onSuccess: async () => {
      setAccessForm((current) => ({ ...current, email: '' }))
      await client.invalidateQueries({ queryKey: ['mediator-accounts'] })
    },
  })

  const save = useMutation({
    mutationFn: () => (editing ? dealersApi.update(editing.id, form) : dealersApi.create(form)),
    onSuccess: async () => {
      setEditing(null)
      setForm(defaultForm)
      await client.invalidateQueries({ queryKey: ['dealers'] })
    },
  })

  const remove = useMutation({
    mutationFn: dealersApi.remove,
    onSuccess: () => client.invalidateQueries({ queryKey: ['dealers'] }),
  })

  const edit = (dealer: Dealer) => {
    setEditing(dealer)
    setForm({
      mediatorUserId: dealer.mediatorUserId ?? '',
      displayName: dealer.displayName,
      phoneNumber: dealer.phoneNumber,
      isActive: dealer.isActive,
      maxOpenOrders: dealer.maxOpenOrders,
      workingHours: dealer.workingHours,
      notes: dealer.notes,
    })
  }

  const inputClass =
    'w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-gray-500 mt-1'
  const labelClass = 'block text-sm font-medium text-gray-300 mb-4'

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-amber-400 font-bold tracking-wider text-xs uppercase mb-2 block">
            Mediated order support
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
            Order mediators
          </h1>
          <p className="text-gray-400 text-lg">
            Manage the team members who handle buyer chats, calls and order coordination.
          </p>
        </div>
      </div>

      <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl space-y-5">
        <div>
          <h2 className="text-xl font-bold text-white">Login-enabled mediator accounts</h2>
          <p className="text-gray-400 mt-1">
            Add an email before their first sign-in. They can use the normal email OTP login and
            will then see the mediator inbox.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3 items-end">
          <label className={labelClass}>
            Email address
            <input
              className={inputClass}
              type="email"
              placeholder="team@nitc.ac.in"
              value={accessForm.email}
              onChange={(event) => setAccessForm({ ...accessForm, email: event.target.value })}
            />
          </label>
          <label className={labelClass}>
            Access
            <select
              className={inputClass}
              value={accessForm.access}
              onChange={(event) =>
                setAccessForm({
                  ...accessForm,
                  access: event.target.value as EnrollMediatorInput['access'],
                })
              }
            >
              <option value="MEDIATOR">Mediator only</option>
              {actor?.role === 'SUPER_ADMIN' ? (
                <option value="ADMIN_MEDIATOR">Admin + mediator</option>
              ) : null}
            </select>
          </label>
          <button
            className="button button-primary mb-4"
            disabled={enroll.isPending || !accessForm.email}
            onClick={async () => {
              if (
                await confirm({
                  title: 'Enable mediator login?',
                  description: `${accessForm.email} will be able to sign in and access buyer order conversations.`,
                  confirmLabel: 'Enable access',
                })
              )
                enroll.mutate(accessForm)
            }}
          >
            {enroll.isPending ? 'Adding…' : 'Add email'}
          </button>
        </div>
        {enroll.isError ? <p className="text-red-400">{enroll.error.message}</p> : null}
        <div className="flex flex-wrap gap-2">
          {mediatorAccounts.data?.items.map((account) => (
            <span
              key={account.id}
              className="px-3 py-2 rounded-xl bg-black/20 border border-white/10 text-sm text-gray-300"
            >
              <strong className="text-white">{account.email}</strong> ·{' '}
              {account.role === 'MODERATOR'
                ? 'Mediator'
                : `${account.role.replace('_', ' ')} + mediator`}
            </span>
          ))}
          {!mediatorAccounts.isLoading && !mediatorAccounts.data?.items.length ? (
            <span className="text-gray-500">No login-enabled mediators yet.</span>
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <form className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl lg:col-span-2 sticky top-8">
          <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-white/10">
            {editing ? 'Edit dealer' : 'Add dealer'}
          </h2>

          <label className={labelClass}>
            Mediator login account
            <select
              className={`${inputClass} appearance-none`}
              required
              value={form.mediatorUserId}
              onChange={(event) => {
                const account = mediatorAccounts.data?.items.find(
                  (item) => item.id === event.target.value,
                )
                setForm({
                  ...form,
                  mediatorUserId: event.target.value,
                  displayName: form.displayName || account?.displayName || '',
                })
              }}
            >
              <option value="">Select a mediator email</option>
              {mediatorAccounts.data?.items.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.email} ·{' '}
                  {account.role === 'MODERATOR'
                    ? 'Mediator'
                    : `${account.role.replace('_', ' ')} + mediator`}
                </option>
              ))}
            </select>
            <span className="mt-2 block text-xs font-normal text-gray-500">
              Only login-enabled mediators can receive dealer assignments and buyer messages.
            </span>
          </label>

          <label className={labelClass}>
            Display name
            <input
              className={inputClass}
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
            />
          </label>

          <label className={labelClass}>
            Staff phone (internal only)
            <input
              className={inputClass}
              placeholder="+919876543210"
              value={form.phoneNumber}
              onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })}
            />
          </label>

          <label className={labelClass}>
            Maximum open orders
            <input
              className={inputClass}
              type="number"
              min={1}
              value={form.maxOpenOrders}
              onChange={(event) => setForm({ ...form, maxOpenOrders: Number(event.target.value) })}
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className={labelClass}>
              Shift starts
              <input
                className={`${inputClass} !py-2`}
                type="time"
                value={form.workingHours.startTime}
                onChange={(event) =>
                  setForm({
                    ...form,
                    workingHours: { ...form.workingHours, startTime: event.target.value },
                  })
                }
              />
            </label>
            <label className={labelClass}>
              Shift ends
              <input
                className={`${inputClass} !py-2`}
                type="time"
                value={form.workingHours.endTime}
                onChange={(event) =>
                  setForm({
                    ...form,
                    workingHours: { ...form.workingHours, endTime: event.target.value },
                  })
                }
              />
            </label>
          </div>

          <label className="flex items-center gap-3 text-white cursor-pointer p-4 bg-black/20 rounded-xl border border-white/5 mb-6 mt-2">
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-white/20 bg-black/40 text-amber-500 focus:ring-amber-500/50"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            Available for assignments
          </label>

          <label className={labelClass}>
            Internal notes
            <textarea
              className={`${inputClass} resize-y min-h-[80px]`}
              rows={3}
              value={form.notes ?? ''}
              onChange={(event) => setForm({ ...form, notes: event.target.value || null })}
            />
          </label>

          {save.isError ? (
            <div className="mb-4 text-red-400 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm">
              {save.error.message}
            </div>
          ) : null}

          <div className="flex gap-4">
            <button
              type="button"
              className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                save.isPending || !form.mediatorUserId || !form.displayName || !form.phoneNumber
              }
              onClick={async () => {
                if (
                  await confirm({
                    title: editing ? 'Update assignment profile?' : 'Create assignment profile?',
                    description: 'This changes how orders are routed to the support team.',
                    confirmLabel: editing ? 'Update profile' : 'Create profile',
                  })
                )
                  save.mutate()
              }}
            >
              {save.isPending ? 'Saving…' : editing ? 'Update dealer' : 'Add dealer'}
            </button>
            {editing ? (
              <button
                type="button"
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl transition-all border border-white/10"
                onClick={() => {
                  setEditing(null)
                  setForm(defaultForm)
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <section className="lg:col-span-3 space-y-6">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl">
            <input
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-gray-500"
              placeholder="Search dealer or number"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </div>

          {dealers.isLoading ? (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-12 shadow-xl flex justify-center">
              <div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dealers.data?.items.map((dealer) => {
              const load = Math.min(100, (dealer.currentOpenOrders / dealer.maxOpenOrders) * 100)
              const loadColor =
                load > 80
                  ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                  : load > 50
                    ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                    : 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]'

              return (
                <article
                  className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl hover:bg-white/[0.07] transition-all group flex flex-col"
                  key={dealer.id}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center shrink-0 border border-green-500/20">
                      <MessageIcon />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="truncate">
                          <strong className="text-white font-medium text-lg block truncate">
                            {dealer.displayName}
                          </strong>
                          <span className="text-gray-400 text-sm block">{dealer.phoneNumber}</span>
                          <span
                            className={`text-xs block mt-1 ${dealer.mediatorEmail ? 'text-amber-400' : 'text-red-400'}`}
                          >
                            {dealer.mediatorEmail ?? 'No mediator login linked'}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                            dealer.isActive
                              ? 'bg-green-500/20 text-green-400 border-green-500/20'
                              : 'bg-gray-500/20 text-gray-400 border-gray-500/20'
                          }`}
                        >
                          {dealer.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-black/20 rounded-xl p-3 border border-white/5 mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-white font-medium">
                        {dealer.currentOpenOrders}{' '}
                        <span className="text-gray-500">/ {dealer.maxOpenOrders} open</span>
                      </span>
                      <span className="text-amber-400 font-medium">
                        {dealer.completedOrders} completed
                      </span>
                    </div>
                    <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${loadColor}`}
                        style={{ width: `${load}%` }}
                      />
                    </div>
                  </div>

                  <small className="text-gray-500 block mb-4 mt-auto">
                    Shift {dealer.workingHours.startTime}–{dealer.workingHours.endTime} ·{' '}
                    {dealer.workingHours.timeZone}
                  </small>

                  <div className="flex gap-2 pt-4 border-t border-white/10">
                    <button
                      className="flex-1 px-3 py-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
                      onClick={() => edit(dealer)}
                    >
                      Edit
                    </button>
                    <button
                      className="px-3 py-2 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      title={
                        dealer.currentOpenOrders > 0
                          ? 'Cannot remove dealer with open orders'
                          : 'Remove dealer'
                      }
                      disabled={remove.isPending || dealer.currentOpenOrders > 0}
                      onClick={async () => {
                        if (
                          await confirm({
                            title: `Remove ${dealer.displayName}?`,
                            description:
                              'This assignment profile will no longer receive new orders.',
                            confirmLabel: 'Remove profile',
                            tone: 'danger',
                          })
                        )
                          remove.mutate(dealer.id)
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </article>
              )
            })}

            {dealers.data && !dealers.data.items.length && !dealers.isLoading && (
              <div className="col-span-1 md:col-span-2 text-center py-12 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl">
                <strong className="text-white text-lg font-medium block mb-2">
                  No dealers found
                </strong>
                <span className="text-gray-400">
                  Add an order mediator to start managing buyer conversations.
                </span>
              </div>
            )}
          </div>

          {remove.isError ? (
            <div className="text-red-400 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm">
              {remove.error.message}
            </div>
          ) : null}
        </section>
      </div>
    </section>
  )
}
