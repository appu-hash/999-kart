
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useCart } from "../cart/CartContext";
import ProductShare from "./ProductShare";
import "./ProductGrid.css";

interface Product {
  id: string;
  category_id: string | null;
  name: string;
  short_description: string | null;
  selling_price: number;
  compare_at_price: number | null;
  image_url: string | null;
  category_name?: string;
}

interface ProductRating {
  average: number;
  count: number;
}

interface ReviewRow {
  product_id: string;
  rating: number;
}

interface ProductGridProps {
  categoryIds?: string[];
  searchQuery?: string;
}

type SortMode = "relevance" | "best" | "reviews" | "price-low" | "price-high";

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singular(word: string) {
  if (word.length > 4 && word.endsWith("ies")) {
    return word.slice(0, -3) + "y";
  }

  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }

  return word;
}

function parseSearch(query: string) {
  let remaining = normalize(query);
  let minPrice: number | null = null;
  let maxPrice: number | null = null;

  // Price range: between 500 and 1000
  const rangeMatch = remaining.match(
    /\bbetween\s+(\d+(?:\.\d+)?)\s+and\s+(\d+(?:\.\d+)?)\b/
  );

  if (rangeMatch) {
    minPrice = Number(rangeMatch[1]);
    maxPrice = Number(rangeMatch[2]);
    remaining = remaining.replace(rangeMatch[0], " ");
  }

  // Maximum price: under 500, below 500, less than 500
  const maxMatch = remaining.match(
    /\b(?:under|below|less than|upto|up to|max(?:imum)?)\s+(\d+(?:\.\d+)?)\b/
  );

  if (maxMatch) {
    maxPrice = Number(maxMatch[1]);
    remaining = remaining.replace(maxMatch[0], " ");
  }

  // Minimum price: above 1000, over 1000, more than 1000
  const minMatch = remaining.match(
    /\b(?:above|over|more than|greater than|min(?:imum)?)\s+(\d+(?:\.\d+)?)\b/
  );

  if (minMatch) {
    minPrice = Number(minMatch[1]);
    remaining = remaining.replace(minMatch[0], " ");
  }

  let sortMode: SortMode = "relevance";

  if (
    /\b(most reviewed|most reviews|highest reviews|popular reviews)\b/.test(
      remaining
    )
  ) {
    sortMode = "reviews";
    remaining = remaining.replace(
      /\b(most reviewed|most reviews|highest reviews|popular reviews)\b/g,
      " "
    );
  } else if (
    /\b(best|top rated|highest rated|best rated|most rated)\b/.test(
      remaining
    )
  ) {
    sortMode = "best";
    remaining = remaining.replace(
      /\b(best|top rated|highest rated|best rated|most rated)\b/g,
      " "
    );
  }

  remaining = remaining.replace(
    /\b(products?|items?|show|find|search|for|the|of|with|rated|rating)\b/g,
    " "
  );

  const tokens = normalize(remaining)
    .split(" ")
    .filter(Boolean)
    .map(singular);

  return {
    tokens,
    minPrice,
    maxPrice,
    sortMode,
  };
}

function getMatchScore(product: Product, tokens: string[]) {
  if (tokens.length === 0) return 0;

  const name = normalize(product.name);
  const description = normalize(
    `${product.short_description ?? ""} ${product.category_name ?? ""}`
  );

  const nameWords = name.split(" ").map(singular);
  const descriptionWords = description.split(" ").map(singular);

  let score = 0;
  let matched = 0;

  for (const token of tokens) {
    const nameMatch = nameWords.some(
      (word) => word === token || word.startsWith(token)
    );

    const descriptionMatch = descriptionWords.some(
      (word) => word === token || word.startsWith(token)
    );

    if (nameMatch) {
      score += 10;
      matched++;
    } else if (descriptionMatch) {
      score += 4;
      matched++;
    }
  }

  // Give exact phrase matches extra priority.
  const fullQuery = tokens.join(" ");

  if (name.includes(fullQuery)) {
    score += 15;
  }

  // Require at least one matching search word.
  return matched > 0 ? score : -1;
}

