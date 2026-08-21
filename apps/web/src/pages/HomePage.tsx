import type {
  DynamicHomepageSection,
  ProductSummary,
} from '@campusbaza/contracts'
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRightIcon,
  PackageIcon,
  SearchIcon,
} from '../components/ui/icons'
import { catalogApi } from '../features/products/api/catalog.api'
import {
  storesApi,
  type StoreDepartment,
  type StoreDepartmentCardTheme,
} from '../features/stores/api/stores.api'
import {
  ProductGrid,
  ProductGridSkeleton,
} from '../features/products/components/ProductGrid'

export function HomePage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const homepage = useQuery({
    queryKey: ['dynamic-homepage'],
    queryFn: catalogApi.dynamicHomepage,
  })

  const data = homepage.data

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const query = search.trim()

    void navigate(
      query
        ? `/search?q=${encodeURIComponent(query)}&scope=all`
        : '/search',
    )
  }

  return (
    <>
      <section className="home-discovery">
        <div className="container home-discovery-inner">
          <div className="home-discovery-heading">
            <div>
              <span>
                Campus Angadi · Campus marketplace
              </span>

              <h1>What do you need today?</h1>

              <p>
                Campus essentials and student-to-student
                deals, all in one place.
              </p>
            </div>

          </div>

          <form
            className="home-product-search"
            onSubmit={submitSearch}
            role="search"
          >
            <div>
              <SearchIcon />

              <label
                className="sr-only"
                htmlFor="homepage-search"
              >
                Search the campus marketplace
              </label>

              <input
                id="homepage-search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search products and campus stores"
                autoComplete="off"
              />
            </div>

            <button type="submit">
              Search
            </button>
          </form>
        </div>
      </section>

      <DepartmentBrowseSection />

      {homepage.isError ? (
        <section className="section" aria-live="polite">
          <div
            className="container catalog-empty homepage-error-state"
            role="alert"
          >
            <PackageIcon />

            <strong>
              We couldn’t load the marketplace
            </strong>

            <span>
              Check your connection and try again.
            </span>

            <button
              className="button button-primary"
              onClick={() =>
                void homepage.refetch()
              }
            >
              Try again
            </button>
          </div>
        </section>
      ) : homepage.isLoading ? (
        <>
          <LoadingHomepageSection />
          <LoadingHomepageSection />
          <LoadingHomepageSection />
        </>
      ) : (
        data?.sections.map((section) => (
          <DynamicSection
            key={section.id}
            section={section}
          />
        ))
      )}
    </>
  )
}


const DEPARTMENT_THEME_CONTENT: Record<
  StoreDepartmentCardTheme,
  {
    stickers: string[]
    fallbackDescription: string
  }
> = {
  FOOD: {
    stickers: ['🍔', '🍟', '☕', '🍕', '🥤'],
    fallbackDescription: 'Meals, snacks and drinks',
  },
  SPORTS: {
    stickers: ['⚽', '🏸', '🏀', '🏋️', '🏏'],
    fallbackDescription: 'Gear, fitness and games',
  },
  STATIONERY: {
    stickers: ['✏️', '📒', '📏', '📎', '🖊️'],
    fallbackDescription: 'Books, notes and supplies',
  },
  ELECTRONICS: {
    stickers: ['🎧', '⌨️', '🖱️', '🔌', '💻'],
    fallbackDescription: 'Devices and accessories',
  },
  GROCERY: {
    stickers: ['🛒', '🥛', '🥤', '🍪', '🧃'],
    fallbackDescription: 'Daily campus essentials',
  },
  FASHION: {
    stickers: ['👕', '🧢', '👟', '👜', '🕶️'],
    fallbackDescription: 'Clothing and accessories',
  },
  CUSTOM: {
    stickers: ['🎨', '✨', '⭐', '🛍️', '💫'],
    fallbackDescription: 'Explore this department',
  },
  GENERAL: {
    stickers: ['✨', '📦', '🛍️', '⭐', '🎁'],
    fallbackDescription: 'Explore campus stores',
  },
}

