import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { BrandLogo } from '../../../components/layout/BrandLogo'
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
  const [testCredentials, setTestCredentials] = useState({ email: '', password: '' })
  const [requestCredential, setRequestCredential] = useState<string | null>(null)
  const [requestForm, setRequestForm] = useState({ fullName: '', affiliation: '', reason: '' })
  const [requestSent, setRequestSent] = useState(false)
  const [requesting, setRequesting] = useState(false)

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
        if (error instanceof ApiClientError && error.code === 'ACCESS_APPROVAL_REQUIRED') {
          setRequestCredential(credential)
          setServerError(null)
          return
        }
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

  async function submitTestLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setServerError(null)
    setSigningIn(true)
    try {
      const result = await authApi.testSignIn(testCredentials)
      establishSession(result.accessToken, result.user)
      void navigate(takeReturnTo() ?? '/', { replace: true })
    } catch (error) {
      setServerError(
        error instanceof ApiClientError
          ? error.message
          : 'The test sign-in could not be completed.',
      )
    } finally {
      setSigningIn(false)
    }
  }

  async function submitAccessRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!requestCredential) return
    setRequesting(true)
    setServerError(null)
    try {
      await authApi.requestAccess({ credential: requestCredential, ...requestForm })
      setRequestSent(true)
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : 'The access request could not be sent.',
      )
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div className="simple-auth-page">
      <header className="simple-auth-header">
        <BrandLogo />
        <Link className="simple-auth-back" to="/" aria-label="Back to marketplace">
          <span className="simple-auth-back-full">Back to marketplace</span>
          <span className="simple-auth-back-short" aria-hidden="true">
            Back
          </span>
        </Link>
      </header>
      <main className="simple-auth-main">
        <div className="simple-auth-panel">
          <span className="simple-auth-campus">Campus marketplace</span>
          <h1>Sign in</h1>
          <p>Use your approved Google account to continue to Campus Angadi.</p>
          {!requestCredential ? (
            <GoogleSignInButton
              clientId={webEnv.googleClientId}
              disabled={signingIn}
              onCredential={(credential) => void handleCredential(credential)}
              onError={handleError}
            />
          ) : requestSent ? (
            <div className="form-alert" role="status">
              Request sent. We’ll email you after an administrator reviews it.
            </div>
          ) : (
            <form
              className="auth-access-request"
              onSubmit={(event) => void submitAccessRequest(event)}
            >
              <div className="form-alert">
                This email needs approval. Tell us how you are connected to the campus.
              </div>
              <label>
                Full name
                <input
                  required
                  minLength={2}
                  value={requestForm.fullName}
                  onChange={(event) =>
                    setRequestForm((value) => ({ ...value, fullName: event.target.value }))
                  }
                />
              </label>
              <label>
                Campus affiliation
                <input
                  required
                  minLength={2}
                  placeholder="Student, alumnus, staff, vendor…"
                  value={requestForm.affiliation}
                  onChange={(event) =>
                    setRequestForm((value) => ({ ...value, affiliation: event.target.value }))
                  }
                />
              </label>
              <label>
                Why do you need access?
                <textarea
                  required
                  minLength={10}
                  rows={3}
                  value={requestForm.reason}
                  onChange={(event) =>
                    setRequestForm((value) => ({ ...value, reason: event.target.value }))
                  }
                />
              </label>
              <button className="button button-primary" disabled={requesting} type="submit">
                {requesting ? 'Sending…' : 'Request access'}
              </button>
              <button
                className="button button-outline"
                type="button"
                onClick={() => setRequestCredential(null)}
              >
                Use another Google account
              </button>
            </form>
          )}
          {!requestCredential && webEnv.testLoginEnabled ? (
            <details className="test-login-disclosure">
              <summary>Developer test login</summary>
              <form
                className="auth-access-request"
                onSubmit={(event) => void submitTestLogin(event)}
              >
                <label>
                  Email
                  <input
                    autoComplete="username"
                    required
                    type="email"
                    value={testCredentials.email}
                    onChange={(event) =>
                      setTestCredentials((value) => ({ ...value, email: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Password
                  <input
                    autoComplete="current-password"
                    minLength={8}
                    required
                    type="password"
                    value={testCredentials.password}
                    onChange={(event) =>
                      setTestCredentials((value) => ({ ...value, password: event.target.value }))
                    }
                  />
                </label>
                <button className="button button-outline" disabled={signingIn} type="submit">
                  {signingIn ? 'Signing in…' : 'Sign in for testing'}
                </button>
              </form>
            </details>
          ) : null}
          {signingIn ? <p className="auth-signing-in">Signing you in securely…</p> : null}
          {serverError ? (
            <div className="form-alert" role="alert">
              {serverError}
            </div>
          ) : null}
          <p className="simple-auth-note">Your Google password is never shared with us.</p>
        </div>
      </main>
    </div>
  )
}
