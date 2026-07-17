import { describe, expect, it } from 'vitest'
import { isOriginAllowed } from './origin-policy.js'

describe('isOriginAllowed', () => {
  it('accepts Vite fallback ports during local development', () => {
    expect(isOriginAllowed('http://localhost:5175', ['http://localhost:5173'], 'development')).toBe(
      true,
    )
    expect(isOriginAllowed('http://127.0.0.1:5176', [], 'development')).toBe(true)
  })

  it('keeps non-local and production origins restricted', () => {
    expect(isOriginAllowed('https://example.com', [], 'development')).toBe(false)
    expect(isOriginAllowed('http://localhost:5175', ['http://localhost:5173'], 'production')).toBe(
      false,
    )
    expect(
      isOriginAllowed('https://angadi.nitc.ac.in', ['https://angadi.nitc.ac.in'], 'production'),
    ).toBe(true)
  })
})
