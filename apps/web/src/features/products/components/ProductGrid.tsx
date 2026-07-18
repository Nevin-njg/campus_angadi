import type { ProductSummary } from '@campusbaza/contracts'
import { PackageIcon } from '../../../components/ui/icons'
import { ProductCard } from './ProductCard'

export function ProductGrid({
  products,
  emptyMessage = 'No products found.',
}: {
  products: ProductSummary[]
  emptyMessage?: string
}) {
  if (!products.length) {
    return (
      <div className="catalog-empty">
        <PackageIcon />
        <strong>{emptyMessage}</strong>
        <span>Try another category or search.</span>
      </div>
    )
  }
  return (
    <div className="catalog-grid" aria-live="polite">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}

export function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="catalog-grid" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading products</span>
      {Array.from({ length: count }, (_, index) => (
        <div className="catalog-card catalog-skeleton" key={index} aria-hidden="true">
          <div className="catalog-card-media" />
          <div className="catalog-card-body">
            <span />
            <span />
            <span />
          </div>
        </div>
      ))}
    </div>
  )
}
