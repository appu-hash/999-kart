import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Package, Truck, MapPin, CreditCard, CheckCircle2, Clock3, Star, RotateCcw } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import "./OrderDetails.css";

type OrderItem = {
  id: string; product_id: string | null; product_name: string;
  product_sku: string | null; product_image_url: string | null;
  quantity: number; unit_price: number; line_total: number;
};
type Order = {
  id: string; order_code: string; status: string; payment_method: string;
  payment_status: string; currency: string; subtotal: number; delivery_fee: number;
  discount_total: number; grand_total: number; customer_name: string;
  customer_phone: string; delivery_address: unknown; customer_note: string | null;
  tracking_number: string | null; courier_name: string | null;
  expected_delivery_date: string | null; delivered_at: string | null; created_at: string;
  order_items: OrderItem[];
};
type StatusEvent = {
  id: number; old_status: string | null; new_status: string; note: string | null; created_at: string;
};
type Review = { id: string; product_id: string; order_item_id: string; rating: number; title: string; body: string; status: string };
type ReturnRequest = {
  id: string;
  order_id: string;
  order_item_id: string;
  status: string;
  reason: string;
  description: string | null;
  created_at: string;
};

const statusSteps = ["new", "confirmed", "ready_for_meesho", "ordered_on_meesho", "shipped", "out_for_delivery", "delivered"];
const statusTitle: Record<string, string> = {
  new: "Order placed", confirmed: "Order confirmed", ready_for_meesho: "Preparing your order",
  ordered_on_meesho: "Order placed with supplier", shipped: "Shipped",
  out_for_delivery: "Out for delivery", delivered: "Delivered",
  cancelled: "Cancelled", returned: "Returned",
};
const formatStatus = (s: string) => statusTitle[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const formatPrice = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(v ?? 0));
const formatDate = (v: string) => new Date(v).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const formatDay = (v: string) => new Date(`${v}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function addressLines(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") {
    try { return addressLines(JSON.parse(value)); } catch { return [value]; }
  }
  if (typeof value !== "object" || Array.isArray(value)) return [];
  const a = value as Record<string, unknown>;
  return ["recipient_name", "address_line1", "address_line2", "landmark", "locality", "city", "district", "state", "postal_code", "phone"]
    .map((key) => a[key] == null ? "" : String(a[key])).filter(Boolean);
}

export default function OrderDetails() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<StatusEvent[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { rating: number; title: string; body: string }>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState<Record<string, string>>({});
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [returnDrafts, setReturnDrafts] = useState<Record<string, { reason: string; description: string }>>({});
  const [returnSubmittingId, setReturnSubmittingId] = useState<string | null>(null);
  const [returnMessages, setReturnMessages] = useState<Record<string, string>>({});

  useEffect(() => { void loadOrder(); }, [orderId]);

  async function loadOrder() {
    setLoading(true); setError("");
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) { navigate("/account", { replace: true }); return; }
    if (!orderId) { setError("Order not found."); setLoading(false); return; }

    const { data, error: orderError } = await supabase.from("orders")
      .select(`id, order_code, status, payment_method, payment_status, currency, subtotal, delivery_fee, discount_total, grand_total, customer_name, customer_phone, delivery_address, customer_note, tracking_number, courier_name, expected_delivery_date, delivered_at, created_at,
        order_items (id, product_id, product_name, product_sku, product_image_url, quantity, unit_price, line_total)`)
      .eq("id", orderId).eq("user_id", auth.user.id).maybeSingle();
    if (orderError || !data) {
      setError(orderError?.message || "This order could not be found.");
      setLoading(false); return;
    }
    setOrder(data as unknown as Order);

    const [historyResult, reviewResult, returnResult] = await Promise.all([
      supabase.from("order_status_history").select("id, old_status, new_status, note, created_at")
        .eq("order_id", orderId).order("created_at", { ascending: true }),
      supabase.from("product_reviews").select("id, product_id, order_item_id, rating, title, body, status")
        .eq("user_id", auth.user.id),
      supabase.from("return_requests")
        .select("id, order_id, order_item_id, status, reason, description, created_at")
        .eq("order_id", orderId)
        .eq("user_id", auth.user.id),
    ]);
    if (historyResult.error) console.warn("Could not load order timeline:", historyResult.error.message);
    else setHistory(historyResult.data ?? []);
    if (reviewResult.error) console.warn("Could not load existing reviews:", reviewResult.error.message);
    else setReviews(reviewResult.data ?? []);
    if (returnResult.error) {
      console.warn("Could not load return requests:", returnResult.error.message);
      setReturnRequests([]);
    } else {
      setReturnRequests((returnResult.data ?? []) as ReturnRequest[]);
    }
    setLoading(false);
  }

  const reviewedProductIds = useMemo(() => new Set(reviews.map((r) => r.product_id)), [reviews]);
  const isDelivered = order?.status === "delivered";

  function returnWindow() {
    if (!order?.delivered_at || !isDelivered) return { eligible: false, daysLeft: 0 };
    const deliveredTime = new Date(order.delivered_at).getTime();
    const deadline = deliveredTime + 7 * 24 * 60 * 60 * 1000;
    const remaining = deadline - Date.now();
    return { eligible: remaining >= 0, daysLeft: Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000))) };
  }

  function returnDraftFor(item: OrderItem) {
    return returnDrafts[item.id] ?? { reason: "Damaged or defective product", description: "" };
  }

  async function submitReturnRequest(event: FormEvent<HTMLFormElement>, item: OrderItem) {
    event.preventDefault();
    if (!order || !isDelivered || !returnWindow().eligible) return;
    if (returnRequests.some((request) => request.order_item_id === item.id)) return;

    const draft = returnDraftFor(item);
    setReturnSubmittingId(item.id);
    setReturnMessages((messages) => ({ ...messages, [item.id]: "" }));

    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      setReturnMessages((messages) => ({ ...messages, [item.id]: "Please sign in again to request a return." }));
      setReturnSubmittingId(null);
      return;
    }

    const { error: insertError } = await supabase.from("return_requests").insert({
      order_id: order.id,
      order_item_id: item.id,
      user_id: auth.user.id,
      reason: draft.reason,
      description: draft.description.trim() || null,
      status: "pending",
    });

    if (insertError) {
      setReturnMessages((messages) => ({
        ...messages,
        [item.id]: insertError.code === "23505"
          ? "A return request already exists for this product."
          : insertError.message,
      }));
    } else {
      setReturnMessages((messages) => ({ ...messages, [item.id]: "Return request submitted. Waiting for admin approval." }));
      await loadOrder();
    }

    setReturnSubmittingId(null);
  }

  function returnStatusLabel(status: string) {
    if (status === "approved" || status === "in_progress") return "Return in Progress";
    if (status === "rejected") return "Return Rejected";
    if (status === "completed") return "Return Completed";
    if (status === "cancelled") return "Return Cancelled";
    return "Return Requested · Awaiting Approval";
  }
  function draftFor(item: OrderItem) {
    return reviewDrafts[item.id] ?? { rating: 5, title: "", body: "" };
  }
  async function submitReview(event: FormEvent<HTMLFormElement>, item: OrderItem) {
    event.preventDefault();
    if (!order || !item.product_id || !isDelivered) return;
    const draft = draftFor(item);
    setSubmittingId(item.id);
    setReviewMessage((m) => ({ ...m, [item.id]: "" }));
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setReviewMessage((m) => ({ ...m, [item.id]: "Please sign in to submit a review." }));
      setSubmittingId(null); return;
    }
    const { error: insertError } = await supabase.from("product_reviews").insert({
      product_id: item.product_id, order_item_id: item.id, rating: draft.rating,
      title: draft.title.trim(), body: draft.body.trim(),
    });
    if (insertError) {
      setReviewMessage((m) => ({ ...m, [item.id]: insertError.code === "23505"
        ? "You have already reviewed this product."
        : insertError.message }));
    } else {
      setReviewMessage((m) => ({ ...m, [item.id]: "Thank you! Your review has been submitted and is awaiting approval." }));
      await loadOrder();
    }
    setSubmittingId(null);
  }

  if (loading) return <div className="order-details-state">Loading order details...</div>;
  if (error || !order) return <div className="order-details-state"><h2>{error || "Order not found."}</h2><Link to="/account/dashboard">Back to dashboard</Link></div>;

  const address = addressLines(order.delivery_address);
  const currentIndex = statusSteps.indexOf(order.status);
  const events = history.length ? history : [{ id: 0, old_status: null, new_status: order.status, note: null, created_at: order.created_at }];

  return <div className="order-details-page">
    <header className="order-details-topbar">
      <Link to="/account/dashboard" className="order-back-link"><ArrowLeft size={17} /> My Account</Link>
      <Link to="/" className="customer-logo">999<span>+</span> KART</Link>
      <span className="order-topbar-label">ORDER TRACKING</span>
    </header>
    <main className="order-details-main">
      <div className="order-page-heading">
        <div><p className="order-eyebrow">ORDER DETAILS</p><h1>{order.order_code}</h1><p>Placed on {formatDate(order.created_at)}</p></div>
        <span className={`customer-order-status status-${order.status.replace(/[^a-z0-9]+/g, "-")}`}>{formatStatus(order.status)}</span>
      </div>

      <section className="order-track-panel">
        <div className="order-section-heading"><div><p className="order-eyebrow">LIVE ORDER PROGRESS</p><h2>Track your order</h2></div><Truck /></div>
        {order.status === "cancelled" || order.status === "returned" ? <div className="order-terminal-status">{formatStatus(order.status)}</div> :
          <div className="order-progress">
            {statusSteps.map((step, index) => {
              const completed = currentIndex >= index;
              const event = [...history].reverse().find((h) => h.new_status === step);
              return <div className={`order-progress-step ${completed ? "is-complete" : ""}`} key={step}>
                <span className="order-progress-dot">{completed ? <CheckCircle2 size={17} /> : <span />}</span>
                <div><strong>{formatStatus(step)}</strong>{event && <small>{formatDate(event.created_at)}</small>}</div>
              </div>;
            })}
          </div>}
        <div className="order-tracking-meta">
          <div><span>Courier partner</span><strong>{order.courier_name || "Not assigned yet"}</strong></div>
          <div><span>Tracking number</span><strong>{order.tracking_number || "Will be updated after dispatch"}</strong></div>
          <div><span>Expected delivery</span><strong>{order.expected_delivery_date ? formatDay(order.expected_delivery_date) : "To be confirmed"}</strong></div>
          {order.delivered_at && <div><span>Delivered on</span><strong>{formatDate(order.delivered_at)}</strong></div>}
        </div>
      </section>

      <section className="order-detail-panel">
        <div className="order-section-heading"><div><p className="order-eyebrow">PACKAGE CONTENTS</p><h2>Products in this order</h2></div><Package /></div>
        <div className="order-detail-items">{(order.order_items ?? []).map((item) => {
          const existing = item.product_id && reviewedProductIds.has(item.product_id)
            ? reviews.find((r) => r.product_id === item.product_id)
            : undefined;
          const draft = draftFor(item);
          return <article className="order-detail-product" key={item.id}>
            <div className="order-product-row">
              {item.product_image_url ? <img src={item.product_image_url} alt={item.product_name} /> : <div className="order-product-placeholder"><Package /></div>}
              <div className="order-product-info"><strong>{item.product_name}</strong>{item.product_sku && <small>SKU: {item.product_sku}</small>}<small>Quantity: {item.quantity} × {formatPrice(item.unit_price)}</small></div>
              <strong className="order-line-total">{formatPrice(item.line_total)}</strong>
            </div>
            {isDelivered && item.product_id && <div className="order-review-area">
              {existing ? <div className="order-review-existing"><span className="order-review-stars">{"★".repeat(existing.rating)}{"☆".repeat(5 - existing.rating)}</span>
                <strong>{existing.status === "approved" ? "Your review is published" : existing.status === "rejected" ? "Review not approved" : "Review submitted"}</strong>
                <small>{existing.status === "pending" ? "Your review is awaiting moderation." : existing.title}</small></div> :
                <form className="order-review-form" onSubmit={(e) => void submitReview(e, item)}>
                  <div><p className="order-eyebrow">YOUR FEEDBACK</p><h3>Rate this product</h3></div>
                  <div className="order-star-picker" role="radiogroup" aria-label={`Rating for ${item.product_name}`}>
                    {[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} aria-label={`${star} star${star > 1 ? "s" : ""}`} aria-pressed={draft.rating === star}
                      className={star <= draft.rating ? "selected" : ""} onClick={() => setReviewDrafts((all) => ({ ...all, [item.id]: { ...draft, rating: star } }))}><Star size={22} fill="currentColor" /></button>)}
                  </div>
                  <label>Review title<input value={draft.title} onChange={(e) => setReviewDrafts((all) => ({ ...all, [item.id]: { ...draft, title: e.target.value } }))} required maxLength={120} placeholder="Summarise your experience" /></label>
                  <label>Your review<textarea value={draft.body} onChange={(e) => setReviewDrafts((all) => ({ ...all, [item.id]: { ...draft, body: e.target.value } }))} required minLength={10} maxLength={3000} rows={3} placeholder="Tell others what you liked about this product..." /></label>
                  <button className="order-submit-review" type="submit" disabled={submittingId === item.id}>{submittingId === item.id ? "SUBMITTING..." : "SUBMIT REVIEW"}</button>
                  {reviewMessage[item.id] && <p className="order-review-message" role="status">{reviewMessage[item.id]}</p>}
                </form>}
            </div>}
            {(() => {
              const request = returnRequests.find((entry) => entry.order_item_id === item.id);
              const window = returnWindow();
              const draftReturn = returnDraftFor(item);
              return (
                <div className="order-return-area">
                  <div className="order-return-heading">
                    <div>
                      <p className="order-eyebrow">7-DAY RETURN POLICY</p>
                      <h3><RotateCcw size={17} /> Product return</h3>
                    </div>
                    {request && (
                      <span className={`order-return-status return-${request.status}`}>
                        {returnStatusLabel(request.status)}
                      </span>
                    )}
                  </div>

                  {request ? (
                    <div className="order-return-existing">
                      <strong>{returnStatusLabel(request.status)}</strong>
                      <span>Reason: {request.reason}</span>
                      {request.description && <p>{request.description}</p>}
                      <small>Requested on {formatDate(request.created_at)}</small>
                      {request.status === "pending" && <p>Your request is waiting for the admin to review it.</p>}
                      {(request.status === "approved" || request.status === "in_progress") && <p>Your return has been accepted. Our team will guide the next steps.</p>}
                    </div>
                  ) : !isDelivered ? (
                    <p className="order-return-muted">You can request a return after this order is delivered.</p>
                  ) : !order.delivered_at ? (
                    <p className="order-return-muted">The delivery date is not available, so return eligibility cannot be confirmed. Please contact support.</p>
                  ) : !window.eligible ? (
                    <p className="order-return-muted">The 7-day return period has ended for this product.</p>
                  ) : (
                    <form className="order-return-form" onSubmit={(event) => void submitReturnRequest(event, item)}>
                      <p className="order-return-deadline">{window.daysLeft} day{window.daysLeft === 1 ? "" : "s"} left to request a return.</p>
                      <label>
                        Reason for return
                        <select
                          value={draftReturn.reason}
                          onChange={(event) => setReturnDrafts((all) => ({
                            ...all,
                            [item.id]: { ...draftReturn, reason: event.target.value },
                          }))}
                        >
                          <option>Damaged or defective product</option>
                          <option>Wrong product received</option>
                          <option>Product is different from description</option>
                          <option>Missing parts or accessories</option>
                          <option>Size or fit issue</option>
                          <option>Other</option>
                        </select>
                      </label>
                      <label>
                        Additional details (optional)
                        <textarea
                          rows={2}
                          maxLength={1000}
                          value={draftReturn.description}
                          onChange={(event) => setReturnDrafts((all) => ({
                            ...all,
                            [item.id]: { ...draftReturn, description: event.target.value },
                          }))}
                          placeholder="Tell us briefly why you want to return this product..."
                        />
                      </label>
                      <button className="order-submit-return" type="submit" disabled={returnSubmittingId === item.id}>
                        {returnSubmittingId === item.id ? "SUBMITTING..." : "REQUEST PRODUCT RETURN"}
                      </button>
                      {returnMessages[item.id] && <p className="order-return-message" role="status">{returnMessages[item.id]}</p>}
                    </form>
                  )}
                  {returnMessages[item.id] && !request && !window.eligible && <p className="order-return-message" role="status">{returnMessages[item.id]}</p>}
                </div>
              );
            })()}
            {isDelivered && !item.product_id && <p className="order-review-unavailable">A review is not available for this item.</p>}
          </article>;
        })}</div>
      </section>

      <div className="order-details-two-column">
        <section className="order-detail-panel">
          <div className="order-section-heading"><div><p className="order-eyebrow">DELIVERY DESTINATION</p><h2>Shipping address</h2></div><MapPin /></div>
          {address.length ? <address className="order-address">{address.map((line, i) => <span key={`${line}-${i}`}>{line}</span>)}</address> : <p className="order-muted">Address information is unavailable.</p>}
          <p className="order-contact"><strong>Contact:</strong> {order.customer_phone}</p>
        </section>
        <section className="order-detail-panel">
          <div className="order-section-heading"><div><p className="order-eyebrow">PAYMENT SUMMARY</p><h2>Payment details</h2></div><CreditCard /></div>
          <div className="order-price-line"><span>Payment method</span><strong>{order.payment_method.replace(/_/g, " ")}</strong></div>
          <div className="order-price-line"><span>Payment status</span><strong>{order.payment_status.replace(/_/g, " ")}</strong></div>
          <div className="order-price-line"><span>Subtotal</span><strong>{formatPrice(order.subtotal)}</strong></div>
          <div className="order-price-line"><span>Delivery fee</span><strong>{formatPrice(order.delivery_fee)}</strong></div>
          {Number(order.discount_total) > 0 && <div className="order-price-line"><span>Discount</span><strong>-{formatPrice(order.discount_total)}</strong></div>}
          <div className="order-price-line order-grand-total"><span>Order total</span><strong>{formatPrice(order.grand_total)}</strong></div>
        </section>
      </div>

      <section className="order-detail-panel order-history-panel">
        <div className="order-section-heading"><div><p className="order-eyebrow">ORDER ACTIVITY</p><h2>Tracking history</h2></div><Clock3 /></div>
        <div className="order-history-list">{events.map((event) => <div className="order-history-event" key={event.id}>
          <span className="order-history-icon"><CheckCircle2 size={17} /></span>
          <div><strong>{formatStatus(event.new_status)}</strong>{event.note && <p>{event.note}</p>}<small>{formatDate(event.created_at)}</small></div>
        </div>)}</div>
        {order.customer_note && <p className="order-customer-note"><strong>Your order note:</strong> {order.customer_note}</p>}
      </section>
      <div className="order-bottom-actions"><Link to="/account/dashboard"><ArrowLeft size={16} /> BACK TO MY ORDERS</Link><Link to="/">CONTINUE SHOPPING</Link></div>
    </main>
    <footer className="customer-footer">© 2026 999+ KART. All rights reserved.</footer>
  </div>;
}
