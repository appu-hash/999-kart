import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { supabase } from "../../../lib/supabase";
import "./AdminReviews.css";

type ReviewStatus = "pending" | "approved" | "rejected";
interface ReviewRow {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string;
  body: string;
  status: ReviewStatus;
  is_verified_purchase: boolean;
  is_featured: boolean;
  created_at: string;
  products: { name: string; image_url: string | null } | null;
}

export default function AdminReviews() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | ReviewStatus>("pending");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase
      .from("product_reviews")
      .select("id, product_id, user_id, rating, title, body, status, is_verified_purchase, is_featured, created_at, products(name, image_url)")
      .order("created_at", { ascending: false });

    if (queryError) {
      console.error(queryError);
      setError(queryError.message || "Unable to load reviews.");
      setReviews([]);
    } else {
      setReviews((data ?? []) as unknown as ReviewRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadReviews(); }, [loadReviews]);

  const counts = useMemo(() => ({
    all: reviews.length,
    pending: reviews.filter((r) => r.status === "pending").length,
    approved: reviews.filter((r) => r.status === "approved").length,
    rejected: reviews.filter((r) => r.status === "rejected").length,
  }), [reviews]);

  const visibleReviews = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter((review) => {
      const matchesFilter = filter === "all" || review.status === filter;
      const matchesSearch = !q || [
        review.title, review.body, review.products?.name ?? "", review.user_id, review.id
      ].some((value) => value.toLowerCase().includes(q));
      return matchesFilter && matchesSearch;
    });
  }, [reviews, filter, search]);

  async function updateReview(id: string, updates: Partial<Pick<ReviewRow, "status" | "is_featured">>) {
    setBusyId(id);
    setError("");
    const { error: updateError } = await supabase
      .from("product_reviews")
      .update(updates)
      .eq("id", id);

    if (updateError) {
      console.error(updateError);
      setError(updateError.message || "Unable to update this review.");
    } else {
      setReviews((current) => current.map((review) =>
        review.id === id ? { ...review, ...updates } : review
      ));
    }
    setBusyId(null);
  }

  return (
    <AdminLayout title="Customer Reviews">
      <div className="admin-reviews-page">
        <div className="admin-reviews-intro">
          <div><p>STORE REPUTATION</p><h2>Reviews & Ratings</h2><span>Moderate customer feedback before it appears on product pages.</span></div>
          <button onClick={() => void loadReviews()} disabled={loading}>↻ Refresh</button>
        </div>

        <div className="admin-review-stats">
          <div><span>Total reviews</span><strong>{counts.all}</strong></div>
          <div className="pending"><span>Awaiting approval</span><strong>{counts.pending}</strong></div>
          <div className="approved"><span>Approved</span><strong>{counts.approved}</strong></div>
          <div className="rejected"><span>Rejected</span><strong>{counts.rejected}</strong></div>
        </div>

        <div className="admin-review-toolbar">
          <div className="admin-review-tabs">
            {(["pending", "approved", "rejected", "all"] as const).map((value) =>
              <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
                {value === "all" ? "All" : value[0].toUpperCase() + value.slice(1)}
                <span>{counts[value]}</span>
              </button>
            )}
          </div>
          <input value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product, review or customer ID..." aria-label="Search reviews" />
        </div>

        {error && <div className="admin-review-error">{error}</div>}
        {loading ? <div className="admin-review-empty">Loading reviews...</div> :
          visibleReviews.length === 0 ? <div className="admin-review-empty">No reviews found in this view.</div> :
          <div className="admin-review-list">
            {visibleReviews.map((review) => <article className="admin-review-card" key={review.id}>
              <div className="admin-review-product">
                {review.products?.image_url ? <img src={review.products.image_url} alt="" /> :
                  <div className="admin-review-placeholder">999+</div>}
                <div><strong>{review.products?.name || "Product unavailable"}</strong>
                  <small>{new Date(review.created_at).toLocaleString("en-IN")}</small></div>
              </div>
              <div className="admin-review-main">
                <div className="admin-review-meta">
                  <span className="admin-review-stars">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                  <span className={`admin-review-status ${review.status}`}>{review.status}</span>
                  {review.is_verified_purchase && <span className="admin-review-verified">Verified purchase</span>}
                  {review.is_featured && <span className="admin-review-featured">Featured</span>}
                </div>
                <h3>{review.title}</h3>
                <p>{review.body}</p>
                <small className="admin-review-user">Customer ID: {review.user_id}</small>
                <div className="admin-review-actions">
                  {review.status !== "approved" && <button disabled={busyId === review.id}
                    onClick={() => void updateReview(review.id, { status: "approved" })}>✓ Approve</button>}
                  {review.status !== "rejected" && <button className="reject" disabled={busyId === review.id}
                    onClick={() => void updateReview(review.id, { status: "rejected", is_featured: false })}>✕ Reject</button>}
                  {review.status === "approved" && <button className="feature" disabled={busyId === review.id}
                    onClick={() => void updateReview(review.id, { is_featured: !review.is_featured })}>
                    {review.is_featured ? "Remove featured" : "☆ Feature review"}
                  </button>}
                </div>
              </div>
            </article>)}
          </div>}
      </div>
    </AdminLayout>
  );
}
