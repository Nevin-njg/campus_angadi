import type { ProductSummary } from '@campusbaza/contracts'
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRightIcon, PackageIcon, SearchIcon } from '../components/ui/icons'
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
    void navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search')
  }

  return (
    <>
      <section className="home-discovery">
        <div className="container home-discovery-inner">
          <div className="home-discovery-heading">
            <div>
              <span>Campus Angadi · NIT Calicut</span>
              <h1>What do you need today?</h1>
              <p>Campus essentials and student-to-student deals, all in one place.</p>
            </div>
            <Link className="home-sell-link" to="/account/listings/new" aria-label="Sell an item">
              <span className="home-sell-label-full">Sell an item</span>
              <span className="home-sell-label-short" aria-hidden="true">
                Sell
              </span>
              <ArrowRightIcon />
            </Link>
          </div>
          <form className="home-product-search" onSubmit={submitSearch} role="search">
            <div>
              <SearchIcon />
              <label className="sr-only" htmlFor="homepage-search">
                Search the campus marketplace
              </label>
              <input
                id="homepage-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search books, cycles, electronics, hostel essentials…"
                autoComplete="off"
              />
            </div>
            <button type="submit">Search</button>
          </form>
          <nav className="home-shortcuts" aria-label="Popular student searches">
            <span>Popular</span>
            <Link to="/search?q=books">Books</Link>
            <Link to="/search?q=cycles">Cycles</Link>
            <Link to="/search?q=electronics">Electronics</Link>
            <Link to="/search?q=hostel">Hostel essentials</Link>
            <Link to="/second-hand-store">All second-hand</Link>
          </nav>
          <div className="home-commerce-links">
            <Link to="/search">
              <strong>Official stores</strong>
              <span>Shop new campus essentials</span>
              <ArrowRightIcon />
            </Link>
            <Link to="/second-hand-store">
              <strong>Student marketplace</strong>
              <span>Find affordable pre-owned items</span>
              <ArrowRightIcon />
            </Link>
          </div>
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
            title="Popular on campus"
            products={data?.sections?.FEATURED?.products ?? []}
            loading={homepage.isLoading}
            storePath="/search"
          />
          <HomepageSection
            id="official"
            title="Official campus essentials"
            products={data?.sections?.OFFICIAL?.products ?? []}
            loading={homepage.isLoading}
            storePath="/search"
          />
          <HomepageSection
            id="secondhand"
            title="Deals from students"
            products={data?.sections?.SECOND_HAND?.products ?? []}
            loading={homepage.isLoading}
            storePath="/second-hand-store"
          />
          <HomepageSection
            title="Recently added"
            products={data?.sections?.RECENT?.products ?? []}
            loading={homepage.isLoading}
            storePath="/search"
          />
        </>
      )}
    </>
  )
}

function HomepageSection({
  id,
  title,
  products,
  loading,
  storePath,
}: {
  id?: string
  title: string
  products?: ProductSummary[]
  loading: boolean
  storePath?: string
}) {
  return (
    <section className="section" id={id}>
      <div className="container">
        <div className="section-heading">
          <h2>{title}</h2>
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
