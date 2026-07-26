import { createPublicKey, verify as verifySignature, type JsonWebKey } from 'node:crypto'
import type {
  GoogleIdentity,
  GoogleIdentityVerifier,
} from '../../modules/auth/domain/google-identity.js'

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com'])
const CLOCK_SKEW_SECONDS = 60
const DEFAULT_CACHE_SECONDS = 3600

interface JwtHeader {
  alg?: unknown
  kid?: unknown
  typ?: unknown
}

interface GoogleTokenPayload {
  iss?: unknown
  aud?: unknown
  azp?: unknown
  sub?: unknown
  email?: unknown
  email_verified?: unknown
  name?: unknown
  picture?: unknown
  hd?: unknown
  exp?: unknown
  iat?: unknown
}

interface GoogleJwksResponse {
  keys?: JsonWebKey[]
}

function decodeBase64UrlJson<T>(value: string): T {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T
  } catch {
    throw new Error('Malformed Google ID token.')
  }
}

function parseMaxAge(cacheControl: string | null): number {
  if (!cacheControl) return DEFAULT_CACHE_SECONDS
  const match = /(?:^|,)\s*max-age=(\d+)/i.exec(cacheControl)
  if (!match) return DEFAULT_CACHE_SECONDS
  const seconds = Number(match[1])
  return Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_CACHE_SECONDS
}

function hasAudience(audience: unknown, clientId: string): boolean {
  if (typeof audience === 'string') return audience === clientId
  return Array.isArray(audience) && audience.some((entry) => entry === clientId)
}

export class GoogleIdentityTokenVerifier implements GoogleIdentityVerifier {
  private keys = new Map<string, JsonWebKey>()
  private cacheExpiresAt = 0

  constructor(
    private readonly clientId: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async verify(credential: string): Promise<GoogleIdentity> {
    const parts = credential.split('.')
    if (parts.length !== 3) throw new Error('Malformed Google ID token.')

    const [encodedHeader, encodedPayload, encodedSignature] = parts
    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new Error('Malformed Google ID token.')
    }

    const header = decodeBase64UrlJson<JwtHeader>(encodedHeader)
    const payload = decodeBase64UrlJson<GoogleTokenPayload>(encodedPayload)

    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
      throw new Error('Unsupported Google ID token.')
    }

    let key = await this.getKey(header.kid, false)
    if (!key) key = await this.getKey(header.kid, true)
    if (!key) throw new Error('Unable to find the Google signing key.')

    const publicKey = createPublicKey({ key, format: 'jwk' })
    const signatureValid = verifySignature(
      'RSA-SHA256',
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      publicKey,
      Buffer.from(encodedSignature, 'base64url'),
    )
    if (!signatureValid) throw new Error('Invalid Google ID token signature.')

    const now = Math.floor(Date.now() / 1000)
    if (!GOOGLE_ISSUERS.has(String(payload.iss))) throw new Error('Invalid Google token issuer.')
    if (!hasAudience(payload.aud, this.clientId)) throw new Error('Invalid Google token audience.')
    if (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== this.clientId) {
      throw new Error('Invalid Google authorized party.')
    }
    if (typeof payload.exp !== 'number' || payload.exp < now - CLOCK_SKEW_SECONDS) {
      throw new Error('Expired Google ID token.')
    }
    if (typeof payload.iat !== 'number' || payload.iat > now + CLOCK_SKEW_SECONDS) {
      throw new Error('Invalid Google ID token issue time.')
    }
    if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('Missing Google subject.')
    if (typeof payload.email !== 'string' || !payload.email)
      throw new Error('Missing Google email.')

    return {
      subject: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : null,
      picture:
        typeof payload.picture === 'string' && payload.picture.trim()
          ? payload.picture.trim()
          : null,
      hostedDomain:
        typeof payload.hd === 'string' && payload.hd.trim() ? payload.hd.toLowerCase() : null,
    }
  }

  private async getKey(kid: string, forceRefresh: boolean): Promise<JsonWebKey | undefined> {
    if (forceRefresh || Date.now() >= this.cacheExpiresAt || this.keys.size === 0) {
      await this.refreshKeys()
    }
    return this.keys.get(kid)
  }

  private async refreshKeys(): Promise<void> {
    const response = await this.fetcher(GOOGLE_JWKS_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error('Unable to retrieve Google signing keys.')

    const data = (await response.json()) as GoogleJwksResponse
    const nextKeys = new Map<string, JsonWebKey>()
    for (const key of data.keys ?? []) {
      if (typeof key.kid === 'string' && key.kid && key.kty === 'RSA') nextKeys.set(key.kid, key)
    }
    if (nextKeys.size === 0) throw new Error('Google returned no usable signing keys.')

    this.keys = nextKeys
    this.cacheExpiresAt = Date.now() + parseMaxAge(response.headers.get('cache-control')) * 1000
  }
}
