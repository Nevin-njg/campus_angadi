import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyTheme,
  getActiveTheme,
  getPreferredTheme,
  hasStoredTheme,
  initializeTheme,
  isThemeStorageEvent,
} from './theme'

function mockSystemTheme(dark: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: dark }))
}

describe('theme preferences', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.className = ''
    delete document.documentElement.dataset.theme
    document.head.innerHTML = '<meta name="theme-color" content="#ffffff">'
    mockSystemTheme(false)
  })

  it('uses a stored preference before the system preference', () => {
    window.localStorage.setItem('campus-angadi-theme', 'dark')
    mockSystemTheme(false)

    expect(hasStoredTheme()).toBe(true)
    expect(getPreferredTheme()).toBe('dark')

    initializeTheme()

    expect(getActiveTheme()).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#1a1a1a')
  })

  it('falls back to the system preference when nothing is stored', () => {
    mockSystemTheme(true)

    initializeTheme()

    expect(getActiveTheme()).toBe('dark')
    expect(window.localStorage.getItem('campus-angadi-theme')).toBeNull()
  })

  it('applies and persists an explicit theme choice', () => {
    applyTheme('light', true)

    expect(getActiveTheme()).toBe('light')
    expect(document.documentElement).not.toHaveClass('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(window.localStorage.getItem('campus-angadi-theme')).toBe('light')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#f7f7f8')
  })

  it('recognizes only the theme storage event', () => {
    expect(isThemeStorageEvent(new StorageEvent('storage', { key: 'campus-angadi-theme' }))).toBe(
      true,
    )
    expect(isThemeStorageEvent(new StorageEvent('storage', { key: 'unrelated' }))).toBe(false)
  })
})
