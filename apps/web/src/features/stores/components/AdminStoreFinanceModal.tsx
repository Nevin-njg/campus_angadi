import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useConfirmation } from '../../../components/feedback/confirmation-context'
import { storesApi, type Store } from '../api/stores.api'

const rupees = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value)

function currentIstMonth() {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === 'year')?.value ?? ''
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  return `${year}-${month}`
}

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) return value
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

function FinanceMetric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</span>
      <strong className="mt-2 block text-2xl font-extrabold text-white">{value}</strong>
      {note ? <small className="mt-1 block text-gray-500">{note}</small> : null}
    </div>
  )
}

export function AdminStoreFinanceModal({ store, onClose }: { store: Store; onClose: () => void }) {
  const queryClient = useQueryClient()
  const confirm = useConfirmation()
  const [activeStore, setActiveStore] = useState(store)
  const [month, setMonth] = useState(currentIstMonth)
  const [commissionDraft, setCommissionDraft] = useState(String(store.commissionPercent))

  const financeQuery = useQuery({
    queryKey: ['admin', 'stores', 'finance', activeStore.id, month],
    queryFn: () => storesApi.adminFinance(activeStore.id, month),
  })

  const updateCommission = useMutation({
    mutationFn: (commissionPercent: number) =>
      storesApi.update(activeStore.id, { commissionPercent }),
    onSuccess: async (updatedStore) => {
      setActiveStore(updatedStore)
      setCommissionDraft(String(updatedStore.commissionPercent))
      queryClient.setQueryData<Store[]>(['admin', 'stores'], (current) =>
        current?.map((item) => (item.id === updatedStore.id ? updatedStore : item)),
      )
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'stores', 'finance', updatedStore.id],
      })
    },
  })

  const settleMonth = useMutation({
    mutationFn: () => storesApi.settleMonth(activeStore.id, month),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'stores', 'finance', activeStore.id, month],
      })
    },
  })

  const finance = financeQuery.data
  const commissionNumber = Number(commissionDraft)
  const commissionValid =
    commissionDraft.trim() !== '' &&
    Number.isFinite(commissionNumber) &&
    commissionNumber >= 0 &&
    commissionNumber <= 100

  const close = () => {
    if (updateCommission.isPending || settleMonth.isPending) return
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-finance-title"
        className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl"
      >
        <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-400">
              Official store finance
            </p>
            <h2 id="store-finance-title" className="text-2xl font-bold text-white">
              {activeStore.name}
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Store orders only. Second-hand transactions are intentionally excluded.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close store finance"
            className="self-start rounded-lg border border-white/10 px-3 py-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-8 p-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Report month
              </span>
              <p className="mt-1 text-sm text-gray-300">
                Completed sales are counted by completion date in India time.
              </p>
            </div>
            <label className="space-y-2">
              <span className="sr-only">Finance month</span>
              <input
                type="month"
                max={currentIstMonth()}
                value={month}
                onChange={(event) => {
                  setMonth(event.target.value)
                  settleMonth.reset()
                }}
                className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
              />
            </label>
          </div>

          {financeQuery.isLoading ? (
            <div className="rounded-2xl border border-white/10 p-10 text-center text-gray-400">
              Calculating store finances…
            </div>
          ) : null}

          {financeQuery.isError ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {financeQuery.error instanceof Error
                ? financeQuery.error.message
                : 'Store finance could not be loaded.'}
            </div>
          ) : null}

          {finance ? (
            <>
              <section className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Store overview</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    All-time official-store order totals.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <FinanceMetric
                    label="Order value"
                    value={rupees(finance.overview.orderValue)}
                    note={`${finance.overview.orderCount} created orders`}
                  />
                  <FinanceMetric
                    label="Confirmed value"
                    value={rupees(finance.overview.confirmedValue)}
                    note="Confirmed or later"
                  />
                  <FinanceMetric
                    label="Completed sales"
                    value={rupees(finance.overview.completedSales)}
                    note={`${finance.overview.completedOrderCount} completed orders`}
                  />
                  <FinanceMetric
                    label="Active order value"
                    value={rupees(finance.overview.activeOrderValue)}
                    note={`${finance.overview.activeOrderCount} active orders`}
                  />
                  <FinanceMetric
                    label="Cancelled value"
                    value={rupees(finance.overview.cancelledValue)}
                    note={`${finance.overview.cancelledOrderCount} cancelled / rejected`}
                  />
                  <FinanceMetric
                    label="Average completed order"
                    value={rupees(finance.overview.averageCompletedOrder)}
                  />
                  <FinanceMetric
                    label="Campus Angadi share"
                    value={rupees(finance.overview.commissionAmount)}
                    note="Estimate at current rate"
                  />
                  <FinanceMetric
                    label="Store earnings"
                    value={rupees(finance.overview.storeEarnings)}
                    note="Completed sales minus commission"
                  />
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Commission management
                  </span>
                  <h3 className="mt-2 text-lg font-bold text-white">Current commission rate</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Pending calculations use this rate. Settled months stay locked to their saved
                    rate.
                  </p>
                  <div className="mt-5 flex items-center gap-3">
                    <div className="relative min-w-0 flex-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={commissionDraft}
                        onChange={(event) => setCommissionDraft(event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 pr-10 text-white outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
                      />
                      <span className="absolute right-4 top-3 text-gray-500">%</span>
                    </div>
                    <button
                      type="button"
                      disabled={
                        !commissionValid ||
                        updateCommission.isPending ||
                        commissionNumber === activeStore.commissionPercent
                      }
                      onClick={() => updateCommission.mutate(commissionNumber)}
                      className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {updateCommission.isPending ? 'Saving…' : 'Save rate'}
                    </button>
                  </div>
                  {updateCommission.isError ? (
                    <p className="mt-3 text-sm text-red-300">
                      {updateCommission.error instanceof Error
                        ? updateCommission.error.message
                        : 'Commission could not be updated.'}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                        Monthly settlement
                      </span>
                      <h3 className="mt-2 text-lg font-bold text-white">
                        {monthLabel(finance.monthly.month)}
                      </h3>
                    </div>
                    <span
                      className={`self-start rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                        finance.monthly.status === 'SETTLED'
                          ? 'border-green-500/20 bg-green-500/15 text-green-400'
                          : 'border-amber-500/20 bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {finance.monthly.status}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <FinanceMetric
                      label="Gross completed sales"
                      value={rupees(finance.monthly.grossSales)}
                      note={`${finance.monthly.completedOrderCount} orders`}
                    />
                    <FinanceMetric
                      label="Commission"
                      value={rupees(finance.monthly.commissionAmount)}
                      note={`${finance.monthly.commissionPercent}%`}
                    />
                    <FinanceMetric
                      label="Payable to store"
                      value={rupees(finance.monthly.payableToStore)}
                    />
                    <FinanceMetric
                      label="Average order"
                      value={rupees(finance.monthly.averageOrder)}
                    />
                  </div>

                  <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-gray-500">
                      {finance.monthly.status === 'SETTLED'
                        ? `Locked settlement${
                            finance.monthly.settledAt
                              ? ` · ${new Date(finance.monthly.settledAt).toLocaleString('en-IN')}`
                              : ''
                          }`
                        : finance.periodClosed
                          ? 'This month is closed and ready for settlement.'
                          : 'This month is still open. Values update as orders are completed.'}
                    </p>
                    {finance.canSettle ? (
                      <button
                        type="button"
                        disabled={settleMonth.isPending}
                        onClick={async () => {
                          const approved = await confirm({
                            title: `Settle ${monthLabel(finance.monthly.month)}?`,
                            description: `Lock ${rupees(finance.monthly.payableToStore)} as payable to ${activeStore.name}. The saved commission rate and amounts will become the accounting snapshot for this month.`,
                            confirmLabel: 'Mark settled',
                            tone: 'default',
                          })
                          if (approved) settleMonth.mutate()
                        }}
                        className="rounded-xl bg-green-500 px-4 py-3 text-sm font-bold text-black transition hover:bg-green-400 disabled:opacity-50"
                      >
                        {settleMonth.isPending ? 'Settling…' : 'Mark settled'}
                      </button>
                    ) : null}
                  </div>
                  {settleMonth.isError ? (
                    <p className="mt-3 text-sm text-red-300">
                      {settleMonth.error instanceof Error
                        ? settleMonth.error.message
                        : 'Settlement could not be completed.'}
                    </p>
                  ) : null}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
