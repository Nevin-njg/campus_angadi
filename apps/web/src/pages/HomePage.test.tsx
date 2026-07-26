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
  it('describes the private mediated order flow and live catalogue sections', async () => {
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
    expect(screen.getByText('In-app order support')).toBeInTheDocument()
    expect(screen.getByText('Private mediated chat')).toBeInTheDocument()
    expect(await screen.findByText('Featured on Campus Angadi')).toBeInTheDocument()
    expect(screen.getByText('Official Campus Store')).toBeInTheDocument()
  })
})
