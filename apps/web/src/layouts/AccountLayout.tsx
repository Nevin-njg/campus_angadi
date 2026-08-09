import { NavLink, Outlet } from 'react-router-dom'
import { Navbar } from '../components/layout/Navbar'
import {
  LogOutIcon,
  MessageIcon,
  PackageIcon,
  ShoppingBagIcon,
  UserIcon,
} from '../components/ui/icons'
import { useAuthStore } from '../features/auth/store/use-auth-store'
import { SkipLink } from '../components/accessibility/SkipLink'
import { useConfirmation } from '../components/feedback/confirmation-context'

export function AccountLayout() {
  const logout = useAuthStore((state) => state.logout)
  const confirm = useConfirmation()
  return (
    <div className="site-shell">
      <SkipLink />
      <Navbar />
      <div className="student-account-layout">
        <div className="student-account-bar">
          <nav className="container student-account-nav" aria-label="Account navigation">
            <NavLink to="/account/profile">
              <UserIcon />
              Profile
            </NavLink>
            <NavLink to="/account/orders">
              <ShoppingBagIcon />
              Orders
            </NavLink>
            <NavLink to="/account/listings">
              <PackageIcon />
              Listings
            </NavLink>
            <NavLink to="/account/reports">
              <MessageIcon />
              Reports
            </NavLink>
            <button
              onClick={async () => {
                if (
                  await confirm({
                    title: 'Sign out?',
                    description: 'You will need to sign in again to access your account.',
                    confirmLabel: 'Sign out',
                  })
                )
                  await logout()
              }}
            >
              <LogOutIcon />
              Sign out
            </button>
          </nav>
        </div>
        <main className="container student-account-main" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
