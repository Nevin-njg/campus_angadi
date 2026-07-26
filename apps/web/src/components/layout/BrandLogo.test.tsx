import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BrandLogo } from './BrandLogo'

describe('BrandLogo', () => {
  it('uses the Campus Angadi brand and temporary CA mark', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['settings', 'public'], {
      appName: 'Campus Angadi',
      brandMark: 'CA',
      campusDisplayName: 'Your Campus',
      supportEmail: null,
      supportPhone: null,
      defaultPickupLocations: [],
      listingExpirationDays: 30,
      maxActiveListingsPerUser: 20,
      termsUrl: null,
      privacyUrl: null,
    })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <BrandLogo />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.getByText('Campus Angadi')).toBeInTheDocument()
    expect(screen.getByText('CA')).toBeInTheDocument()
  })
})
