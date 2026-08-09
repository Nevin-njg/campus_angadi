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
  return 'light'
}

export function getPreferredTheme(): ThemeMode {
  return 'light'
}

export function getActiveTheme(): ThemeMode {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function hasStoredTheme(): boolean {
  return readStoredTheme() !== null
}

export function applyTheme(_theme: ThemeMode, persist = false): void {
  const root = document.documentElement
  root.classList.remove('dark', 'admin-dark')
  root.dataset.theme = 'light'

  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#ffffff')

  if (!persist) return

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
  } catch {
    // The selected theme still applies for this session when storage is unavailable.
  }
}

export function initializeTheme(): void {
  applyTheme('light', true)
}

export function isThemeStorageEvent(event: StorageEvent): boolean {
  return event.key === THEME_STORAGE_KEY
}
