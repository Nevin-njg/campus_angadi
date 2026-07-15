import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OrderStatusBadge } from './OrderStatusBadge'

describe('OrderStatusBadge', () => {
  it('renders readable status text with a status-specific class', () => {
    render(<OrderStatusBadge status="READY_FOR_PICKUP" />)
    expect(screen.getByText('Ready For Pickup')).toHaveClass('status-ready_for_pickup')
  })
})
