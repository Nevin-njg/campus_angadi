import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { catalogApi } from '../features/products/api/catalog.api'
import { HomePage } from './HomePage'

vi.mock('../features/products/api/catalog.api', () => ({
  catalogApi: {
    homepage: vi.fn(),
  },
}))

const section = (key: 'FEATURED' | 'OFFICIAL' | 'SECOND_HAND' | 'RECENT') => ({
  key,
  limit: 8,
  manualProductIds: [],
  products: [],
  manualCount: 0,
  automaticCount: 0,
})

describe('HomePage', () => {
  it('starts with student shopping actions and live catalogue sections', async () => {
    vi.mocked(catalogApi.homepage).mockResolvedValue({
      categories: [],
      sections: {
        FEATURED: section('FEATURED'),
        OFFICIAL: section('OFFICIAL'),
        SECOND_HAND: section('SECOND_HAND'),
        RECENT: section('RECENT'),
      },
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.getByRole('heading', { name: 'What do you need today?' })).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: 'Search the campus marketplace' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sell an item' })).toBeInTheDocument()
    expect(await screen.findByText('Popular on campus')).toBeInTheDocument()
    expect(screen.getByText('Official campus essentials')).toBeInTheDocument()
    expect(screen.queryByText('Human order support')).not.toBeInTheDocument()
  })
})
