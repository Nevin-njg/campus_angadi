import { zodResolver } from '@hookform/resolvers/zod'
import { requestOtpInputSchema, type RequestOtpInput } from '@campusbaza/contracts'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { BrandLogo } from '../../../components/layout/BrandLogo'
import { ThemeToggle } from '../../../components/layout/ThemeToggle'
import { Button } from '../../../components/ui/Button'
import { FormField } from '../../../components/ui/FormField'
import { MailIcon, ShieldIcon } from '../../../components/ui/icons'
import { ApiClientError } from '../../../lib/api-client'
import { authApi } from '../api/auth.api'
import { useAuthStore } from '../store/use-auth-store'
import { useEffect } from 'react'
import { rememberReturnTo } from '../lib/auth-return'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const user = useAuthStore((state) => state.user)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      void navigate('/', { replace: true })
    }
  }, [user, navigate])

  useEffect(() => {
    const routeState = location.state as { from?: string } | null
    rememberReturnTo(searchParams.get('returnTo') ?? routeState?.from)
  }, [location.state, searchParams])
  const form = useForm<RequestOtpInput>({
    resolver: zodResolver(requestOtpInputSchema),
    defaultValues: { email: '' },
  })

  const submit = form.handleSubmit(async (input) => {
    setServerError(null)
    try {
      const result = await authApi.requestOtp(input)
      window.sessionStorage.setItem('campusbaza-login-email', input.email.trim().toLowerCase())
      window.sessionStorage.setItem(
        'campusbaza-resend-after',
        String(Date.now() + result.resendAfterSeconds * 1000),
      )
      void navigate('/verify-otp', {
        state: { maskedEmail: result.maskedEmail },
      })
    } catch (error) {
      setServerError(
        error instanceof ApiClientError
          ? error.message
          : 'Unable to send a login code. Please try again.',
      )
    }
  })

  return (
    <div className="auth-page">
      <div className="auth-theme-control">
        <ThemeToggle />
      </div>
      <div className="auth-visual">
        <BrandLogo />
        <div className="auth-visual-copy">
          <span className="eyebrow">
            <span />
            Passwordless campus access
          </span>
          <h1>
            One verified email.
            <br />
            One secure code.
            <br />
            <em>No password to remember.</em>
          </h1>
          <p>
            Sign in with an email domain approved by the Campus Angadi team. Access is limited to
            verified members of your campus community.
          </p>
          <div className="auth-trust">
            <ShieldIcon />
            <div>
              <strong>Protected by short-lived OTPs</strong>
              <span>Codes expire, cannot be reused, and have strict attempt limits.</span>
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
            <MailIcon />
          </div>
          <h2>Sign in to Campus Angadi</h2>
          <p>Enter your approved email. We’ll send a six-digit login code.</p>
          <form onSubmit={(event) => void submit(event)} noValidate>
            <FormField
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@campus.edu"
              error={form.formState.errors.email?.message}
              {...form.register('email')}
            />
            {serverError ? (
              <div className="form-alert" role="alert">
                {serverError}
              </div>
            ) : null}
            <Button type="submit" loading={form.formState.isSubmitting}>
              Send login code
            </Button>
          </form>
          <p className="auth-footnote">
            No password or social login. Approved domain rules are enforced by the backend.
          </p>
          <Link className="back-link" to="/">
            ← Return to homepage
          </Link>
        </div>
      </main>
    </div>
  )
}
