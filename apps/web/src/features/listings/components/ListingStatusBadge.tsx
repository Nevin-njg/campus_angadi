import type { ProductStatus } from '@campusbaza/contracts'

const labels: Record<ProductStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending review',
  CHANGES_REQUESTED: 'Changes requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  HIDDEN: 'Hidden',
  SOLD: 'Sold',
  OUT_OF_STOCK: 'Out of stock',
  DELETED: 'Deleted',
}

export function ListingStatusBadge({ status }: { status: ProductStatus }) {
  return <span className={`listing-status status-${status.toLowerCase()}`}>{labels[status]}</span>
}
