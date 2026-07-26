import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { checkoutInputSchema, type CheckoutInput } from '@campusbaza/contracts'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertIcon, CartIcon, ShieldIcon } from '../../../components/ui/icons'
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton'
import { useAuthStore } from '../../auth/store/use-auth-store'
import { cartApi } from '../../cart/api/cart.api'
import { ordersApi } from '../api/orders.api'
import { useConfirmation } from '../../../components/feedback/confirmation-context'
import { queryKeys } from '../../../lib/query-keys'
import { catalogApi } from '../../products/api/catalog.api'

function price(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function CheckoutPage() {
  const navigate = useNavigate()
  const client = useQueryClient()
  const confirm = useConfirmation()
  const user = useAuthStore((state) => state.user)
  const [searchParams] = useSearchParams()
  const buyNowSlug = searchParams.get('buyNow')?.trim() || null
  const requestedQuantity = Number(searchParams.get('quantity') ?? 1)
  const quantity = Number.isInteger(requestedQuantity)
    ? Math.min(Math.max(requestedQuantity, 1), 20)
    : 1
  const cart = useQuery({
    queryKey: queryKeys.cart(user?.id ?? ''),
    queryFn: cartApi.get,
    enabled: !buyNowSlug,
  })
  const buyNowProduct = useQuery({
    queryKey: queryKeys.product(buyNowSlug ?? ''),
    queryFn: () => catalogApi.product(buyNowSlug!),
    enabled: Boolean(buyNowSlug),
  })
  const form = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutInputSchema),
    defaultValues: {
      fullName: user?.profile.fullName ?? user?.profile.displayName ?? '',
      phoneNumber: user?.profile.phoneNumber ?? '',
      campusId: null,
      department: user?.profile.department ?? null,
      building: null,
      pickupLocation: user?.profile.preferredPickupLocation ?? '',
      preferredPickupTime: null,
      notes: null,
    },
  })
  const checkout = useMutation({
    mutationFn: (values: CheckoutInput) => {
      if (buyNowSlug && buyNowProduct.data) {
        return ordersApi.buyNow({
          ...values,
          productId: buyNowProduct.data.id,
          quantity,
        })
      }
      return ordersApi.checkout(values)
    },
    onSuccess: async (result) => {
      if (!buyNowSlug) {
        await client.invalidateQueries({ queryKey: queryKeys.cart(user?.id ?? '') })
      }
      await client.invalidateQueries({ queryKey: queryKeys.orders.all(user?.id ?? '') })
      void navigate(`/account/orders?created=${encodeURIComponent(result.checkoutGroupId)}`)
    },
  })
  const loading = buyNowSlug ? buyNowProduct.isLoading : cart.isLoading
  const loadError = buyNowSlug ? buyNowProduct.isError : cart.isError
  const checkoutItems = buyNowSlug
    ? buyNowProduct.data
      ? [
          {
            product: buyNowProduct.data,
            quantity,
            lineTotal: buyNowProduct.data.price * quantity,
          },
        ]
      : []
    : (cart.data?.items ?? [])
  const issues = buyNowSlug ? [] : (cart.data?.issues ?? [])
  const subtotal = checkoutItems.reduce((total, item) => total + item.lineTotal, 0)
  const totalItems = checkoutItems.reduce((total, item) => total + item.quantity, 0)

  if (loading)
    return (
      <section className="section">
        <div className="container">
          <LoadingSkeleton label="Preparing checkout" />
        </div>
      </section>
    )
  if (loadError || !checkoutItems.length || (buyNowProduct.data?.stock ?? quantity) < quantity) {
    return (
      <section className="section">
        <div className="container catalog-empty">
          <CartIcon />
          <strong>{buyNowSlug ? 'Product unavailable' : 'Your cart is empty'}</strong>
          <span>
            {buyNowSlug
              ? 'This product cannot be purchased in the selected quantity.'
              : 'Add a product before continuing to checkout.'}
          </span>
          <Link className="button button-primary" to="/">
            Choose a store
          </Link>
        </div>
      </section>
    )
  }
  return (
    <section className="section">
      <div className="container checkout-grid">
        <div>
          <span className="section-kicker">Order details</span>
          <h1>Checkout</h1>
          <p className="page-lead">
            Confirm your campus contact and pickup details. Products from different sellers become
            separate orders, each coordinated privately by a Campus Angadi team member.
          </p>
          {issues.length ? (
            <div className="cart-issues">
              <AlertIcon />
              <div>
                <strong>Return to cart first</strong>
                <p>One or more items changed and must be reviewed.</p>
              </div>
            </div>
          ) : null}
          <form
            className="checkout-form"
            onSubmit={(event) =>
              void form.handleSubmit(async (values) => {
                if (
                  await confirm({
                    title: 'Place this order?',
                    description: `You are placing ${totalItems} item${totalItems === 1 ? '' : 's'} for ${price(subtotal)}. Campus Angadi will coordinate pickup through your mediator.`,
                    confirmLabel: 'Place order',
                  })
                )
                  checkout.mutate(values)
              })(event)
            }
          >
            <label>
              Full name
              <input {...form.register('fullName')} />
              {form.formState.errors.fullName ? (
                <small>{form.formState.errors.fullName.message}</small>
              ) : null}
            </label>
            <label>
              Phone number
              <input {...form.register('phoneNumber')} />
              {form.formState.errors.phoneNumber ? (
                <small>{form.formState.errors.phoneNumber.message}</small>
              ) : null}
            </label>
            <label>
              Campus ID, optional
              <input {...form.register('campusId')} />
            </label>
            <label>
              Department, optional
              <input {...form.register('department')} />
            </label>
            <label>
              Building, optional
              <input {...form.register('building')} />
            </label>
            <label className="form-span">
              Pickup location
              <input {...form.register('pickupLocation')} />
              {form.formState.errors.pickupLocation ? (
                <small>{form.formState.errors.pickupLocation.message}</small>
              ) : null}
            </label>
            <label>
              Preferred pickup time, optional
              <input
                placeholder="Example: Today after 4 PM"
                {...form.register('preferredPickupTime')}
              />
            </label>
            <label className="form-span">
              Notes, optional
              <textarea rows={4} {...form.register('notes')} />
            </label>
            {checkout.isError ? (
              <div className="form-error form-span">{checkout.error.message}</div>
            ) : null}
            <div className="checkout-security form-span">
              <ShieldIcon />
              <div>
                <strong>Backend-verified checkout</strong>
                <p>
                  Prices, seller eligibility and available stock are checked again before any order
                  is saved.
                </p>
              </div>
            </div>
            <button
              className="button button-primary form-span"
              disabled={checkout.isPending || Boolean(issues.length)}
            >
              {checkout.isPending ? 'Creating secure orders…' : `Create order · ${price(subtotal)}`}
            </button>
          </form>
        </div>
        <aside className="checkout-items-card">
          <span className="section-kicker">Review</span>
          <h2>{totalItems} items</h2>
          {checkoutItems.map((item) => (
            <div className="checkout-mini-item" key={item.product.id}>
              {item.product.primaryImage ? (
                <img src={item.product.primaryImage.url} alt="" />
              ) : (
                <CartIcon />
              )}
              <div>
                <strong>{item.product.title}</strong>
                <small>
                  {item.quantity} × {price(item.product.price)}
                </small>
              </div>
              <span>{price(item.lineTotal)}</span>
            </div>
          ))}
          <div className="summary-total">
            <span>Total</span>
            <strong>{price(subtotal)}</strong>
          </div>
        </aside>
      </div>
    </section>
  )
}
