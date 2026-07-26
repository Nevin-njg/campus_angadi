export interface GoogleIdentity {
  subject: string
  email: string
  emailVerified: boolean
  name: string | null
  picture: string | null
  hostedDomain: string | null
}

export interface GoogleIdentityVerifier {
  verify(credential: string): Promise<GoogleIdentity>
}
