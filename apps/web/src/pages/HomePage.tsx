import type { ProductSummary } from '@campusbaza/contracts'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowRightIcon,
  CheckIcon,
  MessageIcon,
  PackageIcon,
  ShieldIcon,
} from '../components/ui/icons'
import { catalogApi } from '../features/products/api/catalog.api'
import { ProductGrid, ProductGridSkeleton } from '../features/products/components/ProductGrid'

export function HomePage() {
  const homepage = useQuery({ queryKey: ['homepage'], queryFn: catalogApi.homepage })
  const data = homepage.data

  return (
    <>
      <section className="hero-section">
        <div className="hero-ambient hero-ambient-one" />
        <div className="hero-ambient hero-ambient-two" />
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
                Offline payments only
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
                <strong>No online payment gateway</strong>
                <p>Payment and pickup are coordinated directly after the order is created.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="market-strip" aria-label="Marketplace highlights">
        <div className="container market-strip-inner">
          <span>
            <ShieldIcon /> NITC email verified
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

      <HomepageSection
        title="Featured on Campus Angadi"
        kicker="Selected for you"
        products={data?.sections.FEATURED.products ?? []}
        loading={homepage.isLoading}
      />
      <HomepageSection
        id="official"
        title="Official Campus Store"
        kicker="Administration"
        products={data?.sections.OFFICIAL.products ?? []}
        loading={homepage.isLoading}
        storePath="/official-store"
      />
      <HomepageSection
        id="secondhand"
        title="Second-Hand Marketplace"
        kicker="Community"
        products={data?.sections.SECOND_HAND.products ?? []}
        loading={homepage.isLoading}
        storePath="/second-hand-store"
      />
      <HomepageSection
        title="Recently added"
        kicker="Fresh listings"
        products={data?.sections.RECENT.products ?? []}
        loading={homepage.isLoading}
      />

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
