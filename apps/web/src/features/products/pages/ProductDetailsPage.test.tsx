import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes, useLocation } from 'react-router-dom'
import { cartApi } from '../../cart/api/cart.api'
import { useAuthStore } from '../../auth/store/use-auth-store'
import { catalogApi } from '../api/catalog.api'
import { authUser, productDetail } from '../../../test/fixtures'
import { renderApp } from '../../../test/render'
import { ProductDetailsPage } from './ProductDetailsPage'

function Location() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

describe('ProductDetailsPage purchase actions', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    useAuthStore.setState({ user: null, status: 'anonymous' })
  })

  it('adds to the signed-in user cart and opens direct checkout', async () => {
    const user = authUser()
    const product = productDetail()
    useAuthStore.setState({ user, status: 'authenticated' })
    vi.spyOn(catalogApi, 'product').mockResolvedValue(product)
    vi.spyOn(cartApi, 'add').mockResolvedValue({
      id: 'cart-1',
      userId: user.id,
      items: [{ product, quantity: 1, lineTotal: product.price }],
      totalItems: 1,
      subtotal: product.price,
      issues: [],
      updatedAt: '2026-07-18T00:00:00.000Z',
    })

    renderApp(
      <Routes>
        <Route path="/products/:slug" element={<ProductDetailsPage />} />
        <Route path="/checkout" element={<Location />} />
      </Routes>,
      '/products/campus-notebook',
    )

    fireEvent.click(await screen.findByRole('button', { name: /add to cart/i }))
    await waitFor(() =>
      expect(cartApi.add).toHaveBeenCalledWith({ productId: product.id, quantity: 1 }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Buy now' }))

    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/checkout?buyNow=campus-notebook&quantity=1',
    )
  })
})
