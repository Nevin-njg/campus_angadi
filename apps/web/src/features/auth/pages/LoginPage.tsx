import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { BrandLogo } from '../../../components/layout/BrandLogo'
import { ShieldIcon } from '../../../components/ui/icons'
import { webEnv } from '../../../config/env'
import { ApiClientError } from '../../../lib/api-client'
import { authApi } from '../api/auth.api'
import { GoogleSignInButton } from '../components/GoogleSignInButton'
import { rememberReturnTo, takeReturnTo } from '../lib/auth-return'
import { useAuthStore } from '../store/use-auth-store'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const user = useAuthStore((state) => state.user)
  const establishSession = useAuthStore((state) => state.establishSession)
  const [serverError, setServerError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    if (user) void navigate('/', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    const routeState = location.state as { from?: string } | null
    rememberReturnTo(searchParams.get('returnTo') ?? routeState?.from)
  }, [location.state, searchParams])

  const handleError = useCallback((message: string) => {
    setServerError(message)
  }, [])

  const handleCredential = useCallback(
    async (credential: string) => {
      setServerError(null)
      setSigningIn(true)
      try {
        const result = await authApi.googleSignIn({ credential })
        establishSession(result.accessToken, result.user)
        const destination = result.user.profileCompleted
          ? (takeReturnTo() ?? '/')
          : '/account/profile'
        void navigate(destination, { replace: true })
      } catch (error) {
        setServerError(
          error instanceof ApiClientError
            ? error.message
            : 'Google Sign-In could not be completed. Please try again.',
        )
      } finally {
        setSigningIn(false)
      }
    },
    [establishSession, navigate],
  )

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <BrandLogo />
        <div className="auth-visual-copy">
          <span className="eyebrow">
            <span />
            Secure campus access
          </span>
          <h1>
            One Google account.
            <br />
            One secure sign-in.
            <br />
            <em>No OTP to wait for.</em>
          </h1>
          <p>
            Sign in using an approved Google account. Campus Angadi verifies the Google ID token on
            the server before creating your session.
          </p>
          <div className="auth-trust">
            <ShieldIcon />
            <div>
              <strong>Protected by Google identity verification</strong>
              <span>Your password is never shared with Campus Angadi.</span>
            </div>
          </div>
        </div>
      </div>
      <main className="auth-form-panel">
        <div className="auth-form-card">
          <div className="auth-mobile-brand">
            <BrandLogo />
          </div>
          <div className="auth-icon">
            <ShieldIcon />
          </div>
          <h2>Sign in to Campus Angadi</h2>
          <p>Continue with an approved Google account.</p>
          <GoogleSignInButton
            clientId={webEnv.googleClientId}
            disabled={signingIn}
            onCredential={(credential) => void handleCredential(credential)}
            onError={handleError}
          />
          {signingIn ? <p className="auth-signing-in">Signing you in securely…</p> : null}
          {serverError ? (
            <div className="form-alert" role="alert">
              {serverError}
            </div>
          ) : null}
          <p className="auth-footnote">
            Only email domains approved by Campus Angadi are accepted by the backend.
          </p>
          <Link className="back-link" to="/">
            ← Return to homepage
          </Link>
        </div>
      </main>
    </div>
  )
}
