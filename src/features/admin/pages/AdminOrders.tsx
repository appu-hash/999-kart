
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Search,
  RefreshCw,
  Package,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Truck,
  X,
  Save,
  Eye,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import AdminLayout from "../components/AdminLayout";
import "./AdminOrders.css";

type OrderStatus =
  | "new"
  | "confirmed"
  | "ready_for_meesho"
  | "ordered_on_meesho"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned";

type OrderItem = {
  id: string;
  product_name: string;
  product_sku: string | null;
  product_image_url: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type Order = {
  id: string;
  order_code: string;
  status: OrderStatus;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  delivery_fee: number;
  discount_total: number;
  grand_total: number;
  customer_name: string;
  customer_phone: string;
  delivery_address: Record<string, string> | null;
  customer_note: string | null;
  meesho_order_id: string | null;
  tracking_number: string | null;
  courier_name: string | null;
  expected_delivery_date: string | null;
  internal_notes: string | null;
  created_at: string;
  order_items: OrderItem[];
};

const statusOptions: { value: OrderStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "confirmed", label: "Confirmed" },
  { value: "ready_for_meesho", label: "Ready for Meesho" },
  { value: "ordered_on_meesho", label: "Ordered on Meesho" },
  { value: "shipped", label: "Shipped" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returned", label: "Returned" },
];

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount || 0);

