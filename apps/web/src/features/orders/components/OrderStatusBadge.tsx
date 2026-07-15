import type { OrderStatus } from '@campusbaza/contracts'

function orderStatusLabel(status: OrderStatus) {
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`order-status-badge status-${status.toLowerCase()}`}>
      {orderStatusLabel(status)}
    </span>
  )
}
