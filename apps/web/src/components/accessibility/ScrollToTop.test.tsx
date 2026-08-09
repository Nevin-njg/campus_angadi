import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScrollToTop } from './ScrollToTop'

function NavigateButton() {
  const navigate = useNavigate()
  return <button onClick={() => navigate('/next')}>Next page</button>
}

describe('ScrollToTop', () => {
  afterEach(() => vi.restoreAllMocks())

  it('resets the viewport after pathname navigation', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    render(
      <MemoryRouter initialEntries={['/start']}>
        <ScrollToTop />
        <NavigateButton />
      </MemoryRouter>,
    )

    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))

    await waitFor(() => expect(scrollTo).toHaveBeenCalledTimes(2))
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'auto' })
  })
})