export default function ProductGrid({
  categoryIds = [],
  searchQuery = "",
}: ProductGridProps) {
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [ratings, setRatings] = useState<Record<string, ProductRating>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortOverride, setSortOverride] = useState<SortMode | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      setLoading(true);
      setError("");

      try {
        const [productsResult, categoriesResult] = await Promise.all([
          supabase
            .from("products")
            .select(
              "id, category_id, name, short_description, selling_price, compare_at_price, image_url"
            )
            .eq("is_active", true)
            .order("created_at", { ascending: false }),

          supabase
            .from("categories")
            .select("id, name"),
        ]);

        if (productsResult.error) throw productsResult.error;

        const categoryMap = new Map(
          (categoriesResult.data ?? []).map((category) => [
            category.id,
            category.name,
          ])
        );

        const loadedProducts: Product[] = (productsResult.data ?? []).map(
          (product) => ({
            ...product,
            category_name: product.category_id
              ? categoryMap.get(product.category_id) ?? ""
              : "",
          })
        );

        if (isMounted) {
          setProducts(loadedProducts);
        }

        // Load every approved review in pages to avoid the default
        // Supabase response limit hiding review counts.
        const reviewTotals: Record<
          string,
          { total: number; count: number }
        > = {};

        let offset = 0;
        const pageSize = 1000;

        while (true) {
          const { data, error: reviewError } = await supabase
            .from("product_reviews")
            .select("product_id, rating")
            .eq("status", "approved")
            .range(offset, offset + pageSize - 1);

          if (reviewError) throw reviewError;

          const rows = (data ?? []) as ReviewRow[];

          for (const review of rows) {
            if (!reviewTotals[review.product_id]) {
              reviewTotals[review.product_id] = {
                total: 0,
                count: 0,
              };
            }

            reviewTotals[review.product_id].total += review.rating;
            reviewTotals[review.product_id].count += 1;
          }

          if (rows.length < pageSize) break;

          offset += pageSize;
        }

        const ratingData: Record<string, ProductRating> = {};

        for (const [productId, value] of Object.entries(reviewTotals)) {
          ratingData[productId] = {
            average: value.total / value.count,
            count: value.count,
          };
        }

        if (isMounted) {
          setRatings(ratingData);
        }
      } catch (err) {
        console.error("Product loading error:", err);

        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load products. Please try again later."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  // Reset manual sorting when the search changes.
  useEffect(() => {
    setSortOverride(null);
  }, [searchQuery]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);

  const openProduct = (productId: string) => {
    navigate(`/product/${productId}`);
  };

  const search = useMemo(
    () => parseSearch(searchQuery),
    [searchQuery]
  );

  const activeSort = sortOverride ?? search.sortMode;

  const filteredProducts = useMemo(() => {
    const matching = products
      .filter((product) => {
        const matchesCategory =
          categoryIds.length === 0 ||
          (product.category_id !== null &&
            categoryIds.includes(product.category_id));

        const matchesMin =
          search.minPrice === null ||
          product.selling_price >= search.minPrice;

        const matchesMax =
          search.maxPrice === null ||
          product.selling_price <= search.maxPrice;

        const score = getMatchScore(product, search.tokens);
        const matchesText = search.tokens.length === 0 || score >= 0;

        return (
          matchesCategory &&
          matchesMin &&
          matchesMax &&
          matchesText
        );
      })
      .map((product) => ({
        product,
        score: getMatchScore(product, search.tokens),
        rating: ratings[product.id] ?? {
          average: 0,
          count: 0,
        },
      }));

    matching.sort((a, b) => {
      if (activeSort === "best") {
        return (
          b.rating.average - a.rating.average ||
          b.rating.count - a.rating.count ||
          a.product.selling_price - b.product.selling_price
        );
      }

      if (activeSort === "reviews") {
        return (
          b.rating.count - a.rating.count ||
          b.rating.average - a.rating.average
        );
      }

      if (activeSort === "price-low") {
        return a.product.selling_price - b.product.selling_price;
      }

      if (activeSort === "price-high") {
        return b.product.selling_price - a.product.selling_price;
      }

      return (
        b.score - a.score ||
        b.rating.count - a.rating.count
      );
    });

    return matching;
  }, [products, ratings, categoryIds, search, activeSort]);

  if (loading) {
    return <div className="product-loading">Loading products...</div>;
  }

  if (error) {
    return <div className="product-error">{error}</div>;
  }

  return (
    <section className="product-grid-section">
      {searchQuery.trim() && (
        <div className="product-search-summary">
          <p>
            {filteredProducts.length} product
            {filteredProducts.length === 1 ? "" : "s"} found
            {search.minPrice !== null || search.maxPrice !== null
              ? " within your price filter"
              : ""}
          </p>
        </div>
      )}

      {filteredProducts.length > 0 && (
        <div className="product-sort-bar">
          <label htmlFor="product-sort">Sort products</label>

          <select
            id="product-sort"
            value={activeSort}
            onChange={(event) =>
              setSortOverride(event.target.value as SortMode)
            }
          >
            <option value="relevance">Best match</option>
            <option value="best">Highest rated</option>
            <option value="reviews">Most reviewed</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>
      )}

      {filteredProducts.length === 0 ? (
        <div className="product-empty">
          <h3>No products match your search.</h3>
          <p>
            Try a different product name or adjust your price range.
          </p>
        </div>
      ) : (
        <div className="product-grid">
          {filteredProducts.map(({ product, rating }) => {
            const original = product.compare_at_price;

            const hasDiscount =
              original !== null &&
              original > product.selling_price &&
              original > 0;

            const discount = hasDiscount
              ? Math.round(
                  ((original - product.selling_price) / original) * 100
                )
              : 0;

            return (
              <article
                className="store-product-card"
                key={product.id}
              >
                <div
                  className="store-product-image"
                  onClick={() => openProduct(product.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openProduct(product.id);
                    }
                  }}
                  aria-label={`View ${product.name}`}
                >
                  {hasDiscount && (
                    <span className="product-discount">
                      {discount}% OFF
                    </span>
                  )}

                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                    />
                  ) : (
                    <div className="product-no-image">
                      999+ KART
                    </div>
                  )}
                </div>

                <div className="store-product-info">
                  <h3>{product.name}</h3>

                  {product.short_description && (
                    <p>{product.short_description}</p>
                  )}

                  <div className="product-rating-summary">
                    {rating.count > 0 ? (
                      <>
                        <span className="product-rating-stars">
                          ★ {rating.average.toFixed(1)}
                        </span>
                        <span className="product-review-count">
                          ({rating.count}{" "}
                          {rating.count === 1 ? "review" : "reviews"})
                        </span>
                      </>
                    ) : (
                      <span className="product-no-reviews">
                        No reviews yet
                      </span>
                    )}
                  </div>

                  <div className="store-product-prices">
                    <strong>
                      {formatPrice(product.selling_price)}
                    </strong>

                    {hasDiscount && (
                      <span className="product-original-price">
                        {formatPrice(original)}
                      </span>
                    )}
                  </div>

                  {hasDiscount && (
                    <span className="product-savings">
                      You save{" "}
                      {formatPrice(original - product.selling_price)}
                    </span>
                  )}

                  <ProductShare
                    productId={product.id}
                    productName={product.name}
                    productPrice={formatPrice(product.selling_price)}
                  />

                  <button
                    type="button"
                    className="product-buy-button"
                    onClick={() =>
                      addToCart({
                        id: product.id,
                        name: product.name,
                        selling_price: product.selling_price,
                        image_url: product.image_url,
                      })
                    }
                  >
                    ADD TO CART
                  </button>

                  <button
                    type="button"
                    className="product-view-button"
                    onClick={() => openProduct(product.id)}
                  >
                    VIEW PRODUCT
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
