import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  UserRound, ShoppingBag, MapPin, House, PackageOpen, LogOut,
  ArrowRight, CheckCircle2, Plus, Pencil, Trash2, X, Star, Phone
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import "./CustomerDashboard.css";
import "./CustomerDashboard.orders.css";

type Profile = { id: string; full_name: string; phone: string | null };
type Address = {
  id: string; recipient_name: string; phone: string; address_line1: string;
  address_line2: string | null; landmark: string | null; locality: string;
  city: string; district: string | null; state: string; postal_code: string;
  is_default: boolean;
};
type AddressForm = Omit<Address, "id" | "is_default" | "address_line2" | "landmark" | "district"> & {
  address_line2: string; landmark: string; district: string; is_default: boolean;
};
const emptyAddressForm: AddressForm = {
  recipient_name: "", phone: "", address_line1: "", address_line2: "",
  landmark: "", locality: "", city: "", district: "", state: "Kerala",
  postal_code: "", is_default: false,
};
type OrderSummaryItem = {
  product_id: string | null;
  product_name: string;
  product_image_url: string | null;
};

type OrderSummary = {
  id: string; order_code: string; status: string; created_at: string;
  order_items: OrderSummaryItem[];
};

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [addressForm, setAddressForm] = useState<AddressForm>({ ...emptyAddressForm });
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);

  useEffect(() => { void loadDashboard(); }, []);

  async function loadDashboard() {
    setLoading(true);
    setMessage("");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      navigate("/login", { replace: true });
      return;
    }
    const user = authData.user;
    setUserEmail(user.email ?? "");
    const [profileResult, addressResult, orderResult] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone").eq("id", user.id).maybeSingle(),
      supabase.from("addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false }),
      supabase.from("orders")
        .select("id, order_code, status, created_at, order_items(product_id, product_name, product_image_url)")
        .eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    if (profileResult.error) setMessage(profileResult.error.message);
    else setProfile(profileResult.data ?? {
      id: user.id, full_name: user.user_metadata?.full_name ?? "",
      phone: user.user_metadata?.phone ?? "",
    });
    if (addressResult.error) setMessage(addressResult.error.message);
    else setAddresses(addressResult.data ?? []);
    if (orderResult.error) setMessage(orderResult.error.message);
    else setOrders((orderResult.data ?? []) as OrderSummary[]);
    setLoading(false);
  }

  function openAddAddressForm() {
    setEditingAddressId(null);
    setAddressForm({ ...emptyAddressForm, recipient_name: profile?.full_name ?? "", phone: profile?.phone ?? "" });
    setAddressFormOpen(true);
    setMessage("");
  }
  function openEditAddressForm(address: Address) {
    setEditingAddressId(address.id);
    setAddressForm({
      recipient_name: address.recipient_name, phone: address.phone,
      address_line1: address.address_line1, address_line2: address.address_line2 ?? "",
      landmark: address.landmark ?? "", locality: address.locality, city: address.city,
      district: address.district ?? "", state: address.state, postal_code: address.postal_code,
      is_default: address.is_default,
    });
    setAddressFormOpen(true);
    setMessage("");
  }
  function closeAddressForm() {
    setAddressFormOpen(false);
    setEditingAddressId(null);
    setAddressForm({ ...emptyAddressForm });
  }

  async function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingAddress(true);
    setMessage("");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setMessage("Please sign in again to save your address.");
      setSavingAddress(false);
      return;
    }
    const userId = authData.user.id;
    const payload = {
      user_id: userId, recipient_name: addressForm.recipient_name.trim(),
      phone: addressForm.phone.trim(), address_line1: addressForm.address_line1.trim(),
      address_line2: addressForm.address_line2.trim() || null,
      landmark: addressForm.landmark.trim() || null, locality: addressForm.locality.trim(),
      city: addressForm.city.trim(), district: addressForm.district.trim() || null,
      state: addressForm.state.trim(), postal_code: addressForm.postal_code.trim(),
      is_default: addressForm.is_default || addresses.length === 0,
    };
    try {
      if (payload.is_default) {
        const { error } = await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId);
        if (error) throw error;
      }
      if (editingAddressId) {
        const { error } = await supabase.from("addresses").update(payload)
          .eq("id", editingAddressId).eq("user_id", userId);
        if (error) throw error;
        setMessage("Address updated successfully.");
      } else {
        const { error } = await supabase.from("addresses").insert(payload);
        if (error) throw error;
        setMessage("Address saved successfully.");
      }
      await loadDashboard();
      closeAddressForm();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this address.");
    } finally { setSavingAddress(false); }
  }

  async function deleteAddress(addressId: string) {
    if (!window.confirm("Are you sure you want to delete this address?")) return;
    setDeletingAddressId(addressId);
    setMessage("");
    const { error } = await supabase.from("addresses").delete().eq("id", addressId);
    if (error) setMessage(error.message);
    else {
      const deleted = addresses.find((a) => a.id === addressId);
      const remaining = addresses.filter((a) => a.id !== addressId);
      if (deleted?.is_default && remaining.length) {
        const { error: defaultError } = await supabase.from("addresses")
          .update({ is_default: true }).eq("id", remaining[0].id);
        if (defaultError) setMessage("Address deleted, but the next default address could not be selected: " + defaultError.message);
        else setMessage("Address deleted. Another saved address is now your default.");
        remaining[0] = { ...remaining[0], is_default: !defaultError };
      } else setMessage("Address deleted successfully.");
      setAddresses(remaining);
    }
    setDeletingAddressId(null);
  }

  async function makeDefaultAddress(addressId: string) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) { setMessage("Please sign in again to update your default address."); return; }
    const userId = authData.user.id;
    setMessage("");
    const { error: setError } = await supabase.from("addresses").update({ is_default: true })
      .eq("id", addressId).eq("user_id", userId);
    if (setError) { setMessage(setError.message); return; }
    const { error: clearError } = await supabase.from("addresses").update({ is_default: false })
      .eq("user_id", userId).neq("id", addressId);
    if (clearError) setMessage(`Address selected, but other defaults could not be cleared: ${clearError.message}`);
    else setMessage("Default delivery address updated.");
    const { data } = await supabase.from("addresses").select("*")
      .eq("user_id", userId).order("is_default", { ascending: false });
    setAddresses(data ?? []);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true); setMessage("");
    const { error } = await supabase.from("profiles").update({
      full_name: profile.full_name.trim(), phone: profile.phone?.trim() || null,
    }).eq("id", profile.id);
    setMessage(error ? error.message : "Profile updated successfully.");
    setSaving(false);
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) { setMessage(error.message); return; }
    navigate("/login", { replace: true });
  }
  function statusLabel(status: string) {
    return status.replace(/_/g, " ");
  }

  if (loading) return <div className="customer-loading"><div className="customer-loading-content">
    <ShoppingBag size={25} strokeWidth={1.8} /><span>Loading your account...</span>
  </div></div>;

  return <div className="customer-dashboard">
    <header className="customer-topbar">
      <Link to="/" className="customer-logo">999<span>+</span> KART</Link>
      <div className="customer-top-actions">
        <Link to="/account/settings" className="customer-continue-link">Account Settings</Link>
        <Link to="/" className="customer-continue-link">Continue Shopping <ArrowRight size={15} /></Link>
        <button onClick={logout} type="button"><LogOut size={16} /> Logout</button>
      </div>
    </header>

    <main className="customer-dashboard-main">
      <section className="customer-welcome">
        <div><p className="customer-eyebrow">YOUR ACCOUNT</p><h1>Welcome, {profile?.full_name || "Customer"}</h1><p>{userEmail}</p></div>
        <div className="customer-welcome-icon" aria-label="Profile"><UserRound /></div>
      </section>

      {message && <div className="customer-message" role="status">{message}</div>}

      <section className="customer-stats">
        <div className="customer-stat-card"><div className="customer-stat-icon"><ShoppingBag /></div><span>Total Orders</span><strong>{orders.length}</strong></div>
        <div className="customer-stat-card"><div className="customer-stat-icon"><MapPin /></div><span>Saved Addresses</span><strong>{addresses.length}</strong></div>
        <div className="customer-stat-card"><div className="customer-stat-icon"><CheckCircle2 /></div><span>Account</span><strong>Active</strong></div>
      </section>

      <div className="customer-dashboard-grid">
        <section className="customer-panel">
          <div className="customer-panel-heading"><div><p className="customer-eyebrow">PERSONAL DETAILS</p><h2>My Profile</h2></div><span aria-hidden="true"><UserRound /></span></div>
          {profile && <form className="customer-profile-form" onSubmit={saveProfile}>
            <label>Full Name<input type="text" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} required /></label>
            <label>Phone Number<input type="tel" value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></label>
            <button type="submit" disabled={saving} className="customer-primary-button">{saving ? "SAVING..." : "SAVE CHANGES"}</button>
          </form>}
        </section>

        <section className="customer-panel">
          <div className="customer-panel-heading">
            <div><p className="customer-eyebrow">DELIVERY DETAILS</p><h2>Saved Addresses</h2></div>
            <button type="button" className="customer-address-add-button" onClick={openAddAddressForm}><Plus size={16} /> Add Address</button>
          </div>
          {addressFormOpen && <form className="customer-address-form" onSubmit={saveAddress}>
            <div className="customer-address-form-heading"><h3>{editingAddressId ? "Edit Address" : "Add New Address"}</h3>
              <button type="button" className="customer-address-close" onClick={closeAddressForm} aria-label="Close address form"><X size={18} /></button></div>
            <div className="customer-address-fields">
              <label>Recipient Name *<input value={addressForm.recipient_name} onChange={(e) => setAddressForm({ ...addressForm, recipient_name: e.target.value })} required maxLength={100} autoComplete="name" /></label>
              <label>Phone Number *<input type="tel" value={addressForm.phone} onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })} required pattern="[6-9][0-9]{9}" title="Enter a valid 10-digit Indian mobile number" maxLength={10} autoComplete="tel" /></label>
              <label className="address-field-full">Address Line 1 *<input value={addressForm.address_line1} onChange={(e) => setAddressForm({ ...addressForm, address_line1: e.target.value })} required maxLength={200} autoComplete="address-line1" /></label>
              <label className="address-field-full">Address Line 2<input value={addressForm.address_line2} onChange={(e) => setAddressForm({ ...addressForm, address_line2: e.target.value })} maxLength={200} autoComplete="address-line2" /></label>
              <label>Locality / Area *<input value={addressForm.locality} onChange={(e) => setAddressForm({ ...addressForm, locality: e.target.value })} required maxLength={100} /></label>
              <label>Landmark<input value={addressForm.landmark} onChange={(e) => setAddressForm({ ...addressForm, landmark: e.target.value })} maxLength={150} /></label>
              <label>City / Town *<input value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} required maxLength={100} autoComplete="address-level2" /></label>
              <label>District<input value={addressForm.district} onChange={(e) => setAddressForm({ ...addressForm, district: e.target.value })} maxLength={100} /></label>
              <label>State *<input value={addressForm.state} onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} required maxLength={100} autoComplete="address-level1" /></label>
              <label>PIN Code *<input inputMode="numeric" value={addressForm.postal_code} onChange={(e) => setAddressForm({ ...addressForm, postal_code: e.target.value.replace(/\D/g, "").slice(0, 6) })} required pattern="[0-9]{6}" title="Enter a valid 6-digit PIN code" maxLength={6} autoComplete="postal-code" /></label>
            </div>
            <label className="customer-default-checkbox"><input type="checkbox" checked={addressForm.is_default} onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })} /> Set as my default delivery address</label>
            <div className="customer-address-form-actions"><button type="button" className="customer-secondary-button" onClick={closeAddressForm}>Cancel</button>
              <button type="submit" className="customer-primary-button" disabled={savingAddress}>{savingAddress ? "SAVING..." : editingAddressId ? "UPDATE ADDRESS" : "SAVE ADDRESS"}</button></div>
          </form>}
          {addresses.length === 0 ? <div className="customer-empty"><span><House /></span><p>No saved addresses yet.</p><small>Add a delivery address to make checkout quicker.</small></div> :
            <div className="customer-address-list">{addresses.map((address) => <div className={`customer-address-card ${address.is_default ? "is-default" : ""}`} key={address.id}>
              <div className="customer-address-title"><strong><UserRound /> {address.recipient_name}</strong>{address.is_default && <span><Star size={11} /> DEFAULT</span>}</div>
              <p className="customer-address-detail"><Phone /> {address.phone}</p><p>{address.address_line1}</p>
              {address.address_line2 && <p>{address.address_line2}</p>}{address.landmark && <p>Landmark: {address.landmark}</p>}
              <p>{address.locality}, {address.city}{address.district ? `, ${address.district}` : ""}</p><p>{address.state} - {address.postal_code}</p>
              <div className="customer-address-actions">
                {!address.is_default && <button type="button" onClick={() => void makeDefaultAddress(address.id)}><Star size={14} /> Set Default</button>}
                <button type="button" onClick={() => openEditAddressForm(address)}><Pencil size={14} /> Edit</button>
                <button type="button" className="customer-address-delete" onClick={() => void deleteAddress(address.id)} disabled={deletingAddressId === address.id}><Trash2 size={14} /> {deletingAddressId === address.id ? "Deleting..." : "Delete"}</button>
              </div>
            </div>)}</div>}
        </section>
      </div>

      <section className="customer-panel customer-orders-panel">
        <div className="customer-panel-heading"><div><p className="customer-eyebrow">YOUR PURCHASES</p><h2>My Orders</h2></div><span aria-hidden="true"><ShoppingBag /></span></div>
        {orders.length === 0 ? <div className="customer-empty"><span><PackageOpen /></span><p>No orders yet.</p><small>Your purchases will appear here once you place an order.</small><Link to="/" className="customer-primary-button">START SHOPPING <ArrowRight /></Link></div> :
          <div className="customer-order-list customer-order-summary-list">{orders.map((order) => <article className="customer-order-summary" key={order.id}>
            <div className="customer-order-summary-main">
              {order.order_items?.length > 0 && <div className="customer-order-product-list" aria-label="Products in this order">
                {order.order_items.map((item, index) => <div className="customer-order-product-mini" key={`${item.product_id ?? item.product_name}-${index}`}>
                  {item.product_image_url
                    ? <img src={item.product_image_url} alt={item.product_name} loading="lazy" />
                    : <span className="customer-order-product-placeholder"><PackageOpen size={15} /></span>}
                  <span className="customer-order-product-copy">
                    <strong>{item.product_name}</strong>
                    <small>ID: {item.product_id || "N/A"}</small>
                  </span>
                </div>)}
              </div>}
            </div>
            <span className={`customer-order-status status-${order.status.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{statusLabel(order.status)}</span>
            <Link className="customer-view-order" to={`/account/orders/${order.id}`}>VIEW ORDER <ArrowRight size={16} /></Link>
          </article>)}</div>}
      </section>
    </main>
    <footer className="customer-footer">© 2026 999+ KART. All rights reserved.</footer>
  </div>;
}
