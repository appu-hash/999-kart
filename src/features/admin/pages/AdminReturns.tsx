import { useCallback, useEffect, useState } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import AdminLayout from "../components/AdminLayout";
import "./AdminReturns.css";

type ReturnRequest = {
  id: string;
  order_id: string;
  order_item_id: string;
  user_id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  orders: { order_code: string; customer_name: string } | null;
  order_items: { product_name: string; quantity: number; product_image_url: string | null } | null;
};

const statusLabel = (status: string) => {
  if (status === "approved") return "Return in Progress";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

export default function AdminReturns() {
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setNotice("");
    const { data, error } = await supabase
      .from("return_requests")
      .select(`
        id, order_id, order_item_id, user_id, reason, description, status, created_at,
        orders (order_code, customer_name),
        order_items (product_name, quantity, product_image_url)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      setNotice(error.message);
      setRequests([]);
    } else {
      setRequests((data ?? []) as unknown as ReturnRequest[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  async function setRequestStatus(requestId: string, status: "approved" | "rejected" | "completed") {
    setBusyId(requestId);
    setNotice("");

    const { error } = await supabase
      .from("return_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", requestId);

    if (error) {
      setNotice(error.message);
    } else {
      setNotice(status === "approved"
        ? "Return accepted. The customer will see Return in Progress."
        : `Return marked as ${status}.`);
      await loadRequests();
    }
    setBusyId(null);
  }

  const visible = requests.filter((request) => filter === "all" || request.status === filter);

  return (
    <AdminLayout title="Product Returns">
      <div className="ar-page">
        <div className="ar-toolbar">
          <div>
            <p>AFTER-SALES MANAGEMENT</p>
            <h2>Product return requests</h2>
            <span>Review customer requests and manage return progress.</span>
          </div>
          <button type="button" onClick={() => void loadRequests()} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        <div className="ar-filters">
          {["pending", "approved", "rejected", "completed", "all"].map((value) => (
            <button
              type="button"
              key={value}
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value)}
            >
              {value === "all" ? "All requests" : statusLabel(value)}
              <span>{value === "all" ? requests.length : requests.filter((r) => r.status === value).length}</span>
            </button>
          ))}
        </div>

        {notice && <p className="ar-notice" role="status">{notice}</p>}

        {loading ? (
          <p className="ar-empty">Loading return requests...</p>
        ) : visible.length === 0 ? (
          <div className="ar-empty"><RotateCcw size={30} /><h3>No return requests</h3><p>There are no requests in this category.</p></div>
        ) : (
          <div className="ar-list">
            {visible.map((request) => (
              <article className="ar-card" key={request.id}>
                <div className="ar-product">
                  {request.order_items?.product_image_url
                    ? <img src={request.order_items.product_image_url} alt={request.order_items.product_name} />
                    : <div className="ar-image-placeholder"><RotateCcw /></div>}
                  <div>
                    <h3>{request.order_items?.product_name ?? "Product"}</h3>
                    <p>Order: {request.orders?.order_code ?? request.order_id}</p>
                    <p>Customer: {request.orders?.customer_name ?? request.user_id}</p>
                    <small>Requested {new Date(request.created_at).toLocaleString("en-IN")}</small>
                  </div>
                </div>

                <div className="ar-reason">
                  <strong>Reason: {request.reason}</strong>
                  {request.description && <p>{request.description}</p>}
                  <span className={`ar-status status-${request.status}`}>{statusLabel(request.status)}</span>
                </div>

                <div className="ar-actions">
                  {request.status === "pending" && (
                    <>
                      <button type="button" className="accept" disabled={busyId === request.id}
                        onClick={() => void setRequestStatus(request.id, "approved")}>
                        {busyId === request.id ? "Updating..." : "Accept return"}
                      </button>
                      <button type="button" className="reject" disabled={busyId === request.id}
                        onClick={() => void setRequestStatus(request.id, "rejected")}>
                        Reject
                      </button>
                    </>
                  )}
                  {request.status === "approved" && (
                    <button type="button" className="accept" disabled={busyId === request.id}
                      onClick={() => void setRequestStatus(request.id, "completed")}>
                      Mark return completed
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
