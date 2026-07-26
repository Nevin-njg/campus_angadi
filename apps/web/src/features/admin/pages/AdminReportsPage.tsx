import type { ReportListQuery, ReportStatus } from '@campusbaza/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { adminPlatformApi } from '../api/admin-platform.api'
import { useConfirmation } from '../../../components/feedback/confirmation-context'

export function AdminReportsPage() {
  const [q, setQ] = useState<ReportListQuery>({ page: 1, limit: 20 })
  const c = useQueryClient()
  const confirm = useConfirmation()
  const r = useQuery({
    queryKey: ['admin', 'reports', q],
    queryFn: () => adminPlatformApi.reports(q),
  })

  const [resolution, setResolution] = useState<Record<string, string>>({})

  const m = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReportStatus }) =>
      adminPlatformApi.updateReport(id, {
        status,
        resolution: ['RESOLVED', 'DISMISSED'].includes(status)
          ? resolution[id] || 'Reviewed by the Campus Angadi safety team.'
          : null,
      }),
    onSuccess: async () => c.invalidateQueries({ queryKey: ['admin', 'reports'] }),
  })

  const inputClass =
    'bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-gray-500'

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-amber-400 font-bold tracking-wider text-xs uppercase mb-2 block">
            Trust and safety
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">Reports</h1>
          <p className="text-gray-400 text-lg">
            Review product, seller and marketplace safety concerns.
          </p>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row gap-4">
        <input
          className={`${inputClass} flex-1`}
          placeholder="Search report text"
          onChange={(e) => setQ({ ...q, q: e.target.value || undefined, page: 1 })}
        />
        <select
          className={`${inputClass} appearance-none min-w-[200px]`}
          onChange={(e) =>
            setQ({
              ...q,
              status: (e.target.value || undefined) as ReportStatus | undefined,
              page: 1,
            })
          }
        >
          <option value="">All statuses</option>
          <option value="OPEN">OPEN</option>
          <option value="IN_REVIEW">IN_REVIEW</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="DISMISSED">DISMISSED</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
        {r.isLoading && (
          <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-10 rounded-2xl">
            <div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
          </div>
        )}

        {r.data?.items.map((x) => (
          <article
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col group hover:border-white/20 transition-all"
            key={x.id}
          >
            <div className="flex items-start justify-between mb-4 pb-4 border-b border-white/10">
              <div>
                <span
                  className={`text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-full border inline-block mb-2 ${
                    x.status === 'RESOLVED'
                      ? 'bg-green-500/20 text-green-400 border-green-500/20'
                      : x.status === 'DISMISSED'
                        ? 'bg-gray-500/20 text-gray-400 border-gray-500/20'
                        : x.status === 'IN_REVIEW'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/20'
                          : 'bg-red-500/20 text-red-400 border-red-500/20'
                  }`}
                >
                  {x.status}
                </span>
                <h2 className="text-xl font-bold text-white capitalize">
                  {x.type.replaceAll('_', ' ').toLowerCase()}
                </h2>
              </div>
              <small className="text-gray-400 text-sm whitespace-nowrap bg-black/20 px-3 py-1 rounded-full">
                {new Date(x.createdAt).toLocaleString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </small>
            </div>

            <p className="text-gray-300 mb-6 bg-black/20 p-4 rounded-xl border border-white/5 whitespace-pre-wrap flex-grow">
              {x.description}
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div className="bg-white/[0.02] p-3 rounded-lg border border-white/5">
                <span className="block text-gray-500 text-xs uppercase tracking-wider mb-1">
                  Target
                </span>
                <span className="text-white font-medium">{x.targetLabel}</span>
              </div>
              <div className="bg-white/[0.02] p-3 rounded-lg border border-white/5">
                <span className="block text-gray-500 text-xs uppercase tracking-wider mb-1">
                  Reporter
                </span>
                <span className="text-white font-medium">{x.reporterName}</span>
              </div>
            </div>

            <div className="mt-auto">
              <textarea
                className={`${inputClass} w-full min-h-[80px] resize-y mb-4 text-sm`}
                placeholder="Resolution or internal outcome..."
                value={resolution[x.id] ?? x.resolution ?? ''}
                onChange={(e) => setResolution({ ...resolution, [x.id]: e.target.value })}
              />

              <div className="flex flex-wrap gap-2">
                <button
                  className="flex-1 min-w-[100px] px-4 py-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
                  onClick={async () => {
                    if (
                      await confirm({
                        title: 'Mark report in review?',
                        description: 'This changes the report workflow state for the safety team.',
                        confirmLabel: 'Mark in review',
                      })
                    )
                      m.mutate({ id: x.id, status: 'IN_REVIEW' })
                  }}
                  disabled={m.isPending}
                >
                  Mark in review
                </button>
                <button
                  className="flex-1 min-w-[100px] px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                  onClick={async () => {
                    if (
                      await confirm({
                        title: 'Resolve this report?',
                        description: 'The saved resolution will close this safety report.',
                        confirmLabel: 'Resolve report',
                      })
                    )
                      m.mutate({ id: x.id, status: 'RESOLVED' })
                  }}
                  disabled={m.isPending}
                >
                  Resolve
                </button>
                <button
                  className="flex-1 min-w-[100px] px-4 py-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
                  onClick={async () => {
                    if (
                      await confirm({
                        title: 'Dismiss this report?',
                        description: 'The report will be closed without further action.',
                        confirmLabel: 'Dismiss report',
                        tone: 'danger',
                      })
                    )
                      m.mutate({ id: x.id, status: 'DISMISSED' })
                  }}
                  disabled={m.isPending}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </article>
        ))}

        {r.data && !r.data.items.length && !r.isLoading && (
          <div className="col-span-1 lg:col-span-2 py-16 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <strong className="text-white text-xl font-medium block mb-2">No active reports</strong>
            <span className="text-gray-400">
              The marketplace is currently clear of safety concerns.
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
