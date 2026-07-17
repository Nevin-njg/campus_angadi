import { zodResolver } from '@hookform/resolvers/zod'
import { verifyOtpInputSchema, type VerifyOtpInput } from '@campusbaza/contracts'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../../../components/layout/BrandLogo'
import { Button } from '../../../components/ui/Button'
import { FormField } from '../../../components/ui/FormField'
import { MailIcon, ShieldIcon } from '../../../components/ui/icons'
import { ApiClientError } from '../../../lib/api-client'
import { authApi } from '../api/auth.api'
import { useAuthStore } from '../store/use-auth-store'

export function VerifyOtpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const establishSession = useAuthStore((state) => state.establishSession)
  const user = useAuthStore((state) => state.user)
  const storedEmail = window.sessionStorage.getItem('campusbaza-login-email')
  const email = storedEmail ?? ''
  const maskedEmail = (location.state as { maskedEmail?: string } | null)?.maskedEmail ?? email
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      void navigate('/', { replace: true })
    }
  }, [user, navigate])
  const [resendAt, setResendAt] = useState(() =>
    Number(window.sessionStorage.getItem('campusbaza-resend-after') ?? Date.now()),
  )
  const [now, setNow] = useState(Date.now())
  const form = useForm<VerifyOtpInput>({
    resolver: zodResolver(verifyOtpInputSchema),
    defaultValues: { email: email ?? '', code: '' },
  })

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const resendSeconds = useMemo(
    () => Math.max(0, Math.ceil((resendAt - now) / 1000)),
    [now, resendAt],
  )

  if (!storedEmail) return <Navigate to="/login" replace />

  const submit = form.handleSubmit(async (input) => {
    setServerError(null)
    try {
      const result = await authApi.verifyOtp({ ...input, email })
      establishSession(result.accessToken, result.user)
      window.sessionStorage.removeItem('campusbaza-login-email')
      window.sessionStorage.removeItem('campusbaza-resend-after')
      void navigate(result.user.profileCompleted ? '/' : '/account/profile', { replace: true })
    } catch (error) {
      setServerError(
        error instanceof ApiClientError ? error.message : 'The code could not be verified.',
      )
    }
  })

  async function resend(): Promise<void> {
    setServerError(null)
    try {
      const result = await authApi.requestOtp({ email })
      const next = Date.now() + result.resendAfterSeconds * 1000
      setResendAt(next)
      window.sessionStorage.setItem('campusbaza-resend-after', String(next))
      form.setValue('code', '')
    } catch (error) {
      setServerError(error instanceof ApiClientError ? error.message : 'Unable to resend the code.')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <BrandLogo />
        <div className="auth-visual-copy">
          <span className="eyebrow">
            <span />
            Check your inbox
          </span>
          <h1>
            Your campus identity,
            <br />
            <em>verified in seconds.</em>
          </h1>
          <p>The code is single-use and expires automatically.</p>
          <div className="auth-trust">
            <ShieldIcon />
            <div>
              <strong>Never share your code</strong>
              <span>Campus Angadi staff will never ask for this code through chat or a call.</span>
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
          <h2>Enter your login code</h2>
          <p>
            We sent a six-digit code to <strong>{maskedEmail}</strong>.
          </p>
          <form onSubmit={(event) => void submit(event)} noValidate>
            <input type="hidden" {...form.register('email')} value={email} />
            <FormField
              label="Six-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              className="otp-input"
              error={form.formState.errors.code?.message}
              {...form.register('code', {
                setValueAs: (value: unknown) =>
                  typeof value === 'string' ? value.replace(/\D/g, '').slice(0, 6) : '',
              })}
            />
            {serverError ? (
              <div className="form-alert" role="alert">
                {serverError}
              </div>
            ) : null}
            <Button type="submit" loading={form.formState.isSubmitting}>
              Verify and sign in
            </Button>
          </form>
          <button
            className="resend-button"
            disabled={resendSeconds > 0}
            onClick={() => void resend()}
          >
            {resendSeconds > 0 ? `Resend available in ${resendSeconds}s` : 'Resend login code'}
          </button>
          <Link className="back-link" to="/login">
            ← Use a different email
          </Link>
        </div>
      </main>
    </div>
  )
}
