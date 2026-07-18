import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeTheme } from '../../lib/theme'
import { ThemeToggle } from './ThemeToggle'

function installMatchMedia(dark = false) {
  const listeners = new Set<() => void>()
  const media = {
    matches: dark,
    addEventListener: vi.fn((_event: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_event: string, listener: () => void) =>
      listeners.delete(listener),
    ),
  }
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(media))
  return { media, listeners }
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.className = ''
    delete document.documentElement.dataset.theme
    installMatchMedia(false)
    initializeTheme()
  })

  it('switches theme and persists the choice', () => {
    render(<ThemeToggle />)

    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }))

    expect(document.documentElement).toHaveClass('dark')
    expect(window.localStorage.getItem('campus-angadi-theme')).toBe('dark')
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('follows system changes until the user chooses a theme', () => {
    const { media, listeners } = installMatchMedia(false)
    render(<ThemeToggle />)

    media.matches = true
    listeners.forEach((listener) => listener())

    expect(document.documentElement).toHaveClass('dark')
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
  })

  it('unsubscribes from browser listeners when removed', () => {
    const { media } = installMatchMedia(false)
    const view = render(<ThemeToggle />)

    view.unmount()

    expect(media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
