import { NavLink, Outlet } from 'react-router-dom'
import { Navbar } from '../components/layout/Navbar'
import { AlertIcon, LogOutIcon, MessageIcon, PackageIcon, UserIcon } from '../components/ui/icons'
import { useAuthStore } from '../features/auth/store/use-auth-store'
import { SkipLink } from '../components/accessibility/SkipLink'

export function AccountLayout() {
  const logout = useAuthStore((state) => state.logout)
  return (
    <div className="site-shell">
      <SkipLink />
      <Navbar />
      <div className="container account-shell">
        <aside className="account-sidebar" aria-label="Account navigation">
          <p className="account-sidebar-title">My Campus Angaadi</p>
          <NavLink to="/account/profile">
            <UserIcon />
            Profile
          </NavLink>
          <NavLink to="/account/orders">
            <PackageIcon />
            My orders
          </NavLink>
          <NavLink to="/account/listings">
            <PackageIcon />
            My listings
          </NavLink>
          <NavLink to="/account/notifications">
            <AlertIcon />
            Notifications
          </NavLink>
          <NavLink to="/account/reports">
            <MessageIcon />
            My reports
          </NavLink>
          <button onClick={() => void logout()}>
            <LogOutIcon />
            Sign out
          </button>
        </aside>
        <main className="account-content" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
