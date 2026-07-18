import type { ProductSummary } from "@campusbaza/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CartIcon, PackageIcon } from "../../../components/ui/icons";
import { useAuthStore } from "../../auth/store/use-auth-store";
import { cartApi } from "../../cart/api/cart.api";

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function conditionLabel(value: ProductSummary["condition"]) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ProductCard({ product }: { product: ProductSummary }) {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const client = useQueryClient();
  const [added, setAdded] = useState(false);
  const feedbackTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (feedbackTimer.current !== null)
        window.clearTimeout(feedbackTimer.current);
    },
    [],
  );

  const add = useMutation({
    mutationFn: () => cartApi.add({ productId: product.id, quantity: 1 }),
    onSuccess(data) {
      client.setQueryData(["cart"], data);
      setAdded(true);
      if (feedbackTimer.current !== null)
        window.clearTimeout(feedbackTimer.current);
      feedbackTimer.current = window.setTimeout(() => setAdded(false), 1600);
    },
  });
  const discount =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(
          ((product.originalPrice - product.price) / product.originalPrice) *
            100,
        )
      : null;
  function addToCart() {
    if (product.stock <= 0 || add.isPending) return;
    if (!user) {
      void navigate(
        `/login?returnTo=${encodeURIComponent(`/products/${product.slug}`)}`,
      );
      return;
    }
    add.mutate();
  }
  return (
    <article className="catalog-card">
      <Link
        to={`/products/${product.slug}`}
        className="catalog-card-media"
        aria-label={`View ${product.title}`}
      >
        {product.primaryImage ? (
          <img
            src={product.primaryImage.url}
            alt={product.primaryImage.altText || product.title}
            loading="lazy"
          />
        ) : (
          <div className="catalog-image-fallback">
            <PackageIcon />
            <span>No image</span>
          </div>
        )}
        <div className="catalog-card-badges">
          <span
            className={`product-pill ${product.sellerType === "ADMIN" ? "official" : "second-hand"}`}
          >
            {product.sellerType === "ADMIN" ? "Official" : "Second-Hand"}
          </span>
          <span className="product-pill condition">
            {conditionLabel(product.condition)}
          </span>
        </div>
        {discount ? <span className="discount-badge">-{discount}%</span> : null}
      </Link>
      <div className="catalog-card-body">
        <span className="catalog-category">{product.category.name}</span>
        <Link to={`/products/${product.slug}`} className="catalog-card-title">
          {product.title}
        </Link>
        <div className="catalog-price-row">
          <strong>{formatPrice(product.price)}</strong>
          {product.originalPrice ? (
            <del>{formatPrice(product.originalPrice)}</del>
          ) : null}
        </div>
        <div className="catalog-meta-row">
          <span>{product.stock} available</span>
          <span>{product.viewCount} views</span>
        </div>
        <div className="catalog-card-actions">
          <Link
            className="button button-outline"
            to={`/products/${product.slug}`}
          >
            View
          </Link>
          <button
            type="button"
            className="button button-primary"
            disabled={add.isPending || product.stock <= 0}
            onClick={addToCart}
            aria-label={
              product.stock <= 0
                ? `${product.title} is sold out`
                : `Add ${product.title} to cart`
            }
          >
            <CartIcon />
            {product.stock <= 0
              ? "Sold out"
              : added
                ? "Added"
                : add.isPending
                  ? "Adding…"
                  : "Add"}
          </button>
        </div>
        <span className="sr-only" aria-live="polite">
          {added ? `${product.title} added to cart` : ""}
        </span>
        {add.isError ? (
          <small className="card-action-error" role="alert">
            {add.error.message}
          </small>
        ) : null}
      </div>
    </article>
  );
}
