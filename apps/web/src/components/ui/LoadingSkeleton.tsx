type SkeletonVariant = 'page' | 'detail' | 'dashboard'

export function LoadingSkeleton({
  variant = 'page',
  label = 'Loading content',
}: {
  variant?: SkeletonVariant
  label?: string
}) {
  if (variant === 'dashboard') {
    return (
      <div className="loading-skeleton loading-skeleton-dashboard" role="status" aria-label={label}>
        <span className="skeleton-line skeleton-title" />
        <span className="skeleton-line skeleton-copy" />
        <div className="skeleton-metric-grid">
          {Array.from({ length: 6 }, (_, index) => (
            <span className="skeleton-block skeleton-metric" key={index} />
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'detail') {
    return (
      <div className="loading-skeleton loading-skeleton-detail" role="status" aria-label={label}>
        <span className="skeleton-block skeleton-hero" />
        <div>
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-copy" />
          <span className="skeleton-line skeleton-copy short" />
          <span className="skeleton-block skeleton-action" />
        </div>
      </div>
    )
  }

  return (
    <div className="loading-skeleton" role="status" aria-label={label}>
      <span className="skeleton-line skeleton-title" />
      <span className="skeleton-line skeleton-copy" />
      <span className="skeleton-block skeleton-panel" />
      <span className="skeleton-block skeleton-panel" />
    </div>
  )
}
