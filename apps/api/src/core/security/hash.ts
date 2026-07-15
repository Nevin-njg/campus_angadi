import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export function hashOtp(email: string, code: string, secret: string): string {
  return createHmac('sha256', secret).update(`${email}:${code}`).digest('hex')
}

export function verifyHash(expectedHex: string, actualHex: string): boolean {
  const expected = Buffer.from(expectedHex, 'hex')
  const actual = Buffer.from(actualHex, 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
