import { useEffect, useMemo, useState } from "react";
import { Search, Users, ShoppingBag, IndianRupee, RefreshCw, X, Mail, Phone, MapPin, CalendarDays } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import AdminLayout from "../components/AdminLayout";
import "./AdminCustomers.css";

type Address = { id: string; recipient_name: string; phone: string; address_line1: string; address_line2: string | null; landmark: string | null; locality: string; city: string; district: string | null; state: string; postal_code: string; is_default: boolean };
type Order = { id: string; order_code: string; status: string; grand_total: number; created_at: string };
type Customer = { id: string; email: string; full_name: string; phone: string | null; created_at: string; email_confirmed_at: string | null; addresses: Address[]; orders: Order[]; total_spent: number };
type ResponseData = { customers?: Customer[]; error?: string };
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n || 0));
const date = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCustomers() {
    setLoading(true); setError("");
    const { data, error: invokeError } = await supabase.functions.invoke<ResponseData>("admin-customer-list", { body: {} });
    if (invokeError || data?.error) {
      setError(data?.error || invokeError?.message || "Unable to load customers.");
      setCustomers([]); setSelected(null); setLoading(false); return;
    }
    const rows = data?.customers || [];
    setCustomers(rows);
    setSelected((current) => current ? rows.find((c) => c.id === current.id) || null : null);
    setLoading(false);
  }
  useEffect(() => { void loadCustomers(); }, []);

  const visible = useMemo(() => customers.filter((c) => {
    const q = search.trim().toLowerCase();
    const match = !q || c.full_name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.phone || "").includes(q);
    const orderMatch = filter === "all" || (filter === "ordered" && c.orders.length > 0) || (filter === "no-orders" && c.orders.length === 0);
    return match && orderMatch;
  }), [customers, search, filter]);
  const orderCount = customers.reduce((n, c) => n + c.orders.length, 0);
  const revenue = customers.reduce((n, c) => n + c.total_spent, 0);

  return <AdminLayout title="Customers">
    <div className="admin-customers">
      <div className="ac-heading"><div><span className="ac-eyebrow">CUSTOMER RELATIONSHIPS</span><h2>Customers</h2><p>View registered customers, saved addresses and shopping activity.</p></div><button className="ac-refresh" onClick={() => void loadCustomers()} disabled={loading}><RefreshCw size={16}/> Refresh</button></div>
      <div className="ac-stats">
        <div><Users/><strong>{customers.length}</strong><span>Total customers</span></div>
        <div><ShoppingBag/><strong>{orderCount}</strong><span>Total orders</span></div>
        <div><IndianRupee/><strong>{money(revenue)}</strong><span>Total order value</span></div>
      </div>
      <section className="ac-panel">
        <div className="ac-toolbar"><label className="ac-search"><Search size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or phone"/></label><select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All customers</option><option value="ordered">With orders</option><option value="no-orders">No orders yet</option></select></div>
        {error && <div className="ac-error"><strong>Could not load customers</strong><span>{error}</span><small>Check that the admin-customer-list Edge Function is deployed and you are signed in as an administrator.</small></div>}
        {loading ? <div className="ac-empty">Loading customer records...</div> : !error && visible.length === 0 ? <div className="ac-empty">No customers found.</div> : !error && <div className="ac-table-wrap"><table className="ac-table"><thead><tr><th>Customer</th><th>Phone</th><th>Joined</th><th>Orders</th><th>Total spent</th></tr></thead><tbody>{visible.map((c) => <tr key={c.id} onClick={() => setSelected(c)}><td><div className="ac-person"><span>{(c.full_name || c.email || "C").charAt(0).toUpperCase()}</span><div><b>{c.full_name || "Unnamed customer"}</b><small>{c.email}</small></div></div></td><td>{c.phone || "Not added"}</td><td>{date(c.created_at)}</td><td>{c.orders.length}</td><td><b>{money(c.total_spent)}</b></td></tr>)}</tbody></table></div>}
        {!loading && !error && <footer className="ac-footer">Showing {visible.length} of {customers.length} customers</footer>}
      </section>
      {selected && <div className="ac-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}><aside className="ac-drawer"><header><div><span className="ac-eyebrow">CUSTOMER PROFILE</span><h3>Customer details</h3></div><button onClick={() => setSelected(null)} aria-label="Close"><X/></button></header>
        <div className="ac-identity"><span>{(selected.full_name || selected.email || "C").charAt(0).toUpperCase()}</span><div><b>{selected.full_name || "Unnamed customer"}</b><small>{selected.email_confirmed_at ? "Email verified" : "Email not verified"}</small></div></div>
        <div className="ac-contact"><p><Mail size={16}/>{selected.email}</p><p><Phone size={16}/>{selected.phone || "Phone not added"}</p><p><CalendarDays size={16}/>Joined {date(selected.created_at)}</p></div>
        <div className="ac-mini-stats"><div><b>{selected.orders.length}</b><small>Orders</small></div><div><b>{money(selected.total_spent)}</b><small>Total spent</small></div></div>
        <section className="ac-detail-section"><h4><MapPin size={16}/> Saved addresses ({selected.addresses.length})</h4>{selected.addresses.length ? selected.addresses.map((a) => <article className="ac-address" key={a.id}><b>{a.recipient_name} {a.is_default && <em>DEFAULT</em>}</b><p>{a.address_line1}{a.address_line2 ? `, ${a.address_line2}` : ""}{a.landmark ? `, ${a.landmark}` : ""}, {a.locality}, {a.city}{a.district ? `, ${a.district}` : ""}, {a.state} - {a.postal_code}</p><small>{a.phone}</small></article>) : <p className="ac-muted">No saved addresses.</p>}</section>
        <section className="ac-detail-section"><h4><ShoppingBag size={16}/> Order history ({selected.orders.length})</h4>{selected.orders.length ? selected.orders.map((o) => <article className="ac-order" key={o.id}><div><b>{o.order_code}</b><small>{date(o.created_at)}</small></div><div><b>{money(o.grand_total)}</b><small>{o.status.replaceAll("_", " ")}</small></div></article>) : <p className="ac-muted">No orders placed yet.</p>}</section>
      </aside></div>}
    </div>
  </AdminLayout>;
}
