import type { ProductSummary } from '@campusbaza/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CartIcon, PackageIcon } from '../../../components/ui/icons'
import { useAuthStore } from '../../auth/store/use-auth-store'
import { cartApi } from '../../cart/api/cart.api'

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

function conditionLabel(value: ProductSummary['condition']) {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function ProductCard({ product }: { product: ProductSummary }) {
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const client = useQueryClient()
  const [added, setAdded] = useState(false)
  const add = useMutation({
    mutationFn: () => cartApi.add({ productId: product.id, quantity: 1 }),
    onSuccess(data) {
      client.setQueryData(['cart'], data)
      setAdded(true)
      window.setTimeout(() => setAdded(false), 1600)
    },
  })
  const discount =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : null
  function addToCart() {
    if (!user) {
      void navigate(`/login?returnTo=${encodeURIComponent(`/products/${product.slug}`)}`)
      return
    }
    add.mutate()
  }
  return (
    <article className="catalog-card">
      <Link
        to={`/products/${product.slug}`}
        className="catalog-card-media"
        aria-label={`View ${product.title}`}
      >
        {product.primaryImage ? (
          <img
            src={product.primaryImage.url}
            alt={product.primaryImage.altText || product.title}
            loading="lazy"
          />
        ) : (
          <div className="catalog-image-fallback">
            <PackageIcon />
            <span>No image</span>
          </div>
        )}
        <div className="catalog-card-badges">
          <span
            className={`product-pill ${product.sellerType === 'ADMIN' ? 'official' : 'second-hand'}`}
          >
            {product.sellerType === 'ADMIN' ? 'Official' : 'Second-Hand'}
          </span>
          <span className="product-pill condition">{conditionLabel(product.condition)}</span>
        </div>
        {discount ? <span className="discount-badge">-{discount}%</span> : null}
      </Link>
      <div className="catalog-card-body">
        <span className="catalog-category">{product.category.name}</span>
        <Link to={`/products/${product.slug}`} className="catalog-card-title">
          {product.title}
        </Link>
        <div className="catalog-price-row">
          <strong>{formatPrice(product.price)}</strong>
          {product.originalPrice ? <del>{formatPrice(product.originalPrice)}</del> : null}
        </div>
        <div className="catalog-meta-row">
          <span>{product.stock} available</span>
          <span>{product.viewCount} views</span>
        </div>
        <div className="catalog-card-actions">
          <Link className="button button-outline" to={`/products/${product.slug}`}>
            View
          </Link>
          <button className="button button-primary" disabled={add.isPending} onClick={addToCart}>
            <CartIcon /> {added ? 'Added' : add.isPending ? 'Adding…' : 'Add'}
          </button>
        </div>
        {add.isError ? <small className="card-action-error">{add.error.message}</small> : null}
      </div>
    </article>
  )
}
