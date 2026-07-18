import type {
  ProductCondition,
  ProductListQuery,
  ProductSort,
} from "@campusbaza/contracts";
import { useQuery } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FilterIcon,
  PackageIcon,
  SearchIcon,
  ShieldIcon,
} from "../../../components/ui/icons";
import { catalogApi } from "../api/catalog.api";
import { ProductGrid, ProductGridSkeleton } from "./ProductGrid";

interface StorefrontPageProps {
  kind: "official" | "second-hand";
}

export function StorefrontPage({ kind }: StorefrontPageProps) {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const official = kind === "official";
  useEffect(() => setSearch(params.get("q") ?? ""), [params]);

  const query = {
    q: params.get("q") || undefined,
    category: params.get("category") || undefined,
    productType: official ? "NEW" : "SECOND_HAND",
    sellerType: official ? "ADMIN" : "USER",
    condition: official
      ? undefined
      : ((params.get("condition") || undefined) as
          | ProductCondition
          | undefined),
    minPrice: Number(params.get("minPrice")) || undefined,
    maxPrice: Number(params.get("maxPrice")) || undefined,
    sort: (params.get("sort") || "latest") as ProductSort,
    page: Number(params.get("page") || 1),
    limit: 12,
  } satisfies Partial<ProductListQuery>;
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: catalogApi.categories,
  });
  const products = useQuery({
    queryKey: ["products", query],
    queryFn: () => catalogApi.products(query),
  });

  function update(key: string, value?: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    update("q", search.trim() || undefined);
  }

  return (
    <div className="storefront-page">
      <section className="storefront-hero">
        <div className="container storefront-hero-inner">
          <div>
            <span className="storefront-label">
              {official ? <ShieldIcon /> : <PackageIcon />}
              {official ? "Official Campus Store" : "Community Marketplace"}
            </span>
            <h1>
              {official
                ? "Official campus essentials"
                : "Second-hand campus finds"}
            </h1>
            <p>
              {official
                ? "Verified merchandise, supplies and everyday essentials managed by the Campus Angadi team."
                : "Approved pre-loved books, electronics and hostel essentials from the NITC community."}
            </p>
          </div>
          <form className="storefront-search" onSubmit={submitSearch}>
            <SearchIcon />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                official
                  ? "Search official products"
                  : "Search second-hand products"
              }
              aria-label={`Search ${official ? "official" : "second-hand"} products`}
            />
            <button className="button button-primary">Search</button>
          </form>
        </div>
      </section>

      <section className="section storefront-catalog">
        <div className="container catalog-layout">
          <aside className="catalog-filters storefront-filters">
            <div className="storefront-filter-title">
              <FilterIcon />
              <strong>Filters</strong>
            </div>
            <label>
              Category
              <select
                value={query.category ?? ""}
                onChange={(event) =>
                  update("category", event.target.value || undefined)
                }
              >
                <option value="">All categories</option>
                {(categories.data ?? []).map((category) => (
                  <option value={category.slug} key={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            {!official ? (
              <label>
                Condition
                <select
                  value={query.condition ?? ""}
                  onChange={(event) =>
                    update("condition", event.target.value || undefined)
                  }
                >
                  <option value="">Any condition</option>
                  <option value="LIKE_NEW">Like new</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="USED">Used</option>
                  <option value="OPEN_BOX">Open box</option>
                </select>
              </label>
            ) : null}
            <label>
              Minimum price
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={params.get("minPrice") ?? ""}
                onChange={(event) =>
                  update("minPrice", event.target.value || undefined)
                }
                placeholder="₹0"
              />
            </label>
            <label>
              Maximum price
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={params.get("maxPrice") ?? ""}
                onChange={(event) =>
                  update("maxPrice", event.target.value || undefined)
                }
                placeholder="Any price"
              />
            </label>
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                setSearch("");
                setParams({});
              }}
            >
              Clear filters
            </button>
          </aside>

          <div className="catalog-results">
            <div className="catalog-toolbar storefront-toolbar">
              <span>
                <strong>{products.data?.meta.total ?? 0}</strong>{" "}
                {official ? "products" : "listings"}
              </span>
              <label>
                Sort
                <select
                  value={query.sort}
                  onChange={(event) => update("sort", event.target.value)}
                >
                  <option value="latest">Latest</option>
                  <option value="popular">Popular</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                  <option value="oldest">Oldest</option>
                </select>
              </label>
            </div>

            {products.isLoading ? (
              <ProductGridSkeleton count={8} />
            ) : products.isError ? (
              <div className="catalog-empty" role="alert">
                <PackageIcon />
                <strong>Unable to load products</strong>
                <span>Check your connection, then try again.</span>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => void products.refetch()}
                >
                  Try again
                </button>
              </div>
            ) : (
              <ProductGrid products={products.data?.items ?? []} />
            )}

            {(products.data?.meta.totalPages ?? 0) > 1 ? (
              <div className="pagination">
                <button
                  type="button"
                  disabled={query.page <= 1}
                  onClick={() => update("page", String(query.page - 1))}
                >
                  Previous
                </button>
                <span>
                  Page {query.page} of {products.data?.meta.totalPages}
                </span>
                <button
                  type="button"
                  disabled={query.page >= (products.data?.meta.totalPages ?? 1)}
                  onClick={() => update("page", String(query.page + 1))}
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
