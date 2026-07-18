import { Link, Outlet } from "react-router-dom";
import { Navbar } from "../components/layout/Navbar";
import { BrandLogo } from "../components/layout/BrandLogo";
import { SkipLink } from "../components/accessibility/SkipLink";

export function PublicLayout() {
  return (
    <div className="site-shell">
      <SkipLink />
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <BrandLogo />
            <p>
              A trusted official and peer-to-peer marketplace for your campus
              community.
            </p>
          </div>
          <div>
            <strong>Marketplace</strong>
            <Link to="/#official">Official Store</Link>
            <Link to="/#secondhand">Second-Hand</Link>
          </div>
          <div>
            <strong>Support</strong>
            <Link to="/#how-it-works">How it works</Link>
            <Link to="/login">Campus sign in</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          © {new Date().getFullYear()} Campus Angadi. Built for campus
          communities.
        </div>
      </footer>
    </div>
  );
}
