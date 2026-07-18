import type { OrderStatus } from '@campusbaza/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeftIcon, MessageIcon, PackageIcon } from '../../../components/ui/icons'
import { ordersApi } from '../../orders/api/orders.api'
import { dealersApi } from '../api/dealers.api'
import { OrderStatusBadge } from '../../orders/components/OrderStatusBadge'
import { useAuthStore } from '../../auth/store/use-auth-store'
import { useConfirmation } from '../../../components/feedback/confirmation-context'

const nextStatuses: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'REJECTED'],
  WAITING_FOR_DEALER_ASSIGNMENT: ['CANCELLED', 'REJECTED'],
  AWAITING_TEAM_CONFIRMATION: ['CONTACTED', 'CONFIRMED', 'CANCELLED', 'REJECTED'],
  CONTACTED: ['CONFIRMED', 'CANCELLED', 'REJECTED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
}

function price(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function AdminOrderDetailPage() {
  const { id = '' } = useParams()
  const client = useQueryClient()
  const confirm = useConfirmation()
  const currentUser = useAuthStore((state) => state.user)
  const moderatorView = currentUser?.role === 'MODERATOR'
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [note, setNote] = useState('')
  const [dealerId, setDealerId] = useState('')
  const [assignmentReason, setAssignmentReason] = useState('Order workload reassignment.')

  const order = useQuery({
    queryKey: ['admin-order', id],
    queryFn: () => ordersApi.adminDetail(id),
    enabled: Boolean(id),
  })

  const dealers = useQuery({
    queryKey: ['dealers', 'assignment'],
    queryFn: () => dealersApi.list({ isActive: true, page: 1, limit: 100 }),
    enabled: !moderatorView,
  })

  const assign = useMutation({
    mutationFn: (mode: 'AUTO' | 'MANUAL') =>
      ordersApi.assignDealer(id, {
        mode,
        dealerId: mode === 'MANUAL' ? dealerId : null,
        reason: assignmentReason,
      }),
    onSuccess: (data) => {
      client.setQueryData(['admin-order', id], data)
      void client.invalidateQueries({ queryKey: ['admin-orders'] })
      void client.invalidateQueries({ queryKey: ['dealers'] })
    },
  })

  const update = useMutation({
    mutationFn: () =>
      ordersApi.updateStatus(id, { status: status as OrderStatus, note: note || null }),
    onSuccess: (data) => {
      client.setQueryData(['admin-order', id], data)
      void client.invalidateQueries({ queryKey: ['admin-orders'] })
      setStatus('')
      setNote('')
    },
  })

  const inputClass =
    'w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-gray-500 mt-1'
  const labelClass = 'block text-sm font-medium text-gray-300 mb-4'

  if (order.isLoading)
    return (
      <div className="py-20 flex justify-center">
        <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
      </div>
    )

  if (!order.data || order.isError)
    return (
      <div className="py-20 text-center">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-500">
          <PackageIcon />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Order unavailable</h2>
        <p className="text-gray-400">The requested order could not be located.</p>
      </div>
    )

  const data = order.data

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link
        className="inline-flex items-center text-sm font-medium text-gray-400 hover:text-white transition-colors"
        to="/admin/orders"
      >
        <ChevronLeftIcon /> Back to Orders
      </Link>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <span className="text-amber-400 font-bold tracking-wider text-xs uppercase mb-2 block">
            {data.orderNumber}
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">Manage order</h1>
          <p className="text-gray-400 text-lg">
            {new Date(data.createdAt).toLocaleString('en-IN', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <div className="shrink-0 mt-2">
          <OrderStatusBadge status={data.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-white/10">
              Products
            </h2>
            <div className="space-y-4">
              {data.items.map((item) => (
                <div
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
                  key={item.id}
                >
                  {item.productImageUrl ? (
                    <img
                      src={item.productImageUrl}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover bg-black/40 border border-white/10"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-gray-500">
                      <PackageIcon />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <strong className="text-white font-medium text-lg block truncate">
                      {item.productName}
                    </strong>
                    <small className="text-gray-400 block mt-1">
                      Quantity <span className="text-white">{item.quantity}</span> ·{' '}
                      {price(item.unitPrice)} each
                    </small>
                  </div>
                  <span className="text-amber-400 font-bold bg-amber-500/10 px-3 py-1 rounded-full">
                    {price(item.totalPrice)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between">
              <span className="text-gray-300 font-medium text-lg">Total</span>
              <strong className="text-2xl font-extrabold text-white">
                {price(data.totalAmount)}
              </strong>
            </div>
          </section>

          <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-white/10">
              Status history
            </h2>
            <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
              {data.statusHistory.map((entry) => (
                <div
                  className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                  key={entry.id}
                >
                  <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-amber-500 bg-gray-900 absolute -left-[29px]">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl w-full">
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-white font-medium">
                        {entry.toStatus.replaceAll('_', ' ')}
                      </strong>
                      <small className="text-gray-400 text-xs px-2 py-0.5 bg-black/40 rounded-full">
                        {new Date(entry.createdAt).toLocaleString('en-IN')}
                      </small>
                    </div>
                    {entry.note && (
                      <p className="text-sm text-gray-300 bg-black/20 p-2 rounded-lg border border-white/5 inline-block">
                        {entry.note}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-white/10">
              Dealer assignment history
            </h2>
            {data.dealerAssignmentHistory.length ? (
              <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                {data.dealerAssignmentHistory.map((entry) => (
                  <div
                    className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                    key={entry.id}
                  >
                    <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-green-500 bg-gray-900 absolute -left-[29px]">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl w-full">
                      <div className="flex items-center justify-between mb-2">
                        <strong className="text-white font-medium">
                          {entry.newDealer
                            ? `Assigned to ${entry.newDealer.displayName}`
                            : 'Unassigned'}
                        </strong>
                        <small className="text-gray-400 text-xs px-2 py-0.5 bg-black/40 rounded-full">
                          {entry.mode} · {new Date(entry.createdAt).toLocaleString('en-IN')}
                        </small>
                      </div>
                      <p className="text-sm text-gray-300">{entry.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <span className="text-gray-400">No assignment history yet.</span>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-8 sticky top-8">
          <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-white/10">
              Buyer and pickup
            </h2>
            <dl className="space-y-4">
              <div className="flex flex-col gap-1">
                <dt className="text-xs uppercase tracking-wider text-gray-500 font-medium">Name</dt>
                <dd className="text-white font-medium">{data.fullName}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                  Phone
                </dt>
                <dd className="text-white font-medium">{data.phoneNumber}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                  Pickup location
                </dt>
                <dd className="text-white font-medium">{data.pickupLocation}</dd>
              </div>
              {data.campusId && (
                <div className="flex flex-col gap-1">
                  <dt className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                    Campus ID
                  </dt>
                  <dd className="text-white font-medium">{data.campusId}</dd>
                </div>
              )}
              {data.department && (
                <div className="flex flex-col gap-1">
                  <dt className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                    Department
                  </dt>
                  <dd className="text-white font-medium">{data.department}</dd>
                </div>
              )}
              {data.notes && (
                <div className="flex flex-col gap-1">
                  <dt className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                    Buyer note
                  </dt>
                  <dd className="text-white bg-black/20 p-3 rounded-lg border border-white/5 mt-1 text-sm">
                    {data.notes}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">Order mediator</h2>
              {data.assignedDealer ? (
                <Link className="button button-primary" to={`/admin/orders/${id}/chat`}>
                  <MessageIcon /> Open chat
                </Link>
              ) : null}
            </div>

            {data.assignedDealer ? (
              <div className="flex items-center gap-4 bg-green-500/10 border border-green-500/20 p-4 rounded-xl mb-6">
                <div className="text-green-400">
                  <MessageIcon />
                </div>
                <div>
                  <strong className="text-white block font-medium">
                    {data.assignedDealer.displayName}
                  </strong>
                  <small className="text-gray-400">Buyer support and order coordination</small>
                </div>
              </div>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl mb-6 text-amber-400 text-sm font-medium">
                This order is waiting for a dealer.
              </div>
            )}

            {!moderatorView && !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(data.status) && (
              <div className="space-y-4">
                <label className={labelClass}>
                  Assign a specific dealer
                  <select
                    className={`${inputClass} appearance-none`}
                    value={dealerId}
                    onChange={(event) => setDealerId(event.target.value)}
                  >
                    <option value="">Select dealer</option>
                    {dealers.data?.items.map((dealer) => (
                      <option
                        value={dealer.id}
                        key={dealer.id}
                        disabled={dealer.currentOpenOrders >= dealer.maxOpenOrders}
                      >
                        {dealer.displayName} ({dealer.currentOpenOrders}/{dealer.maxOpenOrders}{' '}
                        open)
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Assignment reason
                  <textarea
                    className={`${inputClass} resize-y min-h-[60px]`}
                    rows={2}
                    value={assignmentReason}
                    onChange={(event) => setAssignmentReason(event.target.value)}
                  />
                </label>

                <div className="flex gap-2 pt-2">
                  <button
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!dealerId || assign.isPending}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: 'Assign this dealer?',
                          description:
                            'The selected assignment profile will take responsibility for this order.',
                          confirmLabel: 'Assign dealer',
                        })
                      )
                        assign.mutate('MANUAL')
                    }}
                  >
                    Assign selected
                  </button>
                  <button
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={assign.isPending}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: 'Auto-assign this order?',
                          description:
                            'Campus Angadi will select an available dealer using current workload and shift capacity.',
                          confirmLabel: 'Auto-assign',
                        })
                      )
                        assign.mutate('AUTO')
                    }}
                  >
                    Auto assign
                  </button>
                </div>
                {assign.isError && (
                  <div className="mt-4 text-red-400 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm">
                    {assign.error.message}
                  </div>
                )}
              </div>
            )}
          </section>

          {!moderatorView && nextStatuses[data.status].length > 0 && (
            <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />

              <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-white/10 relative z-10">
                Update status
              </h2>

              <div className="space-y-4 relative z-10">
                <label className={labelClass}>
                  Next status
                  <select
                    className={`${inputClass} appearance-none`}
                    value={status}
                    onChange={(event) => setStatus(event.target.value as OrderStatus)}
                  >
                    <option value="">Select status</option>
                    {nextStatuses[data.status].map((value) => (
                      <option value={value} key={value}>
                        {value.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Internal status note
                  <textarea
                    className={`${inputClass} resize-y min-h-[80px]`}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    placeholder="Add an internal note about this status change..."
                  />
                </label>
                <button
                  className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  disabled={!status || update.isPending}
                  onClick={async () => {
                    if (
                      await confirm({
                        title: `Move order to ${status.replaceAll('_', ' ')}?`,
                        description:
                          'The buyer will see this status change and it will be recorded in order history.',
                        confirmLabel: 'Update status',
                        tone:
                          status === 'CANCELLED' || status === 'REJECTED' ? 'danger' : 'default',
                      })
                    )
                      update.mutate()
                  }}
                >
                  {update.isPending ? 'Updating…' : 'Save status update'}
                </button>
                {update.isError && (
                  <div className="mt-4 text-red-400 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm">
                    {update.error.message}
                  </div>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
