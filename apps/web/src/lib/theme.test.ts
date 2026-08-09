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

  it('always uses the light commerce theme even when dark was stored', () => {
    window.localStorage.setItem('campus-angadi-theme', 'dark')
    mockSystemTheme(false)

    expect(hasStoredTheme()).toBe(true)
    expect(getPreferredTheme()).toBe('light')

    initializeTheme()

    expect(getActiveTheme()).toBe('light')
    expect(document.documentElement).not.toHaveClass('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#ffffff')
  })

  it('stays light when the system preference is dark', () => {
    mockSystemTheme(true)

    initializeTheme()

    expect(getActiveTheme()).toBe('light')
    expect(window.localStorage.getItem('campus-angadi-theme')).toBe('light')
  })

  it('applies and persists an explicit theme choice', () => {
    applyTheme('light', true)

    expect(getActiveTheme()).toBe('light')
    expect(document.documentElement).not.toHaveClass('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(window.localStorage.getItem('campus-angadi-theme')).toBe('light')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#ffffff')
  })

  it('recognizes only the theme storage event', () => {
    expect(isThemeStorageEvent(new StorageEvent('storage', { key: 'campus-angadi-theme' }))).toBe(
      true,
    )
    expect(isThemeStorageEvent(new StorageEvent('storage', { key: 'unrelated' }))).toBe(false)
  })
})
