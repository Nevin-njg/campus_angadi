import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertIcon, CartIcon, TrashIcon } from '../../../components/ui/icons'
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton'
import { cartApi } from '../api/cart.api'
import { useConfirmation } from '../../../components/feedback/confirmation-context'
import { queryKeys } from '../../../lib/query-keys'
import { useAuthStore } from '../../auth/store/use-auth-store'

function price(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function CartPage() {
  const client = useQueryClient()
  const confirm = useConfirmation()
  const user = useAuthStore((state) => state.user)!
  const cart = useQuery({ queryKey: queryKeys.cart(user.id), queryFn: cartApi.get })
  const refresh = (data: Awaited<ReturnType<typeof cartApi.get>>) => {
    client.setQueryData(queryKeys.cart(user.id), data)
  }
  const update = useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) =>
      cartApi.update(productId, { quantity }),
    onSuccess: refresh,
  })
  const remove = useMutation({ mutationFn: cartApi.remove, onSuccess: refresh })
  const review = useMutation({ mutationFn: cartApi.review, onSuccess: refresh })
  const clear = useMutation({ mutationFn: cartApi.clear, onSuccess: refresh })

  if (cart.isLoading) {
    return (
      <section className="section">
        <div className="container">
          <LoadingSkeleton label="Loading cart" />
        </div>
      </section>
    )
  }
  if (!cart.data || cart.isError) {
    return (
      <section className="section">
        <div className="container catalog-empty">
          <CartIcon />
          <strong>Cart unavailable</strong>
          <span>Refresh the page and try again.</span>
        </div>
      </section>
    )
  }
  const data = cart.data
  if (!data.items.length) {
    return (
      <section className="section">
        <div className="container catalog-empty cart-empty">
          <CartIcon />
          <strong>Your cart is empty</strong>
          <span>Choose a store and add something you need.</span>
          <Link className="button button-primary" to="/">
            Choose a store
          </Link>
        </div>
      </section>
    )
  }
  const busy = update.isPending || remove.isPending || review.isPending || clear.isPending
  return (
    <section className="section">
      <div className="container cart-page-grid">
        <div>
          <div className="page-title-row">
            <div>
              <span className="section-kicker">Your basket</span>
              <h1>Cart</h1>
            </div>
            <button
              className="button button-ghost danger-text"
              disabled={busy}
              onClick={async () => {
                if (
                  await confirm({
                    title: 'Clear your cart?',
                    description: 'Every item currently in your cart will be removed.',
                    confirmLabel: 'Clear cart',
                    tone: 'danger',
                  })
                )
                  clear.mutate()
              }}
            >
              <TrashIcon /> Clear cart
            </button>
          </div>
          {data.issues.length ? (
            <div className="cart-issues">
              <AlertIcon />
              <div>
                <strong>Review your cart</strong>
                {data.issues.map((issue) => (
                  <p key={`${issue.productId}-${issue.code}`}>{issue.message}</p>
                ))}
                <button
                  className="button button-outline cart-review-button"
                  disabled={review.isPending}
                  onClick={() => review.mutate()}
                >
                  {review.isPending ? 'Applying…' : 'Accept current prices and availability'}
                </button>
              </div>
            </div>
          ) : null}
          <div className="cart-list">
            {data.items.map((item) => (
              <article className="cart-line" key={item.product.id}>
                <Link to={`/products/${item.product.slug}`} className="cart-line-image">
                  {item.product.primaryImage ? (
                    <img
                      src={item.product.primaryImage.url}
                      alt={item.product.primaryImage.altText || item.product.title}
                    />
                  ) : (
                    <CartIcon />
                  )}
                </Link>
                <div className="cart-line-copy">
                  <span className="catalog-category">{item.product.category.name}</span>
                  <Link to={`/products/${item.product.slug}`}>
                    <strong>{item.product.title}</strong>
                  </Link>
                  <small>
                    {item.product.sellerType === 'ADMIN' ? 'Official product' : 'Second-hand'} ·{' '}
                    {item.product.stock} available
                  </small>
                </div>
                <div className="quantity-control" aria-label={`Quantity for ${item.product.title}`}>
                  <button
                    disabled={busy || item.quantity <= 1}
                    onClick={() =>
                      update.mutate({ productId: item.product.id, quantity: item.quantity - 1 })
                    }
                  >
                    −
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    disabled={busy || item.quantity >= item.product.stock || item.quantity >= 20}
                    onClick={() =>
                      update.mutate({ productId: item.product.id, quantity: item.quantity + 1 })
                    }
                  >
                    +
                  </button>
                </div>
                <div className="cart-line-price">
                  <strong>{price(item.lineTotal)}</strong>
                  <small>{price(item.product.price)} each</small>
                </div>
                <button
                  className="icon-button cart-remove"
                  disabled={busy}
                  onClick={() => remove.mutate(item.product.id)}
                  aria-label={`Remove ${item.product.title}`}
                >
                  <TrashIcon />
                </button>
              </article>
            ))}
          </div>
        </div>
        <aside className="order-summary-card">
          <span className="section-kicker">Summary</span>
          <h2>Order total</h2>
          <div>
            <span>Items</span>
            <strong>{data.totalItems}</strong>
          </div>
          <div>
            <span>Subtotal</span>
            <strong>{price(data.subtotal)}</strong>
          </div>
          <div className="summary-total">
            <span>Total</span>
            <strong>{price(data.subtotal)}</strong>
          </div>
          <p>
            No online payment is collected. Final payment and pickup are handled offline after order
            creation.
          </p>
          <Link
            className={`button button-primary ${data.issues.length ? 'disabled-link' : ''}`}
            aria-disabled={Boolean(data.issues.length)}
            to={data.issues.length ? '#' : '/checkout'}
          >
            Proceed to checkout
          </Link>
          <Link className="button button-outline" to="/">
            Continue shopping
          </Link>
        </aside>
      </div>
    </section>
  )
}
