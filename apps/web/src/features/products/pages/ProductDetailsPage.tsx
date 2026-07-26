import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CartIcon, PackageIcon, ShieldIcon } from '../../../components/ui/icons'
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton'
import { useAuthStore } from '../../auth/store/use-auth-store'
import { cartApi } from '../../cart/api/cart.api'
import { catalogApi } from '../api/catalog.api'
import { queryKeys } from '../../../lib/query-keys'

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function ProductDetailsPage() {
  const { slug = '' } = useParams()
  const [quantity, setQuantity] = useState(1)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const client = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.product(slug),
    queryFn: () => catalogApi.product(slug),
    enabled: Boolean(slug),
  })
  const add = useMutation({
    mutationFn: ({ productId }: { productId: string }) => cartApi.add({ productId, quantity }),
    onSuccess(data) {
      client.setQueryData(queryKeys.cart(user!.id), data)
    },
  })
  if (query.isLoading)
    return (
      <section className="section">
        <div className="container">
          <LoadingSkeleton variant="detail" label="Loading product" />
        </div>
      </section>
    )
  if (!query.data || query.isError)
    return (
      <section className="section">
        <div className="container catalog-empty">
          <PackageIcon />
          <strong>Product unavailable</strong>
          <span>This listing may have been removed, sold or hidden.</span>
          <Link className="button button-primary" to="/">
            Back to stores
          </Link>
        </div>
      </section>
    )
  const product = query.data
  const primary = product.images.find((image) => image.isPrimary) ?? product.images[0]
  const selectedImage = product.images.find((image) => image.id === selectedImageId) ?? primary
  function addToCart() {
    if (!user) {
      void navigate(`/login?returnTo=${encodeURIComponent(`/products/${product.slug}`)}`)
      return
    }
    add.mutate({ productId: product.id })
  }
  function buyNow() {
    const checkoutPath = `/checkout?buyNow=${encodeURIComponent(product.slug)}&quantity=${quantity}`
    if (!user) {
      void navigate(`/login?returnTo=${encodeURIComponent(checkoutPath)}`)
      return
    }
    void navigate(checkoutPath)
  }
  return (
    <section className="section">
      <div className="container product-detail-grid">
        <div className="product-gallery">
          {selectedImage ? (
            <img src={selectedImage.url} alt={selectedImage.altText || product.title} />
          ) : (
            <div className="catalog-image-fallback">
              <PackageIcon />
              <span>No image available</span>
            </div>
          )}
          {product.images.length > 1 ? (
            <div className="product-thumbnails">
              {product.images.map((image) => (
                <button
                  className={selectedImage?.id === image.id ? 'active' : ''}
                  key={image.id}
                  type="button"
                  onClick={() => setSelectedImageId(image.id)}
                  aria-label={`Show image: ${image.altText || product.title}`}
                  aria-pressed={selectedImage?.id === image.id}
                >
                  <img src={image.url} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="product-detail-copy">
          <div className="product-detail-badges">
            <span
              className={`product-pill ${product.sellerType === 'ADMIN' ? 'official' : 'second-hand'}`}
            >
              {product.sellerType === 'ADMIN' ? 'Official' : 'Second-Hand'}
            </span>
            <span className="product-pill condition">{product.condition.replaceAll('_', ' ')}</span>
          </div>
          <span className="catalog-category">{product.category.name}</span>
          <h1>{product.title}</h1>
          <div className="product-detail-price">
            <strong>{formatPrice(product.price)}</strong>
            {product.originalPrice ? <del>{formatPrice(product.originalPrice)}</del> : null}
          </div>
          <p>{product.description}</p>
          <dl className="product-facts">
            <div>
              <dt>Availability</dt>
              <dd>{product.stock} in stock</dd>
            </div>
            <div>
              <dt>Pickup</dt>
              <dd>{product.pickupLocation ?? 'Campus pickup'}</dd>
            </div>
            <div>
              <dt>Views</dt>
              <dd>{product.viewCount}</dd>
            </div>
            {product.seller ? (
              <div>
                <dt>Seller</dt>
                <dd>
                  {product.seller.displayName} {product.seller.verified ? '✓' : ''}
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="product-notice">
            <ShieldIcon />
            <div>
              <strong>Secure stock validation</strong>
              <p>
                The current price, listing status and available stock are checked again during
                checkout.
              </p>
            </div>
          </div>
          <div className="product-purchase-row">
            <div className="quantity-control large">
              <button disabled={quantity <= 1} onClick={() => setQuantity((value) => value - 1)}>
                −
              </button>
              <span>{quantity}</span>
              <button
                disabled={quantity >= Math.min(product.stock, 20)}
                onClick={() => setQuantity((value) => value + 1)}
              >
                +
              </button>
            </div>
            <button className="button button-primary" disabled={add.isPending} onClick={addToCart}>
              <CartIcon />
              {add.isPending ? 'Adding…' : 'Add to cart'}
            </button>
            <button className="button button-outline" disabled={product.stock < 1} onClick={buyNow}>
              Buy now
            </button>
          </div>
          {add.isSuccess ? (
            <div className="success-inline">
              Added to cart. <Link to="/cart">View cart</Link>
            </div>
          ) : null}
          {add.isError ? <div className="form-error">{add.error.message}</div> : null}
          {user ? (
            <Link
              className="report-link"
              to={`/account/reports?targetType=PRODUCT&targetId=${product.id}`}
            >
              Report this product
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  )
}
