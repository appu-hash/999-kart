
import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import "../AdminLayout.css";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
}

export default function AdminLayout({
  children,
  title,
}: AdminLayoutProps) {
  const navigate = useNavigate();

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert("Unable to sign out: " + error.message);
      return;
    }

    navigate("/admin", { replace: true });
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <a  className="admin-dashboard-logo">
          999<span>+</span> KART
        </a>

        <p className="admin-sidebar-label">MAIN MENU</p>

        <nav className="admin-navigation">
          <NavLink to="/admin/dashboard" end>
            Dashboard
          </NavLink>

          <NavLink to="/admin/analytics">
            Analytics
          </NavLink>

          <NavLink to="/admin/products">
            Products
          </NavLink>

          <NavLink to="/admin/categories">
            Categories
          </NavLink>

          <NavLink to="/admin/orders">
            Orders
          </NavLink>

          <NavLink to="/admin/returns">
            Returns
          </NavLink>

          <NavLink to="/admin/customers">
            Customers
          </NavLink>

          <NavLink to="/admin/support">
            Customer Support
          </NavLink>
        </nav>

        <div className="admin-sidebar-bottom">
          <button type="button" onClick={handleLogout}>
            ↪ Sign out
          </button>

          <a href="/">
            ← View storefront
          </a>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p>ADMINISTRATION</p>
            <h1>{title}</h1>
          </div>

          <div className="admin-user">
            <span className="admin-avatar">A</span>

            <div>
              <strong>Administrator</strong>
              <small>999+ KART Admin</small>
            </div>
          </div>
        </header>

        <div className="admin-page-content">
          {children}
        </div>

        <footer className="admin-footer">
          © 2026 999+ KART · ADMIN PANEL
        </footer>
      </main>
    </div>
  );
}
