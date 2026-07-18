import { afterEach, describe, expect, it } from 'vitest'
import { rememberReturnTo, safeReturnTo, takeReturnTo } from './auth-return'

describe('auth return destinations', () => {
  afterEach(() => window.sessionStorage.clear())

  it('preserves a local checkout destination through authentication', () => {
    rememberReturnTo('/checkout?buyNow=campus-notebook&quantity=1')
    expect(takeReturnTo()).toBe('/checkout?buyNow=campus-notebook&quantity=1')
    expect(takeReturnTo()).toBeNull()
  })

  it('rejects external and authentication-loop destinations', () => {
    expect(safeReturnTo('//malicious.example')).toBeNull()
    expect(safeReturnTo('https://malicious.example')).toBeNull()
    expect(safeReturnTo('/login?returnTo=/checkout')).toBeNull()
  })
})
