import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { checkoutInputSchema, type CheckoutInput } from '@campusbaza/contracts'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { AlertIcon, CartIcon, ShieldIcon } from '../../../components/ui/icons'
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton'
import { useAuthStore } from '../../auth/store/use-auth-store'
import { cartApi } from '../../cart/api/cart.api'
import { ordersApi } from '../api/orders.api'
import { useConfirmation } from '../../../components/feedback/ConfirmationProvider'

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
  const cart = useQuery({ queryKey: ['cart'], queryFn: cartApi.get })
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
    mutationFn: ordersApi.checkout,
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ['cart'] })
      await client.invalidateQueries({ queryKey: ['orders'] })
      void navigate(`/account/orders?created=${encodeURIComponent(result.checkoutGroupId)}`)
    },
  })
  if (cart.isLoading)
    return (
      <section className="section">
        <div className="container">
          <LoadingSkeleton label="Preparing checkout" />
        </div>
      </section>
    )
  if (!cart.data?.items.length) {
    return (
      <section className="section">
        <div className="container catalog-empty">
          <CartIcon />
          <strong>Your cart is empty</strong>
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
          {cart.data.issues.length ? (
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
            onSubmit={(event) => void form.handleSubmit(async (values) => {
              if (await confirm({ title: 'Place this order?', description: `You are placing ${cart.data.items.length} cart item${cart.data.items.length === 1 ? '' : 's'} for ${price(cart.data.subtotal)}. Campus Angadi will coordinate pickup through your mediator.`, confirmLabel: 'Place order' })) checkout.mutate(values)
            })(event)}
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
              disabled={checkout.isPending || Boolean(cart.data.issues.length)}
            >
              {checkout.isPending
                ? 'Creating secure orders…'
                : `Create order · ${price(cart.data.subtotal)}`}
            </button>
          </form>
        </div>
        <aside className="checkout-items-card">
          <span className="section-kicker">Review</span>
          <h2>{cart.data.totalItems} items</h2>
          {cart.data.items.map((item) => (
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
            <strong>{price(cart.data.subtotal)}</strong>
          </div>
        </aside>
      </div>
    </section>
  )
}
