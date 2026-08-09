import { render } from '@testing-library/react'
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

  it('renders no switch because the marketplace is light-only', () => {
    const view = render(<ThemeToggle />)
    expect(view.container).toBeEmptyDOMElement()
    expect(document.documentElement).not.toHaveClass('dark')
  })
})
