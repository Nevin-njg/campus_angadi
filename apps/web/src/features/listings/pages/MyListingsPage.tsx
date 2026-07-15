import type { ProductStatus } from '@campusbaza/contracts'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PackageIcon } from '../../../components/ui/icons'
import { listingsApi } from '../api/listings.api'
import { ListingStatusBadge } from '../components/ListingStatusBadge'

const filters: Array<{ value: '' | ProductStatus; label: string }> = [
  { value: '', label: 'All active' },
  { value: 'PENDING_APPROVAL', label: 'Pending review' },
  { value: 'CHANGES_REQUESTED', label: 'Changes requested' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'HIDDEN', label: 'Hidden' },
  { value: 'SOLD', label: 'Sold' },
]

export function MyListingsPage() {
  const [status, setStatus] = useState<'' | ProductStatus>('')
  const [search, setSearch] = useState('')
  const listings = useQuery({
    queryKey: ['my-listings', status, search],
    queryFn: () =>
      listingsApi.list({
        ...(status ? { status } : {}),
        ...(search ? { q: search } : {}),
        limit: 24,
      }),
  })

  return (
    <section>
      <div className="page-heading listing-page-heading">
        <div>
          <span className="section-kicker">Seller account</span>
          <h1>My listings</h1>
          <p>Track approvals, review admin feedback and manage your second-hand products.</p>
        </div>
        <Link className="button button-primary" to="/account/listings/new">
          Sell an item
        </Link>
      </div>

      <div className="listing-toolbar content-card">
        <input
          type="search"
          placeholder="Search your listings"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as '' | ProductStatus)}
        >
          {filters.map((filter) => (
            <option key={filter.value || 'all'} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>
      </div>

      {listings.isLoading ? <div className="content-card">Loading your listings…</div> : null}
      {listings.isError ? (
        <div className="form-alert">Your listings could not be loaded.</div>
      ) : null}
      <div className="my-listing-grid">
        {(listings.data?.items ?? []).map((listing) => (
          <article className="my-listing-card" key={listing.id}>
            <Link to={`/account/listings/${listing.id}`} className="my-listing-image">
              {listing.primaryImage ? (
                <img
                  src={listing.primaryImage.url}
                  alt={listing.primaryImage.altText || listing.title}
                />
              ) : (
                <span className="listing-image-fallback">
                  <PackageIcon />
                </span>
              )}
            </Link>
            <div className="my-listing-body">
              <div className="my-listing-topline">
                <ListingStatusBadge status={listing.status} />
                <span>{new Date(listing.createdAt).toLocaleDateString()}</span>
              </div>
              <Link to={`/account/listings/${listing.id}`}>
                <h2>{listing.title}</h2>
              </Link>
              <p>
                {listing.category.name} · {listing.condition.replaceAll('_', ' ')}
              </p>
              <strong>₹{listing.price.toLocaleString('en-IN')}</strong>
              <div className="my-listing-actions">
                <Link className="button button-outline" to={`/account/listings/${listing.id}`}>
                  View
                </Link>
                {[
                  'DRAFT',
                  'PENDING_APPROVAL',
                  'CHANGES_REQUESTED',
                  'REJECTED',
                  'APPROVED',
                ].includes(listing.status) ? (
                  <Link
                    className="button button-outline"
                    to={`/account/listings/${listing.id}/edit`}
                  >
                    Edit
                  </Link>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!listings.isLoading && !listings.data?.items.length ? (
        <div className="catalog-empty content-card">
          <PackageIcon />
          <strong>No listings found</strong>
          <span>Submit your first second-hand product for admin approval.</span>
          <Link className="button button-primary" to="/account/listings/new">
            Sell an item
          </Link>
        </div>
      ) : null}
    </section>
  )
}
