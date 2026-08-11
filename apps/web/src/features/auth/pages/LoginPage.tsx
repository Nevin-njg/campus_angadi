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
    <div className="simple-auth-page professional-auth-page">
      <header className="simple-auth-header professional-auth-header">
        <BrandLogo />
        <Link className="simple-auth-back professional-auth-back" to="/" aria-label="Back to marketplace">
          <span className="simple-auth-back-full">Back to marketplace</span>
          <span className="simple-auth-back-short" aria-hidden="true">
            Back
          </span>
        </Link>
      </header>

      <main className="simple-auth-main professional-auth-main">
        <section className="professional-auth-shell" aria-label="Campus Angadi sign in">
          <div className="professional-auth-story">
            <div className="professional-auth-story-copy">
              <span className="professional-auth-kicker">NIT CALICUT · CAMPUS MARKETPLACE</span>
              <h1>
                Campus commerce,
                <br />
                <em>for the NITC community.</em>
              </h1>
              <p>
                Buy from campus stores, discover second-hand listings, and manage your marketplace
                activity through one verified account.
              </p>
            </div>

            <div className="professional-auth-points" aria-label="Access rules">
              <div className="professional-auth-point">
                <span className="professional-auth-point-number">01</span>
                <div>
                  <strong>NITC accounts enter directly</strong>
                  <span>Sign in with your institutional Google account and continue.</span>
                </div>
              </div>
              <div className="professional-auth-point">
                <span className="professional-auth-point-number">02</span>
                <div>
                  <strong>Other Google accounts are reviewed</strong>
                  <span>External users can request access from a Campus Angadi administrator.</span>
                </div>
              </div>
            </div>

            <div className="professional-auth-security">
              <span className="professional-auth-security-dot" />
              <span>Google verified · Campus controlled · No password stored</span>
            </div>
          </div>

          <div className="professional-auth-form-side">
            <div className="simple-auth-panel professional-auth-panel">
              <div className="professional-auth-panel-mark" aria-hidden="true">
                <span>CA</span>
              </div>
              <span className="simple-auth-campus professional-auth-panel-kicker">Secure access</span>
              <h2>{requestCredential ? (requestSent ? 'Request received' : 'Request access') : 'Welcome back'}</h2>
              <p className="professional-auth-panel-copy">
                {requestCredential
                  ? requestSent
                    ? 'Your request is now waiting for an administrator review.'
                    : 'Complete the details below so the admin team can review your access.'
                  : 'Continue with Google to access your Campus Angadi account.'}
              </p>

              {!requestCredential ? (
                <GoogleSignInButton
                  clientId={webEnv.googleClientId}
                  disabled={signingIn}
                  onCredential={(credential) => void handleCredential(credential)}
                  onError={handleError}
                />
              ) : requestSent ? (
                <div className="form-alert professional-auth-success" role="status">
                  <strong>Request sent successfully.</strong>
                  <span>We’ll email you after an administrator reviews it.</span>
                </div>
              ) : (
                <form
                  className="auth-access-request professional-auth-request-form"
                  onSubmit={(event) => void submitAccessRequest(event)}
                >
                  <div className="form-alert">
                    This Google account needs approval. Tell us how you are connected to the campus.
                  </div>
                  <label>
                    Full name
                    <input
                      required
                      minLength={2}
                      placeholder="Your full name"
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
                      placeholder="Briefly explain your connection to NITC."
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

              {!requestCredential ? (
                <div className="professional-auth-access-note">
                  <span className="professional-auth-access-dot" />
                  <div>
                    <strong>NITC Google account?</strong>
                    <span>You are automatically eligible for marketplace access.</span>
                  </div>
                </div>
              ) : null}

              {!requestCredential && webEnv.testLoginEnabled ? (
                <details className="test-login-disclosure professional-test-login">
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
                <div className="form-alert professional-auth-error" role="alert">
                  {serverError}
                </div>
              ) : null}

              <p className="simple-auth-note professional-auth-note">
                Your Google password is never shared with Campus Angadi.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="professional-auth-footer">
        <span>Campus Angadi · NIT Calicut</span>
        <span>Verified campus access</span>
      </footer>
    </div>
  )
}
