import type { ProductSummary } from '@campusbaza/contracts'
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRightIcon,
  CheckIcon,
  MessageIcon,
  PackageIcon,
  SearchIcon,
  ShieldIcon,
} from '../components/ui/icons'
import { catalogApi } from '../features/products/api/catalog.api'
import { ProductGrid, ProductGridSkeleton } from '../features/products/components/ProductGrid'

export function HomePage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const homepage = useQuery({
    queryKey: ['homepage'],
    queryFn: catalogApi.homepage,
  })
  const data = homepage.data

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = search.trim()
    void navigate(
      query ? `/second-hand-store?q=${encodeURIComponent(query)}` : '/second-hand-store',
    )
  }

  return (
    <>
      <section className="hero-section">
        <div className="hero-ambient hero-ambient-one" aria-hidden="true" />
        <div className="hero-ambient hero-ambient-two" aria-hidden="true" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">
              <span />
              Made at NIT Calicut, for NIT Calicut
            </span>
            <h1>
              Your campus has
              <br /> everything you need.
              <br /> <em>Find it here.</em>
            </h1>
            <p>
              Shop verified essentials, discover great second-hand finds, and sell to people you
              already share a campus with. Simple, safe, and unmistakably NITC.
            </p>
            <form className="hero-search" onSubmit={submitSearch} role="search">
              <SearchIcon />
              <label className="sr-only" htmlFor="homepage-search">
                Search the campus marketplace
              </label>
              <input
                id="homepage-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search books, cycles, electronics…"
                autoComplete="off"
              />
              <button className="button button-primary" type="submit">
                Search
              </button>
            </form>
            <div className="hero-quick-links" aria-label="Popular categories">
              <span>Popular:</span>
              <Link to="/second-hand-store?q=books">Books</Link>
              <Link to="/second-hand-store?q=cycles">Cycles</Link>
              <Link to="/second-hand-store?q=electronics">Electronics</Link>
              <Link to="/second-hand-store?q=hostel">Hostel essentials</Link>
            </div>
            <div className="hero-actions">
              <Link className="button button-primary button-large" to="/official-store">
                Shop official store <ArrowRightIcon />
              </Link>
              <Link className="button button-outline button-large" to="/second-hand-store">
                Shop second-hand
              </Link>
            </div>
            <div className="trust-row">
              <span>
                <CheckIcon />
                Domain-restricted users
              </span>
              <span>
                <CheckIcon />
                Admin-reviewed listings
              </span>
              <span>
                <CheckIcon />
                Safe campus pickup
              </span>
            </div>
          </div>
          <div className="hero-market-card">
            <div className="hero-market-topline">
              <span>LIVE ON CAMPUS</span>
              <small>Updated now</small>
            </div>
            <div className="hero-market-visual">
              <div className="market-tile market-tile-main">
                <span className="market-icon">
                  <PackageIcon />
                </span>
                <small>Featured find</small>
                <strong>
                  Everything campus,
                  <br />
                  one marketplace.
                </strong>
                <Link to="/official-store">
                  Shop official store <ArrowRightIcon />
                </Link>
              </div>
              <div className="market-tile market-tile-mini">
                <span>OFFICIAL</span>
                <strong>
                  Campus
                  <br />
                  essentials
                </strong>
              </div>
              <div className="market-tile market-tile-mini warm">
                <span>PRE-LOVED</span>
                <strong>
                  Better deals.
                  <br />
                  Less waste.
                </strong>
              </div>
            </div>
            <div className="hero-market-proof">
              <div>
                <strong>Verified</strong>
                <span>NITC community</span>
              </div>
              <div>
                <strong>Reviewed</strong>
                <span>Safer listings</span>
              </div>
              <div>
                <strong>Local</strong>
                <span>Easy pickup</span>
              </div>
            </div>
          </div>
          <div className="support-panel hero-support-panel">
            <div className="support-panel-head">
              <div>
                <MessageIcon />
                <strong>In-app order support</strong>
              </div>
              <span>AVAILABLE</span>
            </div>
            <div className="support-status">
              <span className="status-orb" />
              <div>
                <strong>Sales team assignment</strong>
                <p>Every saved order is routed to an available Campus Angadi dealer.</p>
              </div>
            </div>
            <div className="support-status">
              <ShieldIcon />
              <div>
                <strong>Private mediated chat</strong>
                <p>Buyers speak only with the Campus Angadi team—never directly with sellers.</p>
              </div>
            </div>
            <div className="support-status">
              <PackageIcon />
              <div>
                <strong>Safer campus handoff</strong>
                <p>Payment and pickup details are coordinated after the order is confirmed.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="market-strip" aria-label="Marketplace highlights">
        <div className="container market-strip-inner">
          <span>
            <ShieldIcon /> Campus access controlled
          </span>
          <span>
            <PackageIcon /> Official + student listings
          </span>
          <span>
            <MessageIcon /> Human-assisted ordering
          </span>
          <span>
            <CheckIcon /> No hidden platform fee
          </span>
        </div>
      </section>

      {homepage.isError ? (
        <section className="section" aria-live="polite">
          <div className="container catalog-empty homepage-error-state" role="alert">
            <PackageIcon />
            <strong>We couldn’t load the marketplace</strong>
            <span>Check your connection and try again. Your account and cart are safe.</span>
            <button className="button button-primary" onClick={() => void homepage.refetch()}>
              Try again
            </button>
          </div>
        </section>
      ) : (
        <>
          <HomepageSection
            title="Featured on Campus Angadi"
            kicker="Selected for you"
            products={data?.sections?.FEATURED?.products ?? []}
            loading={homepage.isLoading}
          />
          <HomepageSection
            id="official"
            title="Official Campus Store"
            kicker="Administration"
            products={data?.sections?.OFFICIAL?.products ?? []}
            loading={homepage.isLoading}
            storePath="/official-store"
          />
          <HomepageSection
            id="secondhand"
            title="Second-Hand Marketplace"
            kicker="Community"
            products={data?.sections?.SECOND_HAND?.products ?? []}
            loading={homepage.isLoading}
            storePath="/second-hand-store"
          />
          <HomepageSection
            title="Recently added"
            kicker="Fresh listings"
            products={data?.sections?.RECENT?.products ?? []}
            loading={homepage.isLoading}
          />
        </>
      )}

      <section className="section" id="how-it-works">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Simple workflow</span>
              <h2>From “I need it” to “got it”</h2>
            </div>
          </div>
          <div className="steps-grid">
            {[
              'Find a product',
              'Create the order',
              'Get a dealer',
              'Chat with our team',
              'Collect on campus',
            ].map((step, index) => (
              <div className="step-card" key={step}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{step}</strong>
                {index < 4 ? <ArrowRightIcon /> : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

function HomepageSection({
  id,
  title,
  kicker,
  products,
  loading,
  storePath,
}: {
  id?: string
  title: string
  kicker: string
  products?: ProductSummary[]
  loading: boolean
  storePath?: string
}) {
  return (
    <section className="section" id={id}>
      <div className="container">
        <div className="section-heading">
          <div>
            <span className="section-kicker">{kicker}</span>
            <h2>{title}</h2>
          </div>
          {storePath ? (
            <Link to={storePath}>
              See all <ArrowRightIcon />
            </Link>
          ) : null}
        </div>
        {loading ? (
          <ProductGridSkeleton count={4} />
        ) : (
          <ProductGrid
            products={products ?? []}
            emptyMessage="No eligible products are available in this section yet."
          />
        )}
      </div>
    </section>
  )
}
