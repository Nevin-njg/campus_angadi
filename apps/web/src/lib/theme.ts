export type ThemeMode = 'light' | 'dark'

const THEME_STORAGE_KEY = 'campus-angadi-theme'

function readStoredTheme(): ThemeMode | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

export function getSystemTheme(): ThemeMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function getPreferredTheme(): ThemeMode {
  return readStoredTheme() ?? getSystemTheme()
}

export function getActiveTheme(): ThemeMode {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function hasStoredTheme(): boolean {
  return readStoredTheme() !== null
}

export function applyTheme(theme: ThemeMode, persist = false): void {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.dataset.theme = theme

  const themeColor = theme === 'dark' ? '#1a1a1a' : '#f7f7f8'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor)

  if (!persist) return

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // The selected theme still applies for this session when storage is unavailable.
  }
}

export function initializeTheme(): void {
  applyTheme(getPreferredTheme())
}

export function isThemeStorageEvent(event: StorageEvent): boolean {
  return event.key === THEME_STORAGE_KEY
}
