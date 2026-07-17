import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertIcon, PackageIcon } from '../../../components/ui/icons'
import { ApiClientError } from '../../../lib/api-client'
import { listingsApi } from '../api/listings.api'
import { ListingStatusBadge } from '../components/ListingStatusBadge'
import { useConfirmation } from '../../../components/feedback/ConfirmationProvider'

export function ListingDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const client = useQueryClient()
  const confirm = useConfirmation()
  const listing = useQuery({
    queryKey: ['listing', id],
    queryFn: () => listingsApi.get(id!),
    enabled: Boolean(id),
  })
  const remove = useMutation({
    mutationFn: () => listingsApi.remove(id!),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['my-listings'] })
      void navigate('/account/listings')
    },
  })
  const markSold = useMutation({
    mutationFn: () => listingsApi.markSold(id!),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['listing', id] })
      await client.invalidateQueries({ queryKey: ['my-listings'] })
      await client.invalidateQueries({ queryKey: ['homepage'] })
    },
  })

  if (listing.isLoading) return <div className="content-card">Loading listing…</div>
  if (listing.isError || !listing.data)
    return <div className="form-alert">This listing could not be loaded.</div>
  const value = listing.data
  const editable = [
    'DRAFT',
    'PENDING_APPROVAL',
    'CHANGES_REQUESTED',
    'REJECTED',
    'APPROVED',
  ].includes(value.status)
  const actionError = remove.error ?? markSold.error

  return (
    <section>
      <div className="page-heading listing-page-heading">
        <div>
          <span className="section-kicker">My listing</span>
          <h1>{value.title}</h1>
          <p>
            Submitted{' '}
            {value.submittedAt ? new Date(value.submittedAt).toLocaleString() : 'recently'}.
          </p>
        </div>
        <ListingStatusBadge status={value.status} />
      </div>

      {value.moderationMessage ? (
        <div className="moderation-message">
          <AlertIcon />
          <div>
            <strong>Administrator feedback</strong>
            <p>{value.moderationMessage}</p>
          </div>
        </div>
      ) : null}

      <div className="listing-detail-layout">
        <div>
          <div className="listing-detail-gallery content-card">
            {value.images.map((image) => (
              <img key={image.id} src={image.url} alt={image.altText || value.title} />
            ))}
          </div>
          <section className="content-card listing-description-card">
            <h2>Description</h2>
            <p>{value.description}</p>
            {value.additionalDetails ? (
              <>
                <h3>Additional details</h3>
                <p>{value.additionalDetails}</p>
              </>
            ) : null}
            {value.reasonForSelling ? (
              <>
                <h3>Reason for selling</h3>
                <p>{value.reasonForSelling}</p>
              </>
            ) : null}
          </section>
        </div>
        <aside className="listing-detail-side">
          <section className="content-card listing-facts-card">
            <strong className="listing-detail-price">₹{value.price.toLocaleString('en-IN')}</strong>
            <dl>
              <div>
                <dt>Category</dt>
                <dd>{value.category.name}</dd>
              </div>
              <div>
                <dt>Condition</dt>
                <dd>{value.condition.replaceAll('_', ' ')}</dd>
              </div>
              <div>
                <dt>Product age</dt>
                <dd>{value.productAge ?? 'Not specified'}</dd>
              </div>
              <div>
                <dt>Quantity</dt>
                <dd>{value.stock}</dd>
              </div>
              <div>
                <dt>Pickup</dt>
                <dd>{value.pickupLocation ?? 'Not specified'}</dd>
              </div>
            </dl>
            <div className="listing-detail-actions">
              {editable ? (
                <Link className="button button-primary" to={`/account/listings/${value.id}/edit`}>
                  Edit and resubmit
                </Link>
              ) : null}
              {value.status === 'APPROVED' ? (
                <button
                  className="button button-outline"
                  disabled={markSold.isPending}
                  onClick={async () => {
                    if (await confirm({ title: 'Mark this listing as sold?', description: 'It will disappear from the public marketplace and cannot receive new enquiries.', confirmLabel: 'Mark sold' })) markSold.mutate()
                  }}
                >
                  {markSold.isPending ? 'Updating…' : 'Mark sold'}
                </button>
              ) : null}
              {!['SOLD', 'DELETED'].includes(value.status) ? (
                <button
                  className="button button-danger"
                  disabled={remove.isPending}
                  onClick={async () => {
                    if (await confirm({ title: 'Delete this listing?', description: 'The listing will be removed from your marketplace account.', confirmLabel: 'Delete listing', tone: 'danger' })) remove.mutate()
                  }}
                >
                  {remove.isPending ? 'Deleting…' : 'Delete listing'}
                </button>
              ) : null}
            </div>
            {actionError ? (
              <p className="form-alert">
                {actionError instanceof ApiClientError ? actionError.message : 'The action failed.'}
              </p>
            ) : null}
          </section>
          <section className="content-card moderation-history-card">
            <h2>Review history</h2>
            <div className="moderation-timeline">
              {value.moderationHistory.map((item) => (
                <article key={item.id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{item.action.replaceAll('_', ' ')}</strong>
                    <p>
                      {item.fromStatus ? `${item.fromStatus.replaceAll('_', ' ')} → ` : ''}
                      {item.toStatus.replaceAll('_', ' ')}
                    </p>
                    {item.reason ? <blockquote>{item.reason}</blockquote> : null}
                    <small>
                      {new Date(item.createdAt).toLocaleString()}
                      {item.actor ? ` · ${item.actor.displayName}` : ''}
                    </small>
                  </div>
                </article>
              ))}
              {!value.moderationHistory.length ? (
                <div className="catalog-empty compact">
                  <PackageIcon />
                  <span>No history yet.</span>
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}
