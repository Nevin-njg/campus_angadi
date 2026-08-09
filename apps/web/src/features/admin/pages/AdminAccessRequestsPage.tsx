import type { AccessRequestStatus } from '@campusbaza/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { adminPlatformApi } from '../api/admin-platform.api'

export function AdminAccessRequestsPage() {
  const client = useQueryClient()
  const [status, setStatus] = useState<AccessRequestStatus | ''>('PENDING')
  const requests = useQuery({
    queryKey: ['admin', 'access-requests', status],
    queryFn: () => adminPlatformApi.accessRequests(status),
  })
  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' }) =>
      adminPlatformApi.reviewAccessRequest(id, { decision, note: null }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'access-requests'] }),
  })

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Account security
          </span>
          <h1 className="mt-2 text-4xl font-extrabold text-white">Sign-in requests</h1>
          <p className="mt-2 text-gray-400">
            Review people using email addresses outside the approved campus domains.
          </p>
        </div>
        <select
          className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white"
          value={status}
          onChange={(event) => setStatus(event.target.value as AccessRequestStatus | '')}
        >
          <option value="">All requests</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </header>

      <div className="grid gap-4">
        {requests.data?.map((request) => (
          <article
            className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl"
            key={request.id}
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-bold text-white">{request.fullName}</h2>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-gray-300">
                    {request.status}
                  </span>
                </div>
                <p className="mt-1 text-amber-300">{request.email}</p>
                <p className="mt-3 text-sm text-gray-300">
                  <strong>Affiliation:</strong> {request.affiliation}
                </p>
                <p className="mt-2 max-w-3xl text-sm text-gray-400">{request.reason}</p>
                <small className="mt-3 block text-gray-500">
                  Requested {new Date(request.createdAt).toLocaleString('en-IN')}
                </small>
              </div>
              {request.status === 'PENDING' ? (
                <div className="flex shrink-0 gap-2">
                  <button
                    className="button button-primary"
                    disabled={review.isPending}
                    onClick={() => review.mutate({ id: request.id, decision: 'APPROVED' })}
                  >
                    Approve
                  </button>
                  <button
                    className="button button-outline"
                    disabled={review.isPending}
                    onClick={() => review.mutate({ id: request.id, decision: 'REJECTED' })}
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        ))}
        {!requests.isLoading && !requests.data?.length ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center text-gray-400">
            No access requests in this view.
          </div>
        ) : null}
      </div>
      {review.isError ? <p className="text-red-400">{review.error.message}</p> : null}
    </section>
  )
}
