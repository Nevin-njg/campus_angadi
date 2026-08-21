import { fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes, useLocation } from 'react-router-dom'
import { authUser } from '../../../test/fixtures'
import { renderApp } from '../../../test/render'
import { useAuthStore } from '../../auth/store/use-auth-store'
import { cartApi } from '../../cart/api/cart.api'
import { storesApi } from '../api/stores.api'
import { MarketplaceSearchPage } from './MarketplaceSearchPage'

function CheckoutLocation() {
  return <div>{useLocation().search}</div>
}

describe('MarketplaceSearchPage Buy now', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    useAuthStore.setState({ user: null, status: 'anonymous' })
  })

  it('opens direct checkout without adding the product to the cart', async () => {
    useAuthStore.setState({ user: authUser(), status: 'authenticated' })
    const addToCart = vi.spyOn(cartApi, 'add')
    vi.spyOn(storesApi, 'searchMarketplace').mockResolvedValue({
      query: 'notebook',
      stores: [],
      meta: { storeCount: 0, productCount: 1, inStockCount: 1 },
      products: [
        {
          id: 'product-1',
          slug: 'campus-notebook',
          title: 'Campus Notebook',
          description: 'A ruled notebook for campus classes.',
          price: 120,
          originalPrice: null,
          stock: 10,
          status: 'APPROVED',
          published: true,
          productType: 'NEW',
          sellerType: 'ADMIN',
          storeCategoryId: 'category-1',
          primaryImage: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          discountPercent: 0,
          savings: 0,
          storeCategoryName: 'Stationery',
          store: {
            id: 'store-1',
            name: 'Campus Supplies',
            slug: 'campus-supplies',
            logoUrl: null,
            campusLocation: 'Main block',
            deliveryTimeMinutes: 30,
            minimumOrderAmount: 0,
          },
        },
      ],
    })

    renderApp(
      <Routes>
        <Route path="/search" element={<MarketplaceSearchPage />} />
        <Route path="/checkout" element={<CheckoutLocation />} />
      </Routes>,
      '/search?q=notebook&type=products',
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Buy now' }))

    expect(await screen.findByText('?buyNow=campus-notebook&quantity=1')).toBeInTheDocument()
    expect(addToCart).not.toHaveBeenCalled()
  })
})
