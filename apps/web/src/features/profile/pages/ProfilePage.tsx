import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '../../../components/ui/Button'
import { FormField, TextAreaField } from '../../../components/ui/FormField'
import { ShieldIcon, UserIcon } from '../../../components/ui/icons'
import { ApiClientError } from '../../../lib/api-client'
import { authApi } from '../../auth/api/auth.api'
import { useAuthStore } from '../../auth/store/use-auth-store'
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton'

const profileFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(80),
  displayName: z.string().trim().min(2, 'Enter a display name.').max(40),
  phoneNumber: z.string().trim().max(20),
  department: z.string().trim().min(2, 'Enter your department.').max(80),
  graduationYear: z
    .string()
    .trim()
    .refine(
      (value) =>
        !value || (/^\d{4}$/.test(value) && Number(value) >= 2000 && Number(value) <= 2100),
      'Enter a valid year.',
    ),
  campusRole: z.string().trim().max(50),
  preferredPickupLocation: z.string().trim().max(120),
  bio: z.string().trim().max(240),
})

type ProfileForm = z.infer<typeof profileFormSchema>

export function ProfilePage() {
  const currentUser = useAuthStore((state) => state.user)
  const updateUser = useAuthStore((state) => state.updateUser)
  const logoutAll = useAuthStore((state) => state.logoutAll)
  const [message, setMessage] = useState<string | null>(null)

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
    initialData: currentUser ? { user: currentUser } : undefined,
  })

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: '',
      displayName: '',
      phoneNumber: '',
      department: '',
      graduationYear: '',
      campusRole: '',
      preferredPickupLocation: '',
      bio: '',
    },
  })

  useEffect(() => {
    const user = profileQuery.data?.user
    if (!user) return
    form.reset({
      fullName: user.profile.fullName ?? '',
      displayName: user.profile.displayName ?? '',
      phoneNumber: user.profile.phoneNumber ?? '',
      department: user.profile.department ?? '',
      graduationYear: user.profile.graduationYear?.toString() ?? '',
      campusRole: user.profile.campusRole ?? '',
      preferredPickupLocation: user.profile.preferredPickupLocation ?? '',
      bio: user.profile.bio ?? '',
    })
  }, [form, profileQuery.data?.user])

  const mutation = useMutation({
    mutationFn: (values: ProfileForm) =>
      authApi.updateProfile({
        fullName: values.fullName,
        displayName: values.displayName,
        phoneNumber: values.phoneNumber || null,
        department: values.department,
        graduationYear: values.graduationYear ? Number(values.graduationYear) : null,
        campusRole: values.campusRole || null,
        preferredPickupLocation: values.preferredPickupLocation || null,
        bio: values.bio || null,
      }),
    onSuccess(result) {
      updateUser(result.user)
      setMessage('Your profile has been saved.')
    },
    onError(error) {
      setMessage(error instanceof ApiClientError ? error.message : 'Unable to save your profile.')
    },
  })

  if (profileQuery.isLoading) return <LoadingSkeleton label="Loading profile" />
  const user = profileQuery.data?.user
  if (!user) return <div className="content-card form-alert">The profile could not be loaded.</div>

  return (
    <div className="profile-page">
      <div className="page-heading">
        <div>
          <span className="section-kicker">Account</span>
          <h1>Your profile</h1>
          <p>Complete the required details before listing a second-hand product.</p>
        </div>
        <span className={`completion-pill ${user.profileCompleted ? 'complete' : ''}`}>
          {user.profileCompleted ? 'Profile complete' : 'Profile incomplete'}
        </span>
      </div>

      <div className="profile-grid">
        <section className="content-card">
          <div className="card-heading">
            <div className="auth-icon small">
              <UserIcon />
            </div>
            <div>
              <h2>Campus details</h2>
              <p>Your verified email and role cannot be changed here.</p>
            </div>
          </div>
          <div className="verified-email">
            <ShieldIcon />
            <div>
              <span>Verified campus email</span>
              <strong>{user.email}</strong>
            </div>
            <span className="verified-badge">Verified</span>
          </div>
          <form
            className="profile-form"
            onSubmit={(event) => void form.handleSubmit((values) => mutation.mutate(values))(event)}
            noValidate
          >
            <div className="form-grid two-columns">
              <FormField
                label="Full name"
                error={form.formState.errors.fullName?.message}
                {...form.register('fullName')}
              />
              <FormField
                label="Display name"
                error={form.formState.errors.displayName?.message}
                {...form.register('displayName')}
              />
              <FormField
                label="Phone number"
                error={form.formState.errors.phoneNumber?.message}
                {...form.register('phoneNumber')}
              />
              <FormField
                label="Department"
                error={form.formState.errors.department?.message}
                {...form.register('department')}
              />
              <FormField
                label="Graduation year"
                inputMode="numeric"
                error={form.formState.errors.graduationYear?.message}
                {...form.register('graduationYear')}
              />
              <FormField
                label="Campus role"
                placeholder="Student, staff, faculty…"
                error={form.formState.errors.campusRole?.message}
                {...form.register('campusRole')}
              />
            </div>
            <FormField
              label="Preferred pickup location"
              error={form.formState.errors.preferredPickupLocation?.message}
              {...form.register('preferredPickupLocation')}
            />
            <TextAreaField
              label="Short bio"
              rows={4}
              error={form.formState.errors.bio?.message}
              {...form.register('bio')}
            />
            {message ? (
              <div className={mutation.isError ? 'form-alert' : 'form-success'} role="status">
                {message}
              </div>
            ) : null}
            <Button type="submit" loading={mutation.isPending}>
              Save profile
            </Button>
          </form>
        </section>

        <aside className="profile-side">
          <div className="content-card">
            <h3>Account access</h3>
            <dl>
              <div>
                <dt>Role</dt>
                <dd>{user.role.replace('_', ' ')}</dd>
              </div>
              <div>
                <dt>Selling permission</dt>
                <dd>{user.canSell ? 'Enabled' : 'Suspended'}</dd>
              </div>
              <div>
                <dt>Joined</dt>
                <dd>{new Date(user.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </div>
          <div className="content-card danger-card">
            <h3>Session security</h3>
            <p>Sign out every device currently connected to this account.</p>
            <Button variant="danger" onClick={() => void logoutAll()}>
              Sign out all devices
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}
