import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminPlatformApi } from '../api/admin-platform.api'
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton'
import { ActivityIcon, DatabaseIcon, ShieldIcon, AlertTriangleIcon, CheckCircleIcon, RefreshCwIcon, TrashIcon } from '../../../components/ui/icons'

function count(result: {
  staleUploads: number
  readNotifications: number
  revokedSessions: number
  auditLogs: number
  expiredListings: number
}) {
  return (
    result.staleUploads +
    result.readNotifications +
    result.revokedSessions +
    result.auditLogs +
    result.expiredListings
  )
}

export function AdminOperationsPage() {
  const client = useQueryClient()
  const status = useQuery({
    queryKey: ['admin', 'operations', 'status'],
    queryFn: adminPlatformApi.operationsStatus,
    refetchInterval: 30_000,
  })
  
  const indexes = useQuery({
    queryKey: ['admin', 'operations', 'indexes'],
    queryFn: adminPlatformApi.operationIndexes,
  })
  
  const cleanup = useMutation({
    mutationFn: adminPlatformApi.runCleanup,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['admin', 'operations'] })
    },
  })

  if (status.isLoading) return <LoadingSkeleton variant="dashboard" label="Loading operations" />
  
  if (!status.data) return (
    <div className="py-20 text-center">
      <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertTriangleIcon className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Operations Unavailable</h2>
      <p className="text-gray-400">Operations status is currently unavailable.</p>
    </div>
  )
  
  const value = status.data

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-indigo-400 font-bold tracking-wider text-xs uppercase mb-2 block flex items-center gap-2">
            <ActivityIcon className="w-4 h-4" /> Production operations
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">System operations</h1>
          <p className="text-gray-400 text-lg max-w-2xl">
            Dependency readiness, cleanup jobs and database-index drift for super administrators.
          </p>
        </div>
        <button
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          disabled={cleanup.isPending || value.cleanupRunning || !value.cleanupEnabled}
          onClick={() => cleanup.mutate()}
        >
          {cleanup.isPending ? (
            <><RefreshCwIcon className="w-5 h-5 animate-spin" /> Running cleanup…</>
          ) : (
            <><TrashIcon className="w-5 h-5" /> Run cleanup now</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <article className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DatabaseIcon className="w-16 h-16" />
          </div>
          <span className="text-sm font-medium text-gray-400 block mb-2">MongoDB</span>
          <strong className={`text-2xl font-bold block mb-1 flex items-center gap-2 ${value.mongoReady ? 'text-emerald-400' : 'text-red-400'}`}>
            {value.mongoReady ? <CheckCircleIcon className="w-6 h-6" /> : <AlertTriangleIcon className="w-6 h-6" />}
            {value.mongoReady ? 'Ready' : 'Unavailable'}
          </strong>
          <small className="text-gray-500">Primary application database</small>
        </article>
        
        <article className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DatabaseIcon className="w-16 h-16" />
          </div>
          <span className="text-sm font-medium text-gray-400 block mb-2">Redis</span>
          <strong className={`text-2xl font-bold block mb-1 flex items-center gap-2 ${value.redisReady ? 'text-emerald-400' : (value.redisRequired ? 'text-red-400' : 'text-amber-400')}`}>
            {value.redisReady ? <CheckCircleIcon className="w-6 h-6" /> : <AlertTriangleIcon className="w-6 h-6" />}
            {value.redisReady ? 'Ready' : value.redisRequired ? 'Required' : 'Optional'}
          </strong>
          <small className="text-gray-500">OTP, rate limits and job locks</small>
        </article>
        
        <article className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ActivityIcon className="w-16 h-16" />
          </div>
          <span className="text-sm font-medium text-gray-400 block mb-2">Cleanup schedule</span>
          <strong className={`text-2xl font-bold block mb-1 ${value.cleanupEnabled ? 'text-white' : 'text-gray-500'}`}>
            {value.cleanupEnabled ? `${value.cleanupIntervalMinutes} min` : 'Disabled'}
          </strong>
          <small className={value.cleanupRunning ? "text-indigo-400" : "text-gray-500"}>
            {value.cleanupRunning ? 'A cleanup run is active' : 'No cleanup currently running'}
          </small>
        </article>
        
        <article className={`backdrop-blur-xl rounded-2xl p-6 shadow-xl relative overflow-hidden group border ${value.indexDriftCount > 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-white/5 border-white/10'}`}>
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ShieldIcon className="w-16 h-16" />
          </div>
          <span className="text-sm font-medium text-gray-400 block mb-2">Index drift</span>
          <strong className={`text-2xl font-bold block mb-1 ${value.indexDriftCount > 0 ? 'text-red-400' : 'text-white'}`}>
            {value.indexDriftCount}
          </strong>
          <small className={value.indexDriftCount > 0 ? 'text-red-400/80' : 'text-gray-500'}>
            {value.indexDriftCount ? 'Review before deployment' : 'Schemas and indexes match'}
          </small>
        </article>
      </div>

      {cleanup.error ? (
        <div className="p-4 rounded-xl border bg-red-500/10 border-red-500/20 text-red-400 font-medium flex items-center gap-2">
          <AlertTriangleIcon className="w-5 h-5 shrink-0" />
          {cleanup.error.message}
        </div>
      ) : null}
      
      {cleanup.data ? (
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden" aria-live="polite">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-start gap-4 mb-8">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
                <CheckCircleIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Latest manual cleanup</h2>
                <p className="text-gray-400 text-lg"><span className="text-white font-medium">{count(cleanup.data)}</span> records or assets were processed.</p>
              </div>
            </div>
            
            <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col justify-between h-24">
                <dt className="text-sm text-gray-400 font-medium">Temporary uploads</dt>
                <dd className="text-2xl font-bold text-white">{cleanup.data.staleUploads}</dd>
              </div>
              <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col justify-between h-24">
                <dt className="text-sm text-gray-400 font-medium">Read notifications</dt>
                <dd className="text-2xl font-bold text-white">{cleanup.data.readNotifications}</dd>
              </div>
              <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col justify-between h-24">
                <dt className="text-sm text-gray-400 font-medium leading-tight">Expired/revoked sessions</dt>
                <dd className="text-2xl font-bold text-white">{cleanup.data.revokedSessions}</dd>
              </div>
              <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col justify-between h-24">
                <dt className="text-sm text-gray-400 font-medium">Old audit logs</dt>
                <dd className="text-2xl font-bold text-white">{cleanup.data.auditLogs}</dd>
              </div>
              <div className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col justify-between h-24">
                <dt className="text-sm text-gray-400 font-medium">Expired listings</dt>
                <dd className="text-2xl font-bold text-white">{cleanup.data.expiredListings}</dd>
              </div>
            </dl>
          </div>
        </section>
      ) : null}

      <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-white/10">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Database index inspection</h2>
            <p className="text-gray-400">Verifying that database indexes match application schemas.</p>
          </div>
          <button 
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl transition-all flex items-center gap-2 justify-center shrink-0" 
            onClick={() => void indexes.refetch()}
          >
            <RefreshCwIcon className={`w-4 h-4 ${indexes.isFetching ? 'animate-spin text-indigo-400' : ''}`} /> Refresh
          </button>
        </div>
        
        {indexes.isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-gray-400">
            <RefreshCwIcon className="w-8 h-8 animate-spin text-indigo-500/50 mb-4" />
            <p>Inspecting indexes…</p>
          </div>
        ) : null}
        
        {indexes.data?.length === 0 ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon className="w-6 h-6" />
            </div>
            <strong className="text-emerald-400 font-medium text-lg block">No index drift detected</strong>
            <p className="text-gray-400 mt-1">All database indexes are properly synchronized with application schemas.</p>
          </div>
        ) : null}
        
        {indexes.data && indexes.data.length > 0 && (
          <div className="space-y-4">
            {indexes.data.map((item) => (
              <article className="bg-red-500/5 border border-red-500/20 rounded-xl p-5" key={item.model}>
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-red-500/10">
                  <AlertTriangleIcon className="w-5 h-5 text-red-400" />
                  <strong className="text-lg font-bold text-white">{item.model}</strong>
                </div>
                <div className="space-y-2">
                  {item.toCreate.length ? (
                    <div className="flex items-start gap-3">
                      <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase rounded shrink-0 mt-0.5">Create</span>
                      <p className="text-gray-300 font-mono text-sm break-all">{item.toCreate.join(', ')}</p>
                    </div>
                  ) : null}
                  {item.toDrop.length ? (
                    <div className="flex items-start gap-3">
                      <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-bold uppercase rounded shrink-0 mt-0.5">Drop</span>
                      <p className="text-gray-300 font-mono text-sm break-all">{item.toDrop.join(', ')}</p>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
