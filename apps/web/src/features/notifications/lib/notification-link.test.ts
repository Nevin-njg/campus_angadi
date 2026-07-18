import { describe, expect, it } from 'vitest'
import { notificationPath } from './notification-link'

describe('notificationPath', () => {
  it('routes buyers and staff to their respective order screens', () => {
    const notification = { referenceType: 'Order', referenceId: 'order-1' }
    expect(notificationPath(notification, 'USER')).toBe('/account/orders/order-1')
    expect(notificationPath(notification, 'MODERATOR')).toBe('/admin/orders/order-1')
  })

  it('does not create a route for unrecognized references', () => {
    expect(notificationPath({ referenceType: 'UNKNOWN', referenceId: 'value' }, 'USER')).toBeNull()
  })
})
