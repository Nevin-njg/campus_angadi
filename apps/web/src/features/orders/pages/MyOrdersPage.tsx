import type { OrderStatus } from '@campusbaza/contracts'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { PackageIcon } from '../../../components/ui/icons'
import { ordersApi } from '../api/orders.api'
import { OrderStatusBadge } from '../components/OrderStatusBadge'
import { queryKeys } from '../../../lib/query-keys'
import { useAuthStore } from '../../auth/store/use-auth-store'

function price(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function MyOrdersPage() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') || undefined) as OrderStatus | undefined
  const page = Number(params.get('page') || 1)
  const user = useAuthStore((state) => state.user)!
  const orders = useQuery({
    queryKey: queryKeys.orders.list(user.id, status, page),
    queryFn: () => ordersApi.mine({ status, page, limit: 10 }),
  })
  const created = params.get('created')
  return (
    <div>
      <div className="page-title-row">
        <div>
          <h1>Orders</h1>
        </div>
        <Link className="button button-primary" to="/search">
          Continue shopping
        </Link>
      </div>
      {created ? (
        <div className="success-banner">
          <strong>Order placed successfully.</strong>
          <span>You can track each seller order here.</span>
        </div>
      ) : null}
      <div className="order-filter-row">
        <button className={!status ? 'active' : ''} onClick={() => setParams({})}>
          All
        </button>
        {(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'REJECTED'] as OrderStatus[]).map(
          (value) => (
            <button
              key={value}
              className={status === value ? 'active' : ''}
              onClick={() => setParams({ status: value })}
            >
              {value
                .replaceAll('_', ' ')
                .toLowerCase()
                .replace(/^./, (letter) => letter.toUpperCase())}
            </button>
          ),
        )}
      </div>
      {orders.isLoading ? <div className="panel-loading">Loading orders…</div> : null}
      {orders.isError ? <div className="form-error">{orders.error.message}</div> : null}
      {orders.data && !orders.data.items.length ? (
        <div className="catalog-empty compact-empty">
          <PackageIcon />
          <strong>No orders found</strong>
          <span>Your completed checkouts will appear here.</span>
        </div>
      ) : null}
      <div className="orders-list">
        {orders.data?.items.map((order) => (
          <Link to={`/account/orders/${order.id}`} className="order-card" key={order.id}>
            <div className="order-card-head">
              <div>
                <small>{order.orderNumber}</small>
                <strong>
                  {new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                </strong>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>
            <div className="order-card-products">
              {order.productPreview.map((item) => (
                <div key={item.id}>
                  {item.productImageUrl ? (
                    <img src={item.productImageUrl} alt="" />
                  ) : (
                    <PackageIcon />
                  )}
                  <span>
                    {item.productName}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                  </span>
                </div>
              ))}
            </div>
            <div className="order-card-foot">
              <span>
                {order.sellerType === 'ADMIN' ? 'Official store' : 'Second-hand seller'} ·{' '}
                {order.itemCount} items
              </span>
              <strong>{price(order.totalAmount)}</strong>
            </div>
          </Link>
        ))}
      </div>
      {orders.data && orders.data.meta.totalPages > 1 ? (
        <div className="pagination">
          <button
            disabled={page <= 1}
            onClick={() => setParams({ ...(status ? { status } : {}), page: String(page - 1) })}
          >
            Previous
          </button>
          <span>
            Page {page} of {orders.data.meta.totalPages}
          </span>
          <button
            disabled={page >= orders.data.meta.totalPages}
            onClick={() => setParams({ ...(status ? { status } : {}), page: String(page + 1) })}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  )
}
