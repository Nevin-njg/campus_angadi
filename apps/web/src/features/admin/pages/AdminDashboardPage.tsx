import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton'
import {
  AlertIcon,
  ArrowRightIcon,
  CartIcon,
  CheckCircleIcon,
  MessageIcon,
  PackageIcon,
  ShieldIcon,
  UserIcon,
} from '../../../components/ui/icons'
import { adminPlatformApi } from '../api/admin-platform.api'

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`

export function AdminDashboardPage() {
  const q = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: adminPlatformApi.dashboard })
  const d = q.data

  if (q.isLoading) return <LoadingSkeleton variant="dashboard" label="Loading dashboard" />
  if (!d) {
    return (
      <div className="admin-empty-state">
        <AlertIcon />
        <strong>Dashboard unavailable</strong>
        <p>We could not load marketplace metrics. Refresh the page to try again.</p>
        <button className="button button-primary" onClick={() => void q.refetch()}>
          Retry
        </button>
      </div>
    )
  }

  const cards = [
    {
      title: 'Total users',
      value: d.users.total,
      detail: `${d.users.active} active`,
      alert: `${d.users.blocked} blocked`,
      icon: UserIcon,
    },
    {
      title: 'Live products',
      value: d.products.total,
      detail: 'Across the marketplace',
      alert: `${d.products.pendingApproval} need review`,
      icon: PackageIcon,
    },
    {
      title: 'Orders this month',
      value: d.orders.thisMonth,
      detail: 'Current month',
      alert: `${d.orders.waitingForDealer} unassigned`,
      icon: CartIcon,
    },
    {
      title: 'Completed sales',
      value: money(d.sales.completedValue),
      detail: `${money(d.sales.thisMonthValue)} this month`,
      alert: 'Offline payments',
      icon: CheckCircleIcon,
    },
    {
      title: 'Active dealers',
      value: d.dealers.active,
      detail: 'Available operators',
      alert: `${d.dealers.atCapacity} at capacity`,
      icon: MessageIcon,
    },
    {
      title: 'Open reports',
      value: d.reports.open,
      detail: `${d.reports.inReview} in review`,
      alert: 'Safety queue',
      icon: ShieldIcon,
    },
  ]

  return (
    <section className="admin-dashboard">
      <div className="admin-dashboard-hero">
        <div>
          <span className="admin-eyebrow">
            <span /> Live operations overview
          </span>
          <h1>Good to see you.</h1>
          <p>Here’s what is happening across Campus Angadi right now.</p>
        </div>
        <div className="admin-dashboard-actions">
          <Link className="button button-outline" to="/admin/moderation">
            Review listings
          </Link>
          <Link className="button button-primary" to="/admin/products">
            Add product <ArrowRightIcon />
          </Link>
        </div>
      </div>

      <div className="admin-metric-grid">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <article className="admin-metric-card" key={card.title}>
              <div className="admin-metric-head">
                <span>{card.title}</span>
                <i>
                  <Icon />
                </i>
              </div>
              <strong>{card.value}</strong>
              <div className="admin-metric-foot">
                <span>{card.detail}</span>
                <small>{card.alert}</small>
              </div>
            </article>
          )
        })}
      </div>

      <div className="admin-dashboard-grid">
        <DashboardList
          title="Recent orders"
          eyebrow="Order activity"
          to="/admin/orders"
          empty="No orders yet"
        >
          {d.recentOrders.map((order) => (
            <Link className="admin-activity-row" key={order.id} to={`/admin/orders/${order.id}`}>
              <div className="activity-icon">
                <CartIcon />
              </div>
              <div>
                <strong>{order.orderNumber}</strong>
                <small>
                  {order.itemCount} items · {order.status.replaceAll('_', ' ')}
                </small>
              </div>
              <span>{money(order.totalAmount)}</span>
              <ArrowRightIcon />
            </Link>
          ))}
        </DashboardList>

        <DashboardList
          title="New community members"
          eyebrow="Recent users"
          to="/admin/users"
          empty="No users yet"
        >
          {d.recentUsers.map((user) => (
            <Link className="admin-activity-row" key={user.id} to={`/admin/users/${user.id}`}>
              <div className="activity-avatar">{user.displayName.slice(0, 1).toUpperCase()}</div>
              <div>
                <strong>{user.displayName}</strong>
                <small>{user.email}</small>
              </div>
              <span className="admin-role-pill">{user.role.replace('_', ' ')}</span>
              <ArrowRightIcon />
            </Link>
          ))}
        </DashboardList>
      </div>

      <div className="admin-attention-bar">
        <div className="attention-icon">
          <ShieldIcon />
        </div>
        <div>
          <strong>Trust & safety queue</strong>
          <p>
            {d.products.pendingApproval + d.reports.open} items currently need an administrator’s
            attention.
          </p>
        </div>
        <Link className="button button-outline" to="/admin/moderation">
          Open queue
        </Link>
      </div>
    </section>
  )
}

function DashboardList({
  title,
  eyebrow,
  to,
  empty,
  children,
}: {
  title: string
  eyebrow: string
  to: string
  empty: string
  children: ReactNode
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <section className="admin-dashboard-panel">
      <header>
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <Link to={to}>
          View all <ArrowRightIcon />
        </Link>
      </header>
      <div className="admin-activity-list">
        {hasChildren ? children : <p className="admin-list-empty">{empty}</p>}
      </div>
    </section>
  )
}