const formatDate = (date: string) =>
  new Date(date).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);

  const [editStatus, setEditStatus] = useState<OrderStatus>("new");
  const [paymentStatus, setPaymentStatus] = useState("cod_due");
  const [meeshoId, setMeeshoId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [courierName, setCourierName] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const loadOrders = async () => {
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Unable to load orders:", fetchError);
      setError(`Unable to load orders: ${fetchError.message}`);
      setOrders([]);
    } else {
      setOrders((data ?? []) as Order[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // SEARCH: Website Order ID, Meesho ID, Customer Name and Phone
  const filteredOrders = useMemo(() => {
    const query = appliedSearch.trim().toLowerCase();

    return orders.filter((order) => {
      const searchMatch =
        !query ||
        order.id?.toLowerCase().includes(query) ||
        order.order_code?.toLowerCase().includes(query) ||
        order.meesho_order_id?.toLowerCase().includes(query) ||
        order.customer_name?.toLowerCase().includes(query) ||
        order.customer_phone?.toLowerCase().includes(query);

      const statusMatch =
        statusFilter === "all" || order.status === statusFilter;

      return searchMatch && statusMatch;
    });
  }, [orders, appliedSearch, statusFilter]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(search.trim());
  }

  function clearSearch() {
    setSearch("");
    setAppliedSearch("");
  }

  const totalRevenue = orders
    .filter(
      (order) =>
        order.status !== "cancelled" &&
        order.status !== "returned"
    )
    .reduce(
      (sum, order) => sum + Number(order.grand_total || 0),
      0
    );

  function openOrder(order: Order) {
    setSelectedOrder(order);
    setEditStatus(order.status);
    setPaymentStatus(order.payment_status || "cod_due");
    setMeeshoId(order.meesho_order_id || "");
    setTrackingNumber(order.tracking_number || "");
    setCourierName(order.courier_name || "");
    setExpectedDate(order.expected_delivery_date || "");
    setInternalNotes(order.internal_notes || "");
  }

  async function saveOrder() {
    if (!selectedOrder || saving) return;

    setSaving(true);
    setError("");

    // Set delivered_at the first time an order is marked as delivered.
    // Keep the original delivery timestamp if an already-delivered order is edited.
    const deliveredAt =
      editStatus === "delivered"
        ? selectedOrder.status === "delivered"
          ? (selectedOrder as Order & { delivered_at?: string | null }).delivered_at ?? new Date().toISOString()
          : new Date().toISOString()
        : (selectedOrder as Order & { delivered_at?: string | null }).delivered_at ?? null;

    const updatePayload = {
      status: editStatus,
      payment_status: paymentStatus,
      meesho_order_id: meeshoId.trim() || null,
      tracking_number: trackingNumber.trim() || null,
      courier_name: courierName.trim() || null,
      expected_delivery_date: expectedDate || null,
      internal_notes: internalNotes.trim() || null,
      delivered_at: deliveredAt,
    };

    try {
      // Selecting the updated row is important: Supabase can return no error
      // when RLS prevents a row from being updated. We detect that case below.
      const { data: updatedOrder, error: updateError } = await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", selectedOrder.id)
        .select("id, status")
        .maybeSingle();

      if (updateError) {
        console.error("Order update failed:", updateError);
        setError(
          `Could not save order changes: ${updateError.message}. Check the orders UPDATE policy and allowed status values in Supabase.`
        );
        return;
      }

      if (!updatedOrder) {
        setError(
          "No order was updated. Your admin account may not have UPDATE permission on the orders table. Check the Supabase RLS policy for admins."
        );
        return;
      }

      // Record status changes for the customer's order timeline.
      if (selectedOrder.status !== editStatus) {
        const { error: historyError } = await supabase
          .from("order_status_history")
          .insert({
            order_id: selectedOrder.id,
            old_status: selectedOrder.status,
            new_status: editStatus,
            note: `Order status updated by admin to ${editStatus.replace(/_/g, " ")}.`,
          });

        // The order update remains successful even if timeline history is not configured.
        if (historyError) {
          console.warn("Order updated, but status history was not saved:", historyError.message);
        }
      }

      await loadOrders();
      setSelectedOrder(null);
    } catch (unexpectedError) {
      console.error("Unexpected order save error:", unexpectedError);
      setError(
        unexpectedError instanceof Error
          ? unexpectedError.message
          : "An unexpected error occurred while saving the order."
      );
    } finally {
      setSaving(false);
    }
  }

  const countStatus = (status: string) =>
    orders.filter((order) => order.status === status).length;

  return (
    <AdminLayout title="Orders">
      <div className="admin-orders">

        {/* HEADING */}
        <div className="orders-heading">
          <div>
            <p className="orders-eyebrow">STORE MANAGEMENT</p>
            <h1>Orders</h1>
            <p>Manage customer orders and Meesho fulfilment.</p>
          </div>

          <button
            className="orders-refresh"
            onClick={loadOrders}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* ORDER STATISTICS */}
        <div className="orders-stats">
          <div className="orders-stat-card">
            <span className="orders-stat-icon">
              <ShoppingBag />
            </span>
            <div>
              <p>Total orders</p>
              <h2>{orders.length}</h2>
            </div>
          </div>

          <div className="orders-stat-card">
            <span className="orders-stat-icon">
              <Clock />
            </span>
            <div>
              <p>New orders</p>
              <h2>{countStatus("new")}</h2>
            </div>
          </div>

          <div className="orders-stat-card">
            <span className="orders-stat-icon">
              <Package />
            </span>
            <div>
              <p>Processing</p>
              <h2>
                {countStatus("confirmed") +
                  countStatus("ready_for_meesho") +
                  countStatus("ordered_on_meesho")}
              </h2>
            </div>
          </div>

          <div className="orders-stat-card">
            <span className="orders-stat-icon">
              <CheckCircle2 />
            </span>
            <div>
              <p>Delivered</p>
              <h2>{countStatus("delivered")}</h2>
            </div>
          </div>
        </div>

        {/* REVENUE */}
        <div className="orders-revenue-card">
          <div>
            <span>Total order value</span>
            <h2>{money(totalRevenue)}</h2>
          </div>
          <span className="orders-revenue-icon">
            <Truck size={24} />
          </span>
        </div>

        {/* SEARCH AND FILTER */}
        <div className="orders-toolbar">
          <form
            className="orders-search-form"
            onSubmit={handleSearch}
            role="search"
          >
            <div className="orders-search">
              <Search size={18} aria-hidden="true" />

              <input
                aria-label="Search by website order ID, Meesho order ID, customer name or phone"
                placeholder="Search website Order ID, Meesho ID, customer or phone..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <button
              type="submit"
              className="orders-search-button"
            >
              <Search size={16} />
              Search Order
            </button>

            {(search || appliedSearch) && (
              <button
                type="button"
                className="orders-clear-button"
                onClick={clearSearch}
              >
                <X size={15} />
                Clear
              </button>
            )}
          </form>

          <select
            aria-label="Filter by order status"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="all">All statuses</option>

            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="orders-error">{error}</div>
        )}

        {/* ORDERS TABLE */}
        <div className="orders-table-card">
          <div className="orders-table-heading">
            <h2>All orders</h2>
            <span>{filteredOrders.length} orders</span>
          </div>

          {loading ? (
            <div className="orders-empty">
              Loading orders...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="orders-empty">
              <ShoppingBag size={34} />
              <h3>No orders found</h3>
              <p>
                {appliedSearch
                  ? "No orders match your search. Try another Order ID, Meesho ID or clear the search."
                  : "Orders will appear here when customers place them."}
              </p>
            </div>
          ) : (
            <div className="orders-table-scroll">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="orders-code">
                        {order.order_code}
                      </td>

                      <td>
                        <strong>{order.customer_name}</strong>
                        <small>{order.customer_phone}</small>
                      </td>

                      <td>{formatDate(order.created_at)}</td>

                      <td>
                        {order.order_items?.length || 0}
                      </td>

                      <td className="orders-total">
                        {money(Number(order.grand_total))}
                      </td>

                      <td>
                        <span className="orders-payment">
                          {order.payment_method.toUpperCase()}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`orders-status status-${order.status}`}
                        >
                          {statusOptions.find(
                            (s) => s.value === order.status
                          )?.label || order.status}
                        </span>
                      </td>

                      <td>
                        <button
                          className="orders-view-button"
                          onClick={() => openOrder(order)}
                          title="View order"
                        >
                          <Eye size={17} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ORDER DETAILS MODAL */}
        {selectedOrder && (
          <div
            className="orders-modal-backdrop"
            onClick={() => setSelectedOrder(null)}
          >
            <div
              className="orders-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="orders-modal-header">
                <div>
                  <p>ORDER DETAILS</p>
                  <h2>{selectedOrder.order_code}</h2>
                </div>

                <button
                  onClick={() => setSelectedOrder(null)}
                  aria-label="Close"
                >
                  <X />
                </button>
              </div>

              <div className="orders-modal-body">

                {/* CUSTOMER INFORMATION */}
                <section className="orders-detail-section">
                  <h3>Customer information</h3>

                  <p>
                    <strong>{selectedOrder.customer_name}</strong>
                  </p>

                  <p>{selectedOrder.customer_phone}</p>

                  <p>
                    {selectedOrder.delivery_address
                      ? Object.entries(selectedOrder.delivery_address)
                          .filter(
                            ([key, value]) =>
                              value &&
                              !["recipient_name", "phone"].includes(key)
                          )
                          .map(([, value]) => value)
                          .join(", ")
                      : "No address available"}
                  </p>

                  {selectedOrder.customer_note && (
                    <p>
                      Customer note: {selectedOrder.customer_note}
                    </p>
                  )}
                </section>

                {/* PRODUCTS */}
                <section className="orders-detail-section">
                  <h3>Products</h3>

                  {selectedOrder.order_items?.map((item) => (
                    <div
                      className="orders-product-row"
                      key={item.id}
                    >
                      <div>
                        <strong>{item.product_name}</strong>
                        <small>
                          {item.product_sku || "No SKU"} · Qty: {item.quantity}
                        </small>
                      </div>

                      <strong>
                        {money(Number(item.line_total))}
                      </strong>
                    </div>
                  ))}

                  <div className="orders-grand-total">
                    <span>Order total</span>
                    <strong>
                      {money(Number(selectedOrder.grand_total))}
                    </strong>
                  </div>
                </section>

                {/* ORDER MANAGEMENT */}
                <section className="orders-detail-section">
                  <h3>Order management</h3>

                  <label>Order status</label>

                  <select
                    value={editStatus}
                    onChange={(event) =>
                      setEditStatus(event.target.value as OrderStatus)
                    }
                  >
                    {statusOptions.map((status) => (
                      <option
                        key={status.value}
                        value={status.value}
                      >
                        {status.label}
                      </option>
                    ))}
                  </select>

                  <label>COD payment status</label>

                  <select
                    value={paymentStatus}
                    onChange={(event) =>
                      setPaymentStatus(event.target.value)
                    }
                  >
                    <option value="cod_due">COD due</option>
                    <option value="cod_collected">COD collected</option>
                    <option value="not_collected">Not collected</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </section>

                {/* MEESHO FULFILMENT */}
                <section className="orders-detail-section">
                  <h3>Meesho fulfilment and tracking</h3>

                  <label>Meesho order ID</label>

                  <input
                    value={meeshoId}
                    onChange={(event) =>
                      setMeeshoId(event.target.value)
                    }
                    placeholder="Enter Meesho order ID"
                  />

                  <label>Courier name</label>

                  <input
                    value={courierName}
                    onChange={(event) =>
                      setCourierName(event.target.value)
                    }
                    placeholder="Enter courier name"
                  />

                  <label>Tracking number</label>

                  <input
                    value={trackingNumber}
                    onChange={(event) =>
                      setTrackingNumber(event.target.value)
                    }
                    placeholder="Enter tracking number"
                  />

                  <label>Expected delivery date</label>

                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(event) =>
                      setExpectedDate(event.target.value)
                    }
                  />

                  <label>Internal admin notes</label>

                  <textarea
                    value={internalNotes}
                    onChange={(event) =>
                      setInternalNotes(event.target.value)
                    }
                    placeholder="Notes for admin use..."
                    rows={3}
                  />
                </section>
              </div>

              {/* MODAL FOOTER */}
              <div className="orders-modal-footer">
                <button
                  className="orders-cancel-button"
                  onClick={() => setSelectedOrder(null)}
                >
                  Close
                </button>

                <button
                  className="orders-save-button"
                  onClick={saveOrder}
                  disabled={saving}
                >
                  <Save size={16} />
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
