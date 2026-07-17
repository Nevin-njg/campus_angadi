import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, NavLink } from 'react-router-dom'
import { useAuthStore } from '../../features/auth/store/use-auth-store'
import { cartApi } from '../../features/cart/api/cart.api'
import { notificationsApi } from '../../features/notifications/api/notifications.api'
import { BrandLogo } from './BrandLogo'
import { BellIcon, CartIcon, CloseIcon, MenuIcon, UserIcon } from '../ui/icons'

const links = [
  { to: '/', label: 'Home' },
  { to: '/official-store', label: 'Official Store' },
  { to: '/second-hand-store', label: 'Second-Hand' },
  { to: '/account/listings/new', label: 'Sell' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const user = useAuthStore((state) => state.user)
  const cart = useQuery({
    queryKey: ['cart'],
    queryFn: cartApi.get,
    enabled: Boolean(user),
    staleTime: 30_000,
  })
  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: notificationsApi.unread,
    enabled: Boolean(user),
    staleTime: 30_000,
  })
  return (
    <>
      <header className="navbar">
        <div className="container nav-inner">
          <BrandLogo />
          <nav className="desktop-nav" aria-label="Primary navigation">
            {links.map((link) => (
              <NavLink key={link.label} to={link.to} end={link.to === '/'}>
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="nav-actions">
            {user ? (
              <Link
                className="icon-button nav-cart-button"
                to="/cart"
                aria-label={`Cart with ${cart.data?.totalItems ?? 0} items`}
              >
                <CartIcon />
                {(cart.data?.totalItems ?? 0) > 0 ? (
                  <span>{Math.min(cart.data?.totalItems ?? 0, 99)}</span>
                ) : null}
              </Link>
            ) : null}
            {user ? (
              <Link
                className="icon-button nav-cart-button"
                to="/notifications"
                aria-label={`${unread.data?.count ?? 0} unread notifications`}
              >
                <BellIcon />
                {(unread.data?.count ?? 0) > 0 ? (
                  <span>{Math.min(unread.data?.count ?? 0, 99)}</span>
                ) : null}
              </Link>
            ) : null}
            {user?.role === 'MODERATOR' ||
            user?.role === 'ADMIN' ||
            user?.role === 'SUPER_ADMIN' ? (
              <Link
                className="button button-outline admin-nav-button"
                to={user.role === 'MODERATOR' ? '/admin/mediator' : '/admin/dashboard'}
              >
                {user.role === 'MODERATOR' ? 'Support' : 'Admin'}
              </Link>
            ) : null}
            {user ? (
              <Link className="button button-outline nav-account" to="/account/profile">
                <UserIcon />
                <span>{user.profile.displayName ?? user.email.split('@')[0]}</span>
              </Link>
            ) : (
              <Link className="button button-primary nav-sign-in" to="/login">
                Sign in
              </Link>
            )}
            <button
              className="icon-button mobile-menu-button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <MenuIcon />
            </button>
          </div>
        </div>
      </header>
      <button
        className={`drawer-overlay ${open ? 'open' : ''}`}
        onClick={() => setOpen(false)}
        aria-label="Close menu overlay"
      />
      <aside className={`mobile-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <BrandLogo />
          <button className="icon-button" onClick={() => setOpen(false)} aria-label="Close menu">
            <CloseIcon />
          </button>
        </div>
        <nav aria-label="Mobile navigation">
          {links.map((link) => (
            <NavLink key={link.label} to={link.to} onClick={() => setOpen(false)}>
              {link.label}
            </NavLink>
          ))}
          {user ? (
            <Link to="/cart" onClick={() => setOpen(false)}>
              Cart ({cart.data?.totalItems ?? 0})
            </Link>
          ) : null}
          {user?.role === 'MODERATOR' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' ? (
            <Link
              to={user.role === 'MODERATOR' ? '/admin/mediator' : '/admin/dashboard'}
              onClick={() => setOpen(false)}
            >
              {user.role === 'MODERATOR' ? 'Support inbox' : 'Admin panel'}
            </Link>
          ) : null}
          {user ? (
            <Link
              to="/account/profile"
              className="button button-primary"
              onClick={() => setOpen(false)}
            >
              My account
            </Link>
          ) : (
            <Link to="/login" className="button button-primary" onClick={() => setOpen(false)}>
              Sign in with email
            </Link>
          )}
        </nav>
      </aside>
    </>
  )
}
