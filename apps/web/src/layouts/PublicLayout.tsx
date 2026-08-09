import { Link, Outlet } from 'react-router-dom'
import { Navbar } from '../components/layout/Navbar'
import { BrandLogo } from '../components/layout/BrandLogo'
import { SkipLink } from '../components/accessibility/SkipLink'

export function PublicLayout() {
  return (
    <div className="site-shell">
      <SkipLink />
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container site-footer-compact">
          <BrandLogo />
          <nav aria-label="Footer navigation">
            <Link to="/search">Official stores</Link>
            <Link to="/second-hand-store">Second-hand</Link>
            <Link to="/account/listings/new">Sell</Link>
            <Link to="/login">Sign in</Link>
          </nav>
          <span>© {new Date().getFullYear()} Campus Angadi · NIT Calicut</span>
        </div>
      </footer>
    </div>
  )
}
