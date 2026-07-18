import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authApi } from '../../auth/api/auth.api'
import { useAuthStore } from '../../auth/store/use-auth-store'
import { authUser } from '../../../test/fixtures'
import { renderApp } from '../../../test/render'
import { ProfilePage } from './ProfilePage'

describe('ProfilePage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    window.sessionStorage.clear()
    useAuthStore.setState({ user: null, status: 'anonymous' })
  })

  it('updates both the session and profile cache after completing a profile', async () => {
    const incomplete = authUser({
      profileCompleted: false,
      profile: {
        ...authUser().profile,
        fullName: null,
        displayName: null,
        department: null,
      },
    })
    const completed = authUser()
    useAuthStore.setState({ user: incomplete, status: 'authenticated' })
    vi.spyOn(authApi, 'getProfile').mockResolvedValue({ user: incomplete })
    vi.spyOn(authApi, 'updateProfile').mockResolvedValue({ user: completed })

    renderApp(<ProfilePage />, '/account/profile')

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Campus Student' } })
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Student' } })
    fireEvent.change(screen.getByLabelText('Department'), {
      target: { value: 'Computer Science' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save profile' }))

    await waitFor(() => expect(screen.getByText('Profile complete')).toBeInTheDocument())
    expect(useAuthStore.getState().user?.profileCompleted).toBe(true)
    expect(authApi.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ department: 'Computer Science' }),
    )
  })
})
