import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { cartApi } from '../../cart/api/cart.api'
import { useAuthStore } from '../../auth/store/use-auth-store'
import { catalogApi } from '../../products/api/catalog.api'
import { authUser, productDetail } from '../../../test/fixtures'
import { renderApp } from '../../../test/render'
import { ordersApi } from '../api/orders.api'
import { CheckoutPage } from './CheckoutPage'

describe('CheckoutPage direct purchase', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    useAuthStore.setState({ user: null, status: 'anonymous' })
  })

  it('checks out only the selected product and does not read or replace the cart', async () => {
    const user = authUser()
    const product = productDetail()
    useAuthStore.setState({ user, status: 'authenticated' })
    const cartSpy = vi.spyOn(cartApi, 'get')
    vi.spyOn(catalogApi, 'product').mockResolvedValue(product)
    vi.spyOn(ordersApi, 'buyNow').mockResolvedValue({ checkoutGroupId: 'group-1', orders: [] })

    renderApp(
      <Routes>
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/account/orders" element={<div>Orders</div>} />
      </Routes>,
      '/checkout?buyNow=campus-notebook&quantity=2',
    )

    fireEvent.click(await screen.findByRole('button', { name: /create order/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Place order' }))

    await waitFor(() =>
      expect(ordersApi.buyNow).toHaveBeenCalledWith(
        expect.objectContaining({ productId: product.id, quantity: 2 }),
      ),
    )
    expect(cartSpy).not.toHaveBeenCalled()
  })
})
