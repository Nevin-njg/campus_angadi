import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from '../../../test/render'
import { adminPlatformApi } from '../../admin/api/admin-platform.api'
import { storesApi, type Store } from '../api/stores.api'
import { AdminStoresPage } from './AdminStoresPage'

const store: Store = {
  id: 'store-1',
  name: 'Campus Supplies',
  slug: 'campus-supplies',
  description: null,
  logoUrl: null,
  bannerUrl: null,
  sellerId: 'seller-1',
  commissionPercent: 5,
  status: 'ACTIVE',
  campusLocation: 'Main block',
  deliveryTimeMinutes: 30,
  minimumOrderAmount: 0,
  categories: [],
}

function mockUsers() {
  return vi.spyOn(adminPlatformApi, 'users').mockResolvedValue({
    items: [],
    meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
  })
}

describe('AdminStoresPage deletion', () => {
  afterEach(() => vi.restoreAllMocks())

  it('confirms deletion and removes the deleted store from the table', async () => {
    mockUsers()
    vi.spyOn(storesApi, 'adminList').mockResolvedValueOnce([store]).mockResolvedValueOnce([])
    const remove = vi.spyOn(storesApi, 'remove').mockResolvedValue({ id: store.id })

    renderApp(<AdminStoresPage />, '/admin/stores')

    expect(await screen.findByText(store.name)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete store' }))

    await waitFor(() => expect(remove.mock.calls[0]?.[0]).toBe(store.id))
    await waitFor(() => expect(screen.queryByText(store.name)).not.toBeInTheDocument())
  })

  it('shows the API error when a store cannot be deleted', async () => {
    mockUsers()
    vi.spyOn(storesApi, 'adminList').mockResolvedValue([store])
    vi.spyOn(storesApi, 'remove').mockRejectedValue(
      new Error('Complete, cancel, or reject this store’s open orders before deleting it.'),
    )

    renderApp(<AdminStoresPage />, '/admin/stores')

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete store' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Complete, cancel, or reject this store’s open orders before deleting it.',
    )
  })
})