function DepartmentBrowseSection() {
  const [showAllDepartments, setShowAllDepartments] = useState(false)

  const departments = useQuery({
    queryKey: ['store-departments'],
    queryFn: storesApi.departments,
    staleTime: 60_000,
  })

  if (departments.isError) return null

  if (departments.isLoading) {
    return (
      <section className="section home-departments-section">
        <div className="container">
          <div className="section-heading">
            <h2>Browse Departments</h2>
          </div>

          <div className="home-department-grid">
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="home-department-card home-department-skeleton"
              />
            ))}
          </div>
        </div>
      </section>
    )
  }

  const items = departments.data ?? []

  if (!items.length) return null

  return (
    <section className="section home-departments-section">
      <div className="container">
        <div className="section-heading home-department-desktop-heading">
          <div>
            <h2>Browse Departments</h2>
            <p className="home-department-heading-copy">
              Find campus stores by what you need.
            </p>
          </div>

          <Link to="/search?type=stores">
            View all stores <ArrowRightIcon />
          </Link>
        </div>

        <div className="home-department-grid">
          {items.map((department, index) => (
            <DepartmentCard
              key={department.id}
              department={department}
              mobileHidden={index >= 6 && !showAllDepartments}
            />
          ))}
        </div>

        {items.length > 6 ? (
          <button
            type="button"
            className="home-department-show-more"
            onClick={() =>
              setShowAllDepartments((current) => !current)
            }
          >
            {showAllDepartments
              ? 'Show fewer departments'
              : 'View all departments'}
            <ArrowRightIcon />
          </button>
        ) : null}
      </div>
    </section>
  )
}

function DepartmentCard({
  department,
  mobileHidden = false,
}: {
  department: StoreDepartment
  mobileHidden?: boolean
}) {
  const theme =
    DEPARTMENT_THEME_CONTENT[department.cardTheme] ??
    DEPARTMENT_THEME_CONTENT.GENERAL

  const isCustom = department.cardTheme === 'CUSTOM'

  const stickers =
    isCustom && department.customStickers?.length
      ? department.customStickers
      : theme.stickers

  const customBackgroundStart =
    department.customBackgroundStart ?? '#F5EDFF'

  const customBackgroundEnd =
    department.customBackgroundEnd ?? '#E9DCFF'

  return (
    <Link
      to={`/search?department=${encodeURIComponent(
        department.id,
      )}&type=stores`}
      className={`home-department-card home-department-${department.cardTheme.toLowerCase()} ${
        mobileHidden ? 'home-department-mobile-hidden' : ''
      }`}
      style={
        isCustom
          ? {
              background: `linear-gradient(135deg, ${customBackgroundStart}, ${customBackgroundEnd})`,
            }
          : undefined
      }
    >
      <div
        className="home-department-stickers"
        aria-hidden="true"
      >
        {stickers.map((sticker, index) => (
          <span
            key={`${sticker}-${index}`}
            className={`home-department-sticker sticker-${index + 1}`}
          >
            {sticker}
          </span>
        ))}
      </div>

      <div className="home-department-card-content">
        <span className="home-department-eyebrow">
          Campus stores
        </span>

        <h3>{department.name}</h3>

        <p>
          {department.description ||
            theme.fallbackDescription}
        </p>

        <span className="home-department-link">
          View stores <ArrowRightIcon />
        </span>
      </div>
    </Link>
  )
}

function LoadingHomepageSection() {
  return (
    <section className="section">
      <div className="container">
        <ProductGridSkeleton count={4} />
      </div>
    </section>
  )
}

function DynamicSection({
  section,
}: {
  section: DynamicHomepageSection
}) {
  if (section.type === 'STORE_CATEGORY') {
    return (
      <StoreHomepageSection section={section} />
    )
  }

  return (
    <ProductHomepageSection
      section={section}
    />
  )
}

function ProductHomepageSection({
  section,
}: {
  section: DynamicHomepageSection
}) {
  const storePath =
    section.type === 'SECOND_HAND_PRODUCTS'
      ? '/second-hand-store'
      : '/search'

  return (
    <section className="section">
      <div className="container">
        <div className="section-heading">
          <h2>{section.title}</h2>

          <Link to={storePath}>
            See all <ArrowRightIcon />
          </Link>
        </div>

        <ProductGrid
          products={
            section.products as ProductSummary[]
          }
          emptyMessage="No eligible products are available in this section yet."
        />
      </div>
    </section>
  )
}

function StoreHomepageSection({
  section,
}: {
  section: DynamicHomepageSection
}) {
  return (
    <section className="section">
      <div className="container">
        <div className="section-heading">
          <h2>{section.title}</h2>

          <Link to="/search">
            View stores <ArrowRightIcon />
          </Link>
        </div>

        <div className="homepage-store-grid">
          {section.stores.map((store) => (
            <Link
              key={store.id}
              to={`/stores/${store.slug}`}
              className="homepage-store-card"
            >
              <div className="homepage-store-image">
                {store.bannerUrl || store.logoUrl ? (
                  <img
                    src={
                      store.bannerUrl ??
                      store.logoUrl ??
                      ''
                    }
                    alt=""
                  />
                ) : (
                  <PackageIcon />
                )}
              </div>

              <div className="homepage-store-info">
                <strong>{store.name}</strong>

                <span>
                  {store.productCount} available products
                </span>

                {store.campusLocation ? (
                  <small>
                    {store.campusLocation}
                  </small>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
