import type { ProductSummary } from '@campusbaza/contracts'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
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
  const homepage = useQuery({ queryKey: ['homepage'], queryFn: catalogApi.homepage })
  const data = homepage.data

  return (
    <>
      <section className="hero-section">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">
              <span />
              Marketplace for your campus community
            </span>
            <h1>
              Buy campus essentials.
              <br />
              Sell what you no longer need.
              <br />
              <em>Confirm orders on WhatsApp.</em>
            </h1>
            <p>
              Campus Angaadi brings official products and approved second-hand listings together, with
              every order handled by a trusted sales-team member.
            </p>
            <div className="flex flex-wrap gap-4 mt-8">
              <Link className="group relative inline-flex items-center justify-center px-6 py-3 text-sm font-bold text-white transition-all duration-300 bg-gradient-to-r from-blue-600 to-indigo-600 border border-transparent rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 shadow-lg hover:shadow-xl hover:-translate-y-0.5 overflow-hidden" to="/official-store">
                <span className="absolute w-0 h-0 transition-all duration-500 ease-out bg-white rounded-full group-hover:w-64 group-hover:h-56 opacity-10"></span>
                <span className="relative flex items-center gap-2">Official Store</span>
              </Link>
              <Link className="group relative inline-flex items-center justify-center px-6 py-3 text-sm font-bold text-white transition-all duration-300 bg-gradient-to-r from-purple-600 to-pink-600 border border-transparent rounded-xl hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-600 shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:shadow-[0_0_25px_rgba(168,85,247,0.6)] hover:-translate-y-0.5 overflow-hidden" to="/second-hand-store">
                <span className="absolute inset-0 w-full h-full -mt-1 rounded-lg opacity-30 bg-gradient-to-b from-transparent via-transparent to-black"></span>
                <span className="relative flex items-center gap-2">Second-hand Store</span>
              </Link>
              <Link className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-gray-700 transition-all duration-200 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 shadow-sm hover:shadow dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700" to="/products">
                <SearchIcon /> <span className="ml-2">Browse All</span>
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
          <div className="support-panel">
            <div className="support-panel-head">
              <div>
                <MessageIcon />
                <strong>WhatsApp-assisted ordering</strong>
              </div>
              <span>AVAILABLE</span>
            </div>
            <div className="support-status">
              <span className="status-orb" />
              <div>
                <strong>Sales team assignment</strong>
                <p>Each saved order will be routed to an available Campus Angaadi dealer.</p>
              </div>
            </div>
            <div className="support-status">
              <ShieldIcon />
              <div>
                <strong>Privacy-safe communication</strong>
                <p>Dealer identities and workload remain private until an order is assigned.</p>
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

      <section className="section" id="browse">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Browse</span>
              <h2>Shop by category</h2>
            </div>
            <Link to="/products">
              View all <ArrowRightIcon />
            </Link>
          </div>
          {homepage.isLoading ? (
            <div className="category-row">
              <span>Loading categories…</span>
            </div>
          ) : (
            <div className="category-row">
              {(data?.categories ?? []).map((category) => (
                <Link key={category.id} to={`/products?category=${category.slug}`}>
                  {category.name}
                </Link>
              ))}
              {!data?.categories.length ? <span>No categories published yet.</span> : null}
            </div>
          )}
        </div>
      </section>

      <HomepageSection
        title="Featured on Campus Angaadi"
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
      />
      <HomepageSection
        id="secondhand"
        title="Second-Hand Marketplace"
        kicker="Community"
        products={data?.sections.SECOND_HAND.products ?? []}
        loading={homepage.isLoading}
        muted
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
              <h2>How Campus Angaadi orders work</h2>
            </div>
          </div>
          <div className="steps-grid">
            {[
              'Find a product',
              'Create the order',
              'Get a dealer',
              'Confirm on WhatsApp',
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
  muted = false,
}: {
  id?: string
  title: string
  kicker: string
  products?: ProductSummary[]
  loading: boolean
  muted?: boolean
}) {
  return (
    <section className={`section ${muted ? 'section-muted' : ''}`} id={id}>
      <div className="container">
        <div className="section-heading">
          <div>
            <span className="section-kicker">{kicker}</span>
            <h2>{title}</h2>
          </div>
          <Link to="/products">
            See all <ArrowRightIcon />
          </Link>
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
