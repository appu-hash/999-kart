import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Layers3,
  Package,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Truck,
  Wallet,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import AdminLayout from "../components/AdminLayout";
import "./AdminDashboard.css";

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

interface DashboardOrder {
  id: string;
  order_code: string;
  status: OrderStatus;
  grand_total: number | string;
  customer_name: string | null;
  created_at: string;
}

interface Stats {
  products: number;
  categories: number;
  orders: number;
  pending: number;
  delivered: number;
  revenue: number;
  todayOrders: number;
}

const statusLabels: Record<OrderStatus, string> = {
  new: "New",
  confirmed: "Confirmed",
  ready_for_meesho: "Ready for fulfilment",
  ordered_on_meesho: "Ordered on Meesho",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);

const formatDate = (value: string) =>
  new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    products: 0,
    categories: 0,
    orders: 0,
    pending: 0,
    delivered: 0,
    revenue: 0,
    todayOrders: 0,
  });
  const [recentOrders, setRecentOrders] = useState<DashboardOrder[]>([]);
  const [adminEmail, setAdminEmail] = useState("Administrator");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw userError;
      setAdminEmail(userData.user?.email ?? "Administrator");

      const [
        productsResult,
        categoriesResult,
        ordersResult,
      ] = await Promise.all([
        supabase
          .from("products")
          .select("id", { count: "exact", head: true }),

        supabase
          .from("categories")
          .select("id", { count: "exact", head: true }),

        // Lightweight order fields used for dashboard totals and recent activity.
        supabase
          .from("orders")
          .select("id, order_code, status, grand_total, customer_name, created_at")
          .order("created_at", { ascending: false }),
      ]);

      const queryError =
        productsResult.error ||
        categoriesResult.error ||
        ordersResult.error;

      if (queryError) throw queryError;

      const allOrders = (ordersResult.data ?? []) as DashboardOrder[];
      const activeOrders = allOrders.filter(
        (order) => order.status !== "cancelled" && order.status !== "returned"
      );
      const pendingStatuses: OrderStatus[] = [
        "new",
        "confirmed",
        "ready_for_meesho",
      ];
      const todayStart = startOfToday();

      setStats({
        products: productsResult.count ?? 0,
        categories: categoriesResult.count ?? 0,
        orders: allOrders.length,
        pending: allOrders.filter((order) =>
          pendingStatuses.includes(order.status)
        ).length,
        delivered: allOrders.filter((order) => order.status === "delivered").length,
        revenue: activeOrders.reduce(
          (sum, order) => sum + Number(order.grand_total || 0),
          0
        ),
        todayOrders: allOrders.filter(
          (order) => new Date(order.created_at) >= todayStart
        ).length,
      });

      setRecentOrders(allOrders.slice(0, 6));
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Dashboard loading error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard data. Please try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const statusBreakdown = useMemo(() => {
    const total = stats.orders || 1;
    return [
      { label: "Pending", count: stats.pending, color: "pending" },
      { label: "Delivered", count: stats.delivered, color: "delivered" },
      {
        label: "Other",
        count: Math.max(stats.orders - stats.pending - stats.delivered, 0),
        color: "other",
      },
    ].map((item) => ({
      ...item,
      percent: Math.round((item.count / total) * 100),
    }));
  }, [stats]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <AdminLayout title="Dashboard">
      <div className="admin-dashboard-content">
        <section className="admin-welcome">
          <div className="admin-welcome-copy">
            <p className="admin-welcome-eyebrow">
              <Sparkles size={13} /> YOUR STORE AT A GLANCE
            </p>
            <h1>{greeting}, welcome back!</h1>
            <p className="admin-welcome-description">
              Here's what's happening with your 999+ KART store today.
            </p>
            <div className="admin-welcome-meta">
              <span className="admin-live-dot" />
              <span>Signed in as {adminEmail}</span>
            </div>
          </div>
          <div className="admin-welcome-art" aria-hidden="true">
            <div className="admin-welcome-orbit admin-orbit-one" />
            <div className="admin-welcome-orbit admin-orbit-two" />
            <div className="admin-welcome-brand">999<span>+</span></div>
            <ShoppingBag className="admin-welcome-bag" size={34} />
          </div>
        </section>

        <div className="admin-dashboard-toolbar">
          <div>
            <h2>Store overview</h2>
            <p>
              {lastUpdated
                ? `Last updated ${lastUpdated.toLocaleTimeString("en-IN", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}`
                : "Your latest store performance"}
            </p>
          </div>
          <button
            type="button"
            className="admin-dashboard-refresh"
            onClick={() => void loadDashboard(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw size={15} className={refreshing ? "admin-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh data"}
          </button>
        </div>

        {error && (
          <div className="admin-dashboard-error" role="alert">
            <strong>Dashboard couldn't load all data.</strong>
            <span>{error}</span>
            <button type="button" onClick={() => void loadDashboard(true)}>
              Try again
            </button>
          </div>
        )}

        <section className="admin-stats" aria-label="Store statistics">
          <article className="admin-stat-card stat-products">
            <div className="admin-stat-topline">
              <span className="admin-stat-icon"><Package size={19} /></span>
              <span className="admin-stat-tag">CATALOGUE</span>
            </div>
            <span className="admin-stat-label">Total products</span>
            <strong>{loading ? "..." : stats.products.toLocaleString("en-IN")}</strong>
            <small>Products in your store</small>
            <Link to="/admin/products" className="admin-stat-link">
              Manage products <ArrowUpRight size={14} />
            </Link>
          </article>

          <article className="admin-stat-card stat-categories">
            <div className="admin-stat-topline">
              <span className="admin-stat-icon"><Layers3 size={19} /></span>
              <span className="admin-stat-tag">ORGANISATION</span>
            </div>
            <span className="admin-stat-label">Categories</span>
            <strong>{loading ? "..." : stats.categories.toLocaleString("en-IN")}</strong>
            <small>Active catalogue groups</small>
            <Link to="/admin/categories" className="admin-stat-link">
              View categories <ArrowUpRight size={14} />
            </Link>
          </article>

          <article className="admin-stat-card stat-orders">
            <div className="admin-stat-topline">
              <span className="admin-stat-icon"><ShoppingBag size={19} /></span>
              <span className="admin-stat-tag">ALL TIME</span>
            </div>
            <span className="admin-stat-label">Total orders</span>
            <strong>{loading ? "..." : stats.orders.toLocaleString("en-IN")}</strong>
            <small>{stats.todayOrders} received today</small>
            <Link to="/admin/orders" className="admin-stat-link">
              View orders <ArrowUpRight size={14} />
            </Link>
          </article>

          <article className="admin-stat-card stat-pending">
            <div className="admin-stat-topline">
              <span className="admin-stat-icon"><Clock3 size={19} /></span>
              <span className="admin-stat-tag">NEEDS ATTENTION</span>
            </div>
            <span className="admin-stat-label">Pending orders</span>
            <strong>{loading ? "..." : stats.pending.toLocaleString("en-IN")}</strong>
            <small>Awaiting next action</small>
            <Link to="/admin/orders" className="admin-stat-link">
              Process orders <ArrowUpRight size={14} />
            </Link>
          </article>
        </section>

        <section className="admin-dashboard-insights">
          <article className="admin-revenue-panel">
            <div className="admin-panel-heading">
              <div>
                <span className="admin-panel-kicker">STORE PERFORMANCE</span>
                <h2>Order value overview</h2>
              </div>
              <span className="admin-panel-icon"><Wallet size={19} /></span>
            </div>
            <div className="admin-revenue-main">
              <span>Total order value</span>
              <strong>{loading ? "..." : money(stats.revenue)}</strong>
              <small>
                Excludes cancelled and returned orders. This is order value,
                not net profit.
              </small>
            </div>
            <div className="admin-revenue-foot">
              <div>
                <span><CheckCircle2 size={14} /> Delivered</span>
                <strong>{stats.delivered}</strong>
              </div>
              <div>
                <span><Clock3 size={14} /> Pending</span>
                <strong>{stats.pending}</strong>
              </div>
              <div>
                <span><CalendarDays size={14} /> Today</span>
                <strong>{stats.todayOrders}</strong>
              </div>
            </div>
          </article>

          <article className="admin-status-panel">
            <div className="admin-panel-heading">
              <div>
                <span className="admin-panel-kicker">ORDER HEALTH</span>
                <h2>Order status snapshot</h2>
              </div>
              <span className="admin-panel-icon"><Activity size={19} /></span>
            </div>
            <div className="admin-status-total">
              <strong>{loading ? "..." : stats.orders}</strong>
              <span>Total orders</span>
            </div>
            <div className="admin-status-track" aria-label="Order status distribution">
              {statusBreakdown.map((item) => (
                <span
                  key={item.color}
                  className={`admin-status-segment segment-${item.color}`}
                  style={{ width: `${loading ? 0 : item.percent}%` }}
                />
              ))}
            </div>
            <div className="admin-status-legend">
              {statusBreakdown.map((item) => (
                <div key={item.color}>
                  <span className={`admin-legend-dot dot-${item.color}`} />
                  <span>{item.label}</span>
                  <strong>{loading ? "..." : item.count}</strong>
                  <small>{loading ? "" : `${item.percent}%`}</small>
                </div>
              ))}
            </div>
            <Link to="/admin/orders" className="admin-panel-link">
              Open order management <ArrowRight size={14} />
            </Link>
          </article>
        </section>

        <section className="admin-dashboard-bottom">
          <article className="admin-recent-panel">
            <div className="admin-section-heading">
              <div>
                <span className="admin-panel-kicker">LATEST ACTIVITY</span>
                <h2>Recent orders</h2>
              </div>
              <Link to="/admin/orders" className="admin-view-all">
                View all <ArrowRight size={14} />
              </Link>
            </div>

            {loading ? (
              <div className="admin-recent-loading">
                <span /><span /><span /><span />
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="admin-dashboard-empty">
                <ShoppingBag size={26} />
                <strong>No orders yet</strong>
                <span>New customer orders will appear here.</span>
              </div>
            ) : (
              <div className="admin-recent-list">
                {recentOrders.map((order) => (
                  <div className="admin-recent-order" key={order.id}>
                    <span className="admin-recent-order-icon">
                      <Package size={17} />
                    </span>
                    <div className="admin-recent-order-info">
                      <strong>{order.order_code || order.id.slice(0, 8)}</strong>
                      <span>{order.customer_name || "Customer"} · {formatDate(order.created_at)}</span>
                    </div>
                    <div className="admin-recent-order-right">
                      <strong>{money(Number(order.grand_total || 0))}</strong>
                      <span className={`admin-order-status status-${order.status}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="admin-quick-panel">
            <div className="admin-section-heading">
              <div>
                <span className="admin-panel-kicker">SHORTCUTS</span>
                <h2>Quick actions</h2>
              </div>
              <span className="admin-panel-icon"><Sparkles size={18} /></span>
            </div>

            <div className="admin-quick-grid">
              <Link to="/admin/products" className="admin-quick-action">
                <span className="quick-icon quick-purple"><Package size={18} /></span>
                <span><strong>Add a product</strong><small>Expand your catalogue</small></span>
                <ArrowRight size={16} />
              </Link>
              <Link to="/admin/categories" className="admin-quick-action">
                <span className="quick-icon quick-lavender"><Boxes size={18} /></span>
                <span><strong>Manage categories</strong><small>Organise your collections</small></span>
                <ArrowRight size={16} />
              </Link>
              <Link to="/admin/orders" className="admin-quick-action">
                <span className="quick-icon quick-pink"><Truck size={18} /></span>
                <span><strong>Process orders</strong><small>Update fulfilment status</small></span>
                <ArrowRight size={16} />
              </Link>
            </div>
            <div className="admin-dashboard-tip">
              <TrendingUp size={17} />
              <p><strong>Store tip</strong> Check pending orders regularly to keep fulfilment moving.</p>
            </div>
          </article>
        </section>

        <footer className="admin-dashboard-footer">
          <span>999+ KART ADMIN</span>
          <span>Store operations, one clear view.</span>
        </footer>
      </div>
    </AdminLayout>
  );
}
