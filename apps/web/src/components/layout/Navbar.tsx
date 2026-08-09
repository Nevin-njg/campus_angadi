import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../features/auth/store/use-auth-store'
import { cartApi } from '../../features/cart/api/cart.api'
import { notificationsApi } from '../../features/notifications/api/notifications.api'
import { BrandLogo } from './BrandLogo'
import {
  BellIcon,
  CartIcon,
  CloseIcon,
  ImagePlusIcon,
  MapPinIcon,
  MenuIcon,
  PackageIcon,
  SearchIcon,
  UserIcon,
} from '../ui/icons'
import { queryKeys } from '../../lib/query-keys'

const links = [
  { to: '/', label: 'Home' },
  { to: '/search', label: 'Stores' },
  { to: '/second-hand-store', label: 'Second-Hand' },
  { to: '/account/listings/new', label: 'Sell' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const user = useAuthStore((state) => state.user)
  const cart = useQuery({
    queryKey: queryKeys.cart(user?.id ?? ''),
    queryFn: cartApi.get,
    enabled: Boolean(user),
    staleTime: 30_000,
  })
  const unread = useQuery({
    queryKey: queryKeys.notifications.unread(user?.id ?? ''),
    queryFn: notificationsApi.unread,
    enabled: Boolean(user),
    staleTime: 30_000,
  })

  useEffect(() => setOpen(false), [location.pathname])

  useEffect(() => {
    const currentQuery = new URLSearchParams(location.search).get('q') ?? ''
    setSearch(currentQuery)
  }, [location.search])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      window.requestAnimationFrame(() => menuButtonRef.current?.focus())
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  function closeMenu() {
    setOpen(false)
    window.requestAnimationFrame(() => menuButtonRef.current?.focus())
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = search.trim()
    void navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search')
  }

  return (
    <>
      <header className="navbar">
        <div className="container nav-inner">
          <BrandLogo />
          <Link className="nav-location" to="/search" aria-label="Shopping at campus">
            <MapPinIcon />
            <span>
              <small>Shopping at</small>
              <strong>campus</strong>
            </span>
          </Link>
          <form className="nav-search" onSubmit={submitSearch} role="search">
            <label className="sr-only" htmlFor="site-search">
              Search products and stores
            </label>
            <input
              id="site-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products and campus stores"
              autoComplete="off"
            />
            <button type="submit" aria-label="Search">
              <SearchIcon />
            </button>
          </form>
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
            {user?.role === 'SELLER' ? (
              <Link className="button button-outline admin-nav-button" to="/seller">
                Seller panel
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
              ref={menuButtonRef}
              className="icon-button mobile-menu-button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="mobile-navigation"
            >
              <MenuIcon />
            </button>
          </div>
        </div>
        <div className="nav-commerce-bar">
          <div className="container nav-commerce-inner">
            <nav className="desktop-nav" aria-label="Primary navigation">
              {links.map((link) => (
                <NavLink key={link.label} to={link.to} end={link.to === '/'}>
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>
      <button
        className={`drawer-overlay ${open ? 'open' : ''}`}
        onClick={closeMenu}
        aria-label="Close menu overlay"
        tabIndex={open ? 0 : -1}
      />
      <aside
        id="mobile-navigation"
        className={`mobile-drawer ${open ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!open}
      >
        <div className="drawer-head">
          <BrandLogo />
          <button
            ref={closeButtonRef}
            className="icon-button"
            onClick={closeMenu}
            aria-label="Close menu"
          >
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
          {user?.role === 'SELLER' ? (
            <Link to="/seller" onClick={() => setOpen(false)}>
              Seller panel
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
              Sign in with Google
            </Link>
          )}
        </nav>
      </aside>
      <nav className="mobile-bottom-nav" aria-label="Mobile shopping navigation">
        <NavLink to="/" end>
          <PackageIcon />
          <span>Home</span>
        </NavLink>
        <NavLink
          to="/search"
          className={({ isActive }: { isActive: boolean }) =>
            isActive || location.pathname === '/second-hand-store' ? 'active' : undefined
          }
        >
          <SearchIcon />
          <span>Browse</span>
        </NavLink>
        <NavLink className="mobile-bottom-sell" to="/account/listings/new">
          <span className="mobile-bottom-sell-icon">
            <ImagePlusIcon />
          </span>
          <span>Sell</span>
        </NavLink>
        <NavLink className="mobile-bottom-cart" to="/cart">
          <CartIcon />
          {(cart.data?.totalItems ?? 0) > 0 ? (
            <small>{Math.min(cart.data?.totalItems ?? 0, 99)}</small>
          ) : null}
          <span>Cart</span>
        </NavLink>
        <NavLink to={user ? '/account/profile' : '/login'}>
          <UserIcon />
          <span>{user ? 'Account' : 'Sign in'}</span>
        </NavLink>
      </nav>
    </>
  )
}
