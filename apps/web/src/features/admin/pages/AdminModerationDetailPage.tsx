import type { ModerateProductInput, ModerationDecision } from '@campusbaza/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertIcon, ShieldIcon, ChevronLeftIcon } from '../../../components/ui/icons'
import { ApiClientError } from '../../../lib/api-client'
import { ListingStatusBadge } from '../../listings/components/ListingStatusBadge'
import { adminModerationApi } from '../api/admin-moderation.api'

const decisionLabels: Array<{ value: ModerationDecision; label: string }> = [
  { value: 'APPROVE', label: 'Approve and publish' },
  { value: 'REQUEST_CHANGES', label: 'Request changes' },
  { value: 'REJECT', label: 'Reject listing' },
  { value: 'HIDE', label: 'Hide published listing' },
  { value: 'RESTORE', label: 'Restore hidden listing' },
]

export function AdminModerationDetailPage() {
  const { id } = useParams()
  const client = useQueryClient()
  const [decision, setDecision] = useState<ModerationDecision>('APPROVE')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const listing = useQuery({
    queryKey: ['admin', 'moderation-detail', id],
    queryFn: () => adminModerationApi.get(id!),
    enabled: Boolean(id),
  })
  const moderate = useMutation({
    mutationFn: (input: ModerateProductInput) => adminModerationApi.decide(id!, input),
    onSuccess: async (value) => {
      setMessage('Moderation decision saved.')
      setReason('')
      await client.invalidateQueries({ queryKey: ['admin', 'moderation-detail', id] })
      await client.invalidateQueries({ queryKey: ['admin', 'moderation'] })
      await client.invalidateQueries({ queryKey: ['homepage'] })
      await client.invalidateQueries({ queryKey: ['products'] })
      if (value.status === 'APPROVED') setDecision('HIDE')
    },
    onError: (error) =>
      setMessage(error instanceof ApiClientError ? error.message : 'Unable to save this decision.'),
  })

  const inputClass = "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-gray-500 mt-1"
  const labelClass = "block text-sm font-medium text-gray-300 mb-4"

  if (listing.isLoading) return (
    <div className="py-20 flex justify-center">
      <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
    </div>
  )
  
  if (listing.isError || !listing.data) return (
    <div className="py-20 text-center">
      <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertIcon />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Record unavailable</h2>
      <p className="text-gray-400">This moderation record could not be loaded.</p>
      <Link to="/admin/moderation" className="mt-4 inline-block text-indigo-400 hover:text-indigo-300">Return to moderation queue</Link>
    </div>
  )
  
  const value = listing.data
  const availableDecisions = decisionLabels.filter((item) => {
    if (value.status === 'PENDING_APPROVAL')
      return ['APPROVE', 'REQUEST_CHANGES', 'REJECT'].includes(item.value)
    if (['CHANGES_REQUESTED', 'REJECTED'].includes(value.status))
      return ['APPROVE', 'REJECT'].includes(item.value)
    if (value.status === 'APPROVED') return item.value === 'HIDE'
    if (value.status === 'HIDDEN') return item.value === 'RESTORE'
    return false
  })
  
  const selectedDecision = availableDecisions.some((item) => item.value === decision)
    ? decision
    : availableDecisions[0]?.value

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
      <Link className="inline-flex items-center text-sm font-medium text-gray-400 hover:text-white transition-colors" to="/admin/moderation">
        <ChevronLeftIcon /> Back to Moderation queue
      </Link>
      
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">{value.title}</h1>
          <p className="text-gray-400 text-lg">Submitted by <span className="text-indigo-400">{value.sellerSnapshot.displayName}</span>.</p>
        </div>
        <div className="shrink-0 mt-2">
          <ListingStatusBadge status={value.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {value.images.map((image) => (
              <div key={image.id} className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden aspect-video relative group">
                <img 
                  src={image.url} 
                  alt={image.altText || value.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            ))}
          </div>
          
          <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-white/10">Product information</h2>
            <p className="text-gray-300 leading-relaxed mb-6 whitespace-pre-wrap">{value.description}</p>
            
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-6">
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <dt className="text-xs uppercase tracking-wider text-gray-500 font-medium">Category</dt>
                <dd className="text-white font-medium">{value.category.name}</dd>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <dt className="text-xs uppercase tracking-wider text-gray-500 font-medium">Price</dt>
                <dd className="text-emerald-400 font-bold text-lg">₹{value.price.toLocaleString('en-IN')}</dd>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <dt className="text-xs uppercase tracking-wider text-gray-500 font-medium">Original price</dt>
                <dd className="text-white font-medium">
                  {value.originalPrice ? `₹${value.originalPrice.toLocaleString('en-IN')}` : <span className="text-gray-500 italic">Not supplied</span>}
                </dd>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <dt className="text-xs uppercase tracking-wider text-gray-500 font-medium">Condition</dt>
                <dd className="text-white font-medium capitalize">{value.condition.replaceAll('_', ' ').toLowerCase()}</dd>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <dt className="text-xs uppercase tracking-wider text-gray-500 font-medium">Age</dt>
                <dd className="text-white font-medium">{value.productAge ?? <span className="text-gray-500 italic">Not supplied</span>}</dd>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <dt className="text-xs uppercase tracking-wider text-gray-500 font-medium">Quantity</dt>
                <dd className="text-white font-medium">{value.stock}</dd>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <dt className="text-xs uppercase tracking-wider text-gray-500 font-medium">Pickup location</dt>
                <dd className="text-white font-medium">{value.pickupLocation ?? <span className="text-gray-500 italic">Not supplied</span>}</dd>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <dt className="text-xs uppercase tracking-wider text-gray-500 font-medium">Tags</dt>
                <dd className="text-white font-medium">
                  {value.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {value.tags.map(tag => (
                        <span key={tag} className="bg-white/10 px-2 py-0.5 rounded text-sm">{tag}</span>
                      ))}
                    </div>
                  ) : <span className="text-gray-500 italic">None</span>}
                </dd>
              </div>
            </dl>
            
            {value.reasonForSelling && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <h3 className="text-sm uppercase tracking-wider text-gray-400 font-bold mb-2">Reason for selling</h3>
                <p className="text-gray-300 bg-black/20 p-4 rounded-xl border border-white/5">{value.reasonForSelling}</p>
              </div>
            )}
            
            {value.additionalDetails && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <h3 className="text-sm uppercase tracking-wider text-gray-400 font-bold mb-2">Additional details</h3>
                <p className="text-gray-300 bg-black/20 p-4 rounded-xl border border-white/5">{value.additionalDetails}</p>
              </div>
            )}
          </section>
          
          <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-white/10">Moderation history</h2>
            <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
              {value.moderationHistory.map((item) => (
                <article className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active" key={item.id}>
                  <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-indigo-500 bg-gray-900 absolute -left-[29px]">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl w-full">
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-white font-medium capitalize">{item.action.replaceAll('_', ' ').toLowerCase()}</strong>
                      <small className="text-gray-400 text-xs px-2 py-0.5 bg-black/40 rounded-full">{new Date(item.createdAt).toLocaleString()}</small>
                    </div>
                    <p className="text-indigo-300 text-sm mb-2">{item.toStatus.replaceAll('_', ' ')}</p>
                    {item.reason && (
                      <blockquote className="text-gray-400 text-sm border-l-2 border-indigo-500/50 pl-3 py-1 my-2 bg-black/20 rounded-r-lg pr-2">{item.reason}</blockquote>
                    )}
                    {item.actor && (
                      <small className="text-gray-500 block mt-2 pt-2 border-t border-white/5">
                        By {item.actor.displayName}
                      </small>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-8 sticky top-8">
          <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0">
                <ShieldIcon />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Seller</h2>
                <p className="text-xs text-indigo-300 uppercase tracking-wider font-medium">Verified campus account</p>
              </div>
            </div>
            
            <dl className="space-y-4">
              <div className="flex flex-col gap-1">
                <dt className="text-xs uppercase tracking-wider text-gray-500 font-medium">Name</dt>
                <dd className="text-white font-medium">{value.sellerSnapshot.displayName}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs uppercase tracking-wider text-gray-500 font-medium">Email</dt>
                <dd className="text-white font-medium">{value.sellerSnapshot.email}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs uppercase tracking-wider text-gray-500 font-medium">Profile</dt>
                <dd className="text-white font-medium">
                  {value.sellerSnapshot.profileCompleted ? (
                    <span className="text-emerald-400 flex items-center gap-1">Complete</span>
                  ) : (
                    <span className="text-amber-400">Incomplete</span>
                  )}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs uppercase tracking-wider text-gray-500 font-medium">Selling</dt>
                <dd className="text-white font-medium">
                  {value.sellerSnapshot.canSell ? (
                    <span className="text-emerald-400">Enabled</span>
                  ) : (
                    <span className="text-red-400">Suspended</span>
                  )}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs uppercase tracking-wider text-gray-500 font-medium">Account Status</dt>
                <dd className="text-white font-medium">{value.sellerSnapshot.status}</dd>
              </div>
            </dl>
          </section>

          {availableDecisions.length ? (
            <form
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden"
              onSubmit={(event) => {
                event.preventDefault()
                setMessage('')
                if (!selectedDecision) return
                if (
                  ['REJECT', 'REQUEST_CHANGES', 'HIDE'].includes(selectedDecision) &&
                  !reason.trim()
                ) {
                  setMessage('Enter a clear reason for this decision.')
                  return
                }
                if (selectedDecision !== decision) setDecision(selectedDecision)
                moderate.mutate({ decision: selectedDecision, reason: reason.trim() || null })
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
              <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-white/10 relative z-10">Moderation decision</h2>
              
              <div className="space-y-4 relative z-10">
                <label className={labelClass}>
                  Action
                  <select
                    className={`${inputClass} appearance-none`}
                    value={selectedDecision}
                    onChange={(event) => setDecision(event.target.value as ModerationDecision)}
                  >
                    {availableDecisions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                
                <label className={labelClass}>
                  Reason or instructions
                  <textarea
                    className={`${inputClass} min-h-[120px] resize-y`}
                    rows={5}
                    maxLength={1000}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Required for rejection, requested changes and hiding."
                  />
                </label>
                
                {message && (
                  <div className={`mt-4 p-3 rounded-lg text-sm flex items-start gap-2 ${
                    moderate.isError || message.includes('clear reason') 
                      ? 'bg-red-500/10 border border-red-500/20 text-red-400' 
                      : 'bg-green-500/10 border border-green-500/20 text-green-400'
                  }`}>
                    {moderate.isError || message.includes('clear reason') ? <AlertIcon className="w-4 h-4 shrink-0 mt-0.5" /> : null}
                    <span>{message}</span>
                  </div>
                )}
                
                <button 
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] disabled:opacity-50 disabled:cursor-not-allowed mt-2" 
                  disabled={moderate.isPending}
                >
                  {moderate.isPending ? 'Saving decision…' : 'Save decision'}
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl text-center">
              <h2 className="text-lg font-bold text-white mb-2">No moderation action available</h2>
              <p className="text-gray-400">This listing is currently <span className="text-white font-medium">{value.status.replaceAll('_', ' ').toLowerCase()}</span>.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
