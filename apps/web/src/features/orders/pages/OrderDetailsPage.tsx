import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeftIcon, MessageIcon, PackageIcon } from '../../../components/ui/icons'
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton'
import { ordersApi } from '../api/orders.api'
import { OrderStatusBadge } from '../components/OrderStatusBadge'
import { useConfirmation } from '../../../components/feedback/ConfirmationProvider'

function price(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}
const cancellable = ['PENDING', 'WAITING_FOR_DEALER_ASSIGNMENT', 'AWAITING_TEAM_CONFIRMATION']

export function OrderDetailsPage() {
  const { id = '' } = useParams()
  const client = useQueryClient()
  const confirm = useConfirmation()
  const order = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.detail(id),
    enabled: Boolean(id),
  })
  const cancel = useMutation({
    mutationFn: () => ordersApi.cancel(id, { reason: 'Cancelled from My Orders' }),
    onSuccess: (data) => {
      client.setQueryData(['order', id], data)
      void client.invalidateQueries({ queryKey: ['orders'] })
    },
  })
  if (order.isLoading) return <LoadingSkeleton variant="detail" label="Loading order" />
  if (!order.data || order.isError)
    return (
      <div className="catalog-empty compact-empty">
        <PackageIcon />
        <strong>Order unavailable</strong>
        <Link className="button button-primary" to="/account/orders">
          Back to orders
        </Link>
      </div>
    )
  const data = order.data
  return (
    <div>
      <Link className="back-link" to="/account/orders">
        <ChevronLeftIcon /> My orders
      </Link>
      <div className="order-detail-head">
        <div>
          <span className="section-kicker">{data.orderNumber}</span>
          <h1>Order details</h1>
          <p>Created {new Date(data.createdAt).toLocaleString('en-IN')}</p>
        </div>
        <OrderStatusBadge status={data.status} />
      </div>
      <div className="order-detail-grid">
        <div className="order-detail-main">
          <section className="detail-panel">
            <h2>Products</h2>
            {data.items.map((item) => (
              <div className="order-item-row" key={item.id}>
                {item.productImageUrl ? <img src={item.productImageUrl} alt="" /> : <PackageIcon />}
                <div>
                  <Link to={`/products/${item.productSlug}`}>
                    <strong>{item.productName}</strong>
                  </Link>
                  <small>
                    {item.productType === 'NEW' ? 'Official' : 'Second-hand'} · Quantity{' '}
                    {item.quantity}
                  </small>
                </div>
                <span>{price(item.totalPrice)}</span>
              </div>
            ))}
            <div className="summary-total">
              <span>Total</span>
              <strong>{price(data.totalAmount)}</strong>
            </div>
          </section>
          <section className="detail-panel">
            <h2>Status timeline</h2>
            <div className="status-timeline">
              {data.statusHistory.map((entry) => (
                <div key={entry.id}>
                  <span />
                  <div>
                    <strong>{entry.toStatus.replaceAll('_', ' ')}</strong>
                    <small>{new Date(entry.createdAt).toLocaleString('en-IN')}</small>
                    {entry.note ? <p>{entry.note}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="order-detail-side">
          <section className="detail-panel">
            <h2>Pickup details</h2>
            <dl>
              <div>
                <dt>Name</dt>
                <dd>{data.fullName}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{data.phoneNumber}</dd>
              </div>
              <div>
                <dt>Pickup</dt>
                <dd>{data.pickupLocation}</dd>
              </div>
              {data.department ? (
                <div>
                  <dt>Department</dt>
                  <dd>{data.department}</dd>
                </div>
              ) : null}
              {data.building ? (
                <div>
                  <dt>Building</dt>
                  <dd>{data.building}</dd>
                </div>
              ) : null}
              {data.preferredPickupTime ? (
                <div>
                  <dt>Preferred time</dt>
                  <dd>{data.preferredPickupTime}</dd>
                </div>
              ) : null}
            </dl>
          </section>
          <section className="detail-panel chat-assistance-panel">
            <h2>Sales assistance</h2>
            {data.assignedDealer ? (
              <>
                <div className="assigned-dealer-row">
                  <MessageIcon />
                  <div>
                    <strong>{data.assignedDealer.displayName}</strong>
                    <small>Your assigned Campus Angadi dealer</small>
                  </div>
                </div>
                <p>
                  Chat privately with our team about availability, payment and campus pickup. The
                  seller is never added to this conversation.
                </p>
                <Link className="button button-primary" to={`/account/orders/${id}/chat`}>
                  <MessageIcon />
                  Open secure chat
                </Link>
              </>
            ) : (
              <p>
                No dealer is available yet. Your order is saved safely and the administration can
                assign a sales contact shortly.
              </p>
            )}
          </section>
          {cancellable.includes(data.status) ? (
            <button
              className="button button-outline danger-text"
              disabled={cancel.isPending}
              onClick={async () => {
                if (await confirm({ title: 'Cancel this order?', description: 'The Campus Angadi team will stop processing this order and reserved stock may be released.', confirmLabel: 'Cancel order', tone: 'danger' })) cancel.mutate()
              }}
            >
              {cancel.isPending ? 'Cancelling…' : 'Cancel order'}
            </button>
          ) : null}
          {cancel.isError ? <div className="form-error">{cancel.error.message}</div> : null}
        </aside>
      </div>
    </div>
  )
}
