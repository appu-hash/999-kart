import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useCart } from "../cart/CartContext";
import ProductShare from "./ProductShare";
import "./ProductDetails.css";
import "./ProductDetails.reviews.css";

interface Product {
  id: string;
  name: string;
  description: string | null;
  short_description: string | null;
  selling_price: number;
  compare_at_price: number | null;
  image_url: string | null;
}

interface Review {
  id: string;
  rating: number;
  title: string;
  body: string;
  is_verified_purchase: boolean;
  is_featured: boolean;
  created_at: string;
  user_id: string;
}

interface ReviewSummary {
  average: number;
  count: number;
  distribution: Record<number, number>;
}

const emptySummary: ReviewSummary = {
  average: 0,
  count: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [quantity, setQuantity] = useState(1);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>(emptySummary);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [eligibleOrderItemId, setEligibleOrderItemId] = useState<string | null>(null);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewSort, setReviewSort] = useState<"recent" | "highest" | "lowest">("recent");

  useEffect(() => {
    let active = true;

    async function loadProduct() {
      setLoading(true);
      setError("");
      if (!id) {
        setError("Product not found.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, short_description, selling_price, compare_at_price, image_url")
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle();

      if (!active) return;
      if (error) {
        console.error(error);
        setError("Unable to load this product.");
      } else if (!data) {
        setError("This product is unavailable.");
      } else {
        setProduct(data as Product);
      }
      setLoading(false);
    }

    loadProduct();
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    let active = true;

    async function loadReviewsAndEligibility() {
      if (!id) return;
      setReviewLoading(true);

      const [{ data: authData }, { data: reviewData, error: reviewError }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("product_reviews")
          .select("id, rating, title, body, is_verified_purchase, is_featured, created_at, user_id")
          .eq("product_id", id)
          .eq("status", "approved")
          .order("is_featured", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      if (!active) return;
      const currentUserId = authData.user?.id ?? null;
      setUserId(currentUserId);

      if (reviewError) {
        console.error("Unable to load product reviews:", reviewError);
        setReviews([]);
        setSummary(emptySummary);
      } else {
        const rows = (reviewData ?? []) as Review[];
        setReviews(rows);
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        rows.forEach((review) => { distribution[review.rating as 1 | 2 | 3 | 4 | 5] += 1; });
        const total = rows.reduce((sum, review) => sum + review.rating, 0);
        setSummary({
          average: rows.length ? total / rows.length : 0,
          count: rows.length,
          distribution,
        });
      }

      setEligibleOrderItemId(null);
      setAlreadyReviewed(false);

      if (currentUserId) {
        const { data: ownReview } = await supabase
          .from("product_reviews")
          .select("id")
          .eq("product_id", id)
          .eq("user_id", currentUserId)
          .maybeSingle();

        if (!active) return;
        setAlreadyReviewed(Boolean(ownReview));

        const { data: deliveredOrders, error: ordersError } = await supabase
          .from("orders")
          .select("id")
          .eq("user_id", currentUserId)
          .eq("status", "delivered");

        if (!active) return;
        if (!ordersError && deliveredOrders?.length) {
          const orderIds = deliveredOrders.map((order) => order.id);
          const { data: purchasedItems, error: itemsError } = await supabase
            .from("order_items")
            .select("id")
            .eq("product_id", id)
            .in("order_id", orderIds)
            .limit(1);

          if (!active) return;
          if (!itemsError && purchasedItems?.[0]) {
            setEligibleOrderItemId(purchasedItems[0].id);
          }
        }
      }

      setReviewLoading(false);
    }

    loadReviewsAndEligibility();
    return () => { active = false; };
  }, [id]);

  const sortedReviews = useMemo(() => {
    const copy = [...reviews];
    if (reviewSort === "highest") return copy.sort((a, b) => b.rating - a.rating);
    if (reviewSort === "lowest") return copy.sort((a, b) => a.rating - b.rating);
    return copy.sort((a, b) => Number(b.is_featured) - Number(a.is_featured) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [reviews, reviewSort]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !eligibleOrderItemId || !userId || alreadyReviewed) return;
    setSubmittingReview(true);
    setReviewMessage("");

    const { error: insertError } = await supabase.from("product_reviews").insert({
      product_id: id,
      order_item_id: eligibleOrderItemId,
      rating: reviewRating,
      title: reviewTitle.trim(),
      body: reviewBody.trim(),
    });

    if (insertError) {
      console.error(insertError);
      setReviewMessage(insertError.code === "23505"
        ? "A review has already been submitted for this product."
        : insertError.message || "Unable to submit your review. Please try again.");
    } else {
      setAlreadyReviewed(true);
      setEligibleOrderItemId(null);
      setReviewTitle("");
      setReviewBody("");
      setReviewMessage("Thank you! Your review has been submitted for admin approval.");
    }
    setSubmittingReview(false);
  }

  if (loading) return <div className="details-message">Loading product...</div>;

  if (error || !product) {
    return (
      <div className="details-message">
        <h2>{error || "Product not found."}</h2>
        <button onClick={() => navigate("/")}>Back to shop</button>
      </div>
    );
  }

  const original = product.compare_at_price;
  const hasDiscount = original !== null && original > product.selling_price;
  const discount = hasDiscount
    ? Math.round(((original - product.selling_price) / original) * 100)
    : 0;

  return (
    <div className="product-details-page">
      <header className="details-header">
        <button onClick={() => navigate("/")}>← Back to shop</button>
        <a href="/" className="details-logo">999<span>+</span> KART</a>
      </header>

      <main className="details-container">
        <div className="details-image">
          {hasDiscount && <span className="details-discount">{discount}% OFF</span>}
          {product.image_url ? <img src={product.image_url} alt={product.name} /> :
            <div className="details-no-image">999+ KART</div>}
        </div>

        <div className="details-information">
          <p className="details-eyebrow">999+ KART COLLECTION</p>
          <h1>{product.name}</h1>

          <button className="review-inline-summary" type="button"
            onClick={() => document.getElementById("product-reviews")?.scrollIntoView({ behavior: "smooth" })}>
            <span className="review-stars">{summary.count ? "★".repeat(Math.round(summary.average)) : "☆☆☆☆☆"}</span>
            <strong>{summary.count ? summary.average.toFixed(1) : "New"}</strong>
            <span>{summary.count ? `${summary.count} customer reviews` : "Be the first to review"}</span>
          </button>

          {product.short_description && <p className="details-short-description">{product.short_description}</p>}

          <div className="details-prices">
            <strong>{formatPrice(product.selling_price)}</strong>
            {hasDiscount && <span className="details-original-price">{formatPrice(original)}</span>}
          </div>

          {hasDiscount && <p className="details-saving">You save {formatPrice(original - product.selling_price)} ({discount}% OFF)</p>}
          <div className="details-divider" />
          <h3>Product description</h3>
          <p className="details-description">{product.description || product.short_description || "Discover this product from 999+ KART."}</p>

          <div className="details-delivery">
            <p>✓ Cash on Delivery available</p>
            <p>✓ Carefully selected products</p>
            <p>✓ Customer support available</p>
          </div>

          <div className="details-quantity">
            <span>Quantity</span>
            <div>
              <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
              <strong>{quantity}</strong>
              <button type="button" onClick={() => setQuantity((q) => q + 1)}>+</button>
            </div>
          </div>
<ProductShare
  productId={product.id}
  productName={product.name}
  productPrice={formatPrice(product.selling_price)}
/>
          <button type="button" className="details-shop-button" onClick={() => {
            for (let i = 0; i < quantity; i++) {
              addToCart({ id: product.id, name: product.name, selling_price: product.selling_price, image_url: product.image_url });
            }
            navigate("/cart");
          }}>ADD TO CART</button>
          <button type="button" className="details-continue-button" onClick={() => navigate("/")}>CONTINUE SHOPPING</button>
        </div>
      </main>

      <section className="product-reviews-section" id="product-reviews">
        <div className="reviews-heading">
          <div>
            <p className="details-eyebrow">CUSTOMER FEEDBACK</p>
            <h2>Ratings & Reviews</h2>
            <p>Real feedback from customers who purchased this product.</p>
          </div>
          <div className="reviews-overall">
            <strong>{summary.count ? summary.average.toFixed(1) : "New"}</strong>
            <span className="review-stars">{summary.count ? "★".repeat(Math.round(summary.average)) : "☆☆☆☆☆"}</span>
            <small>{summary.count} {summary.count === 1 ? "review" : "reviews"}</small>
          </div>
        </div>

        <div className="reviews-content">
          <div className="reviews-breakdown">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = summary.distribution[star] || 0;
              const percent = summary.count ? (count / summary.count) * 100 : 0;
              return <div className="rating-bar-row" key={star}>
                <span>{star} ★</span>
                <div className="rating-bar"><span style={{ width: `${percent}%` }} /></div>
                <small>{count}</small>
              </div>;
            })}
          </div>

          <div className="review-form-card">
            <h3>Write a review</h3>
            {reviewLoading ? <p>Checking your purchase...</p> :
              alreadyReviewed ? <p className="review-note">You've already submitted a review for this product.</p> :
              eligibleOrderItemId ? <form onSubmit={submitReview}>
                <label>Your rating</label>
                <div className="review-rating-picker" role="radiogroup" aria-label="Your rating">
                  {[1, 2, 3, 4, 5].map((star) => <button key={star} type="button"
                    className={star <= reviewRating ? "selected" : ""}
                    aria-label={`${star} star${star > 1 ? "s" : ""}`}
                    aria-pressed={reviewRating === star}
                    onClick={() => setReviewRating(star)}>★</button>)}
                </div>
                <label htmlFor="review-title">Review title</label>
                <input id="review-title" value={reviewTitle} maxLength={120} required
                  onChange={(event) => setReviewTitle(event.target.value)} placeholder="Sum up your experience" />
                <label htmlFor="review-body">Your review</label>
                <textarea id="review-body" value={reviewBody} minLength={10} maxLength={3000}
                  required rows={4} onChange={(event) => setReviewBody(event.target.value)}
                  placeholder="What did you like or dislike about this product?" />
                <button className="review-submit-button" type="submit" disabled={submittingReview}>
                  {submittingReview ? "Submitting..." : "SUBMIT REVIEW"}
                </button>
                <small className="review-note">Only customers with a delivered order can review. Your review appears after approval.</small>
              </form> :
              userId ? <p className="review-note">A review becomes available after your order is marked delivered.</p> :
              <p className="review-note">Sign in and purchase this product to leave a verified review.</p>}
            {reviewMessage && <p className="review-feedback" role="status">{reviewMessage}</p>}
          </div>
        </div>

        <div className="reviews-list-heading">
          <h3>Customer reviews ({summary.count})</h3>
          <select aria-label="Sort reviews" value={reviewSort} onChange={(event) => setReviewSort(event.target.value as typeof reviewSort)}>
            <option value="recent">Most recent</option>
            <option value="highest">Highest rating</option>
            <option value="lowest">Lowest rating</option>
          </select>
        </div>

        {reviewLoading ? <p className="reviews-empty">Loading reviews...</p> :
          sortedReviews.length ? <div className="reviews-list">
            {sortedReviews.map((review) => <article className="customer-review" key={review.id}>
              <div className="customer-review-top">
                <span className="review-stars">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                <time>{new Date(review.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</time>
              </div>
              <h4>{review.title}</h4>
              <p>{review.body}</p>
              <div className="review-author">
                <span className="review-author-avatar">✓</span>
                <span>Verified customer</span>
                {review.is_verified_purchase && <span className="verified-review-badge">Verified purchase</span>}
                {review.is_featured && <span className="featured-review-badge">Featured</span>}
              </div>
            </article>)}
          </div> : <div className="reviews-empty">No approved reviews yet. Your feedback could be the first.</div>}
      </section>

      <footer className="details-footer">© 2026 999+ KART. All rights reserved.</footer>
    </div>
  );
}
