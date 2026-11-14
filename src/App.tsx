
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";

import {
  Search,
  UserRound,
  ShoppingBag,
  Sparkles,
  ShieldCheck,
  Truck,
  Heart,
  House,
  Headphones,
  Shirt,
  Flower2,
  Gem,
  ArrowUpRight,
  Bell,
  LayoutDashboard,
  LockKeyhole,
  Shield,
  LogOut,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";

import "./App.css";
import { supabase } from "./lib/supabase";

import AdminLogin from "./features/admin/pages/AdminLogin";
import AdminDashboard from "./features/admin/pages/AdminDashboard";
import AdminProducts from "./features/admin/pages/AdminProducts";
import AdminOrders from "./features/admin/pages/AdminOrders";
import AdminCustomers from "./features/admin/pages/AdminCustomers";
import AdminCategories from "./features/admin/pages/AdminCategories";
import AdminSupport from "./features/admin/pages/AdminSupport";
import AdminReturns from "./features/admin/pages/AdminReturns";
import ProductGrid from "./features/products/ProductGrid";
import ProductDetails from "./features/products/ProductDetails";
import "./features/products/HomepageSections.css";


import { CartProvider, useCart } from "./features/cart/CartContext";
import CartPage from "./features/cart/CartPage";

import CustomerAuth from "./features/customer/pages/CustomerAuth";
import CustomerDashboard from "./features/customer/pages/CustomerDashboard";
import CustomerSettings from "./features/customer/pages/CustomerSettings";
import UpdatePassword from "./features/customer/pages/UpdatePassword";
import OrderDetails from "./features/customer/pages/OrderDetails";
import CustomerSupport from "./features/customer/pages/CustomerSupport";
import ReturnsOrders from "./features/customer/pages/ReturnsOrders";
import Notifications from "./features/customer/pages/Notifications";
import GrowthHub from "./features/growth/GrowthHub";
import AdminGrowthAnalytics from "./features/admin/pages/AdminGrowthAnalytics";

// ------------------------------------
// PROTECTED ADMIN ROUTES
// ------------------------------------

function ProtectedAdmin({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    async function verifyAdmin() {
      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      setIsAdmin(
        !error && data.user?.app_metadata?.role === "admin"
      );

      setChecking(false);
    }

    verifyAdmin();

    return () => {
      active = false;
    };
  }, []);

  if (checking) {
    return (
      <div className="product-message">
        Verifying administrator...
      </div>
    );
  }

  return isAdmin ? (
    <>{children}</>
  ) : (
    <Navigate to="/admin" replace />
  );
}

// ------------------------------------
// STOREFRONT
// ------------------------------------

function Storefront() {
  const { cartCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const isCategoryRoute = location.pathname === "/categories" || location.pathname.startsWith("/categories/");
  const categorySlug = location.pathname.startsWith("/categories/")
    ? decodeURIComponent(location.pathname.split("/")[2] || "")
    : "";
  const currentPage = isCategoryRoute ? "categories"
    : location.pathname === "/shop" ? "shop"
    : location.pathname === "/about" ? "about" : "home";

  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [activeMegaCategoryId, setActiveMegaCategoryId] = useState("");

  const profileRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  type StoreCategory = {
    id: string; name: string; slug: string;
    description: string | null; image_url: string | null;
    banner_image_url: string | null; icon_name: string | null;
    is_featured: boolean; show_in_menu: boolean;
    parent_category_id: string | null; sort_order: number;
  };
  type RecentProduct = { id: string; name: string; selling_price: number; image_url: string | null };
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedCategoryName, setSelectedCategoryName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);
  const [suggestedProducts, setSuggestedProducts] = useState<RecentProduct[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("999kart_recent_searches") || "[]");
      if (Array.isArray(saved)) {
        setRecentSearches(saved.filter((item): item is string => typeof item === "string").slice(0, 10));
      }
    } catch {
      setRecentSearches([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function loadHomepageData() {
      const { data: categoryRows, error: categoryError } = await supabase
        .from("categories")
        .select("id, name, slug, description, image_url, banner_image_url, icon_name, is_featured, show_in_menu, parent_category_id, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (categoryError) console.error("Category loading error:", categoryError);
      if (active) setCategories((categoryRows ?? []) as StoreCategory[]);

      let viewedIds: string[] = [];
      try {
        const parsed = JSON.parse(localStorage.getItem("999kart_recently_viewed") || "[]");
        if (Array.isArray(parsed)) viewedIds = parsed.filter((id): id is string => typeof id === "string").slice(0, 8);
      } catch { viewedIds = []; }

      if (viewedIds.length) {
        const { data } = await supabase.from("products")
          .select("id, name, selling_price, image_url")
          .eq("is_active", true).in("id", viewedIds);
        if (active) {
          const byId = new Map((data ?? []).map((p) => [p.id, p]));
          setRecentProducts(viewedIds.map((id) => byId.get(id)).filter(Boolean) as RecentProduct[]);
        }
      } else if (active) setRecentProducts([]);

      const { data: picks } = await supabase.from("products")
        .select("id, name, selling_price, image_url")
        .eq("is_active", true).order("created_at", { ascending: false }).limit(4);
      if (active) setSuggestedProducts((picks ?? []) as RecentProduct[]);
    }
    loadHomepageData();
    return () => { active = false; };
  }, []);

  const mainCategories = categories.filter((category) => !category.parent_category_id);
  const menuCategories = mainCategories.filter((category) => category.show_in_menu !== false);
  const activeMegaCategory = categories.find((category) => category.id === activeMegaCategoryId) || menuCategories[0];

  function getChildren(parentId: string) {
    return categories.filter((category) => category.parent_category_id === parentId);
  }

  function getDescendantIds(categoryId: string): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const walk = (parentId: string) => {
      getChildren(parentId).forEach((child) => {
        if (visited.has(child.id)) return;
        visited.add(child.id);
        result.push(child.id);
        walk(child.id);
      });
    };
    result.push(categoryId);
    visited.add(categoryId);
    walk(categoryId);
    return result;
  }

  function navigateToCategory(category: StoreCategory) {
    setMegaMenuOpen(false);
    if (getChildren(category.id).length > 0) {
      navigate(`/categories/${encodeURIComponent(category.slug)}`);
    } else {
      navigate(`/shop?category=${encodeURIComponent(category.slug)}`);
    }
  }

  function chooseCategory(category: StoreCategory) {
    setSelectedCategoryIds(getDescendantIds(category.id));
    setSelectedCategoryName(category.name);
    navigate(`/shop?category=${encodeURIComponent(category.slug)}`);
  }

  function clearCategory() {
    setSelectedCategoryIds([]);
    setSelectedCategoryName("");
    navigate("/shop");
  }

  function saveRecentSearch(query: string) {
    const value = query.trim();
    if (!value) return;
    const updated = [value, ...recentSearches.filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, 10);
    setRecentSearches(updated);
    try { localStorage.setItem("999kart_recent_searches", JSON.stringify(updated)); }
    catch (error) { console.error("Unable to save recent searches:", error); }
  }

  function removeRecentSearch(query: string) {
    const updated = recentSearches.filter((item) => item !== query);
    setRecentSearches(updated);
    try { localStorage.setItem("999kart_recent_searches", JSON.stringify(updated)); }
    catch (error) { console.error("Unable to update recent searches:", error); }
  }

  function handleProductSearch(query = searchQuery) {
    const value = query.trim();
    if (!value) { setSearchOpen(false); navigate("/shop"); return; }
    setSearchQuery(value);
    saveRecentSearch(value);
    setSearchOpen(false);
    setMegaMenuOpen(false);
    setProfileOpen(false);
    setNotificationsOpen(false);
    navigate(`/shop?q=${encodeURIComponent(value)}`);
  }

  const categoryIcon = (name: string) => {
    const value = name.toLowerCase();
    if (value.includes("fashion") || value.includes("clothing") || value.includes("women") || value.includes("men")) return Shirt;
    if (value.includes("electronic") || value.includes("mobile")) return Headphones;
    if (value.includes("home") || value.includes("decor") || value.includes("kitchen")) return House;
    if (value.includes("beauty") || value.includes("skin")) return Flower2;
    if (value.includes("jewel") || value.includes("watch") || value.includes("accessor")) return Gem;
    return Sparkles;
  };

  // Apply a category filter when the dedicated shop page is opened.
  useEffect(() => {
    if (location.pathname !== "/shop") {
      setSelectedCategoryIds([]);
      setSelectedCategoryName("");
      return;
    }
    const slug = new URLSearchParams(location.search).get("category");
    if (!slug) {
      setSelectedCategoryIds([]);
      setSelectedCategoryName("");
      return;
    }
    const selected = categories.find((item) => item.slug === slug);
    if (!selected) return;
    setSelectedCategoryIds(getDescendantIds(selected.id));
    setSelectedCategoryName(selected.name);
  }, [location.pathname, location.search, categories]);

  // Restore a submitted search from the URL, including after refresh.
  useEffect(() => {
    if (location.pathname === "/shop") {
      const params = new URLSearchParams(location.search);
      setSearchQuery(params.get("q") || "");
    }
  }, [location.pathname, location.search]);

  const activeCategory = categorySlug
    ? categories.find((category) => category.slug === categorySlug)
    : null;
  const activeCategoryChildren = activeCategory ? getChildren(activeCategory.id) : [];
  const activeCategoryParent = activeCategory?.parent_category_id
    ? categories.find((category) => category.id === activeCategory.parent_category_id)
    : null;

  useEffect(() => {
    if (menuCategories.length && !menuCategories.some((category) => category.id === activeMegaCategoryId)) {
      setActiveMegaCategoryId(menuCategories[0].id);
    }
  }, [categories]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;

      if (
        profileRef.current &&
        !profileRef.current.contains(target)
      ) {
        setProfileOpen(false);
      }

      if (
        notificationRef.current &&
        !notificationRef.current.contains(target)
      ) {
        setNotificationsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileOpen(false);
        setNotificationsOpen(false);
        setMegaMenuOpen(false);
        setSearchOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // Logout customer
  async function handleLogout() {
    setLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    setLoggingOut(false);
    setProfileOpen(false);

    if (error) {
      alert(error.message);
      return;
    }

    navigate("/account");
  }

  function closeMenus() {
    setProfileOpen(false);
    setNotificationsOpen(false);
    setMegaMenuOpen(false);
  }

  return (
    <div className="store">

      {/* ANNOUNCEMENT BAR */}

      <div className="announcement">
        DISCOVER MORE EVERY DAY  •  CASH ON DELIVERY AVAILABLE  •  EASY ONLINE SHOPPING
      </div>

      {/* HEADER */}

      <header className="header">

        <Link className="logo" to="/" onClick={closeMenus}>
          999<span>+</span> KART
        </Link>

        <Link className="delivery-location" to="/account/dashboard" onClick={closeMenus}>
          <Truck size={17} />
          <span><small>DELIVER TO</small><strong>Select your address</strong></span>
          <ChevronDown size={13} />
        </Link>

        <nav>
          <Link to="/" onClick={closeMenus}>Home</Link>
          <div className="mega-menu-anchor" onMouseEnter={() => setMegaMenuOpen(true)} onMouseLeave={() => setMegaMenuOpen(false)}>
            <button type="button" className={`nav-category-trigger ${megaMenuOpen ? "is-open" : ""}`} aria-expanded={megaMenuOpen} onClick={() => setMegaMenuOpen((open) => !open)} onFocus={() => setMegaMenuOpen(true)}>
              Categories <ChevronDown size={13} />
            </button>
            {megaMenuOpen && (
              <div className="category-mega-menu">
                <div className="mega-menu-heading">
                  <div><span>EXPLORE 999+ KART</span><strong>Shop by department</strong></div>
                  <Link to="/categories" onClick={closeMenus}>View all <ArrowUpRight size={14} /></Link>
                </div>
                <div className="mega-menu-content">
                  <div className="mega-department-list">
                    {menuCategories.map((category) => {
                      const Icon = categoryIcon(category.name);
                      return (
                        <button type="button" key={category.id} className={activeMegaCategory?.id === category.id ? "active" : ""} onMouseEnter={() => setActiveMegaCategoryId(category.id)} onFocus={() => setActiveMegaCategoryId(category.id)} onClick={() => navigateToCategory(category)}>
                          <Icon size={17} /><span>{category.name}</span><ChevronRight size={14} />
                        </button>
                      );
                    })}
                  </div>
                  {activeMegaCategory && (
                    <div className="mega-subcategory-area">
                      <div className="mega-subcategory-title">
                        <strong>{activeMegaCategory.name}</strong>
                        <Link to={`/categories/${encodeURIComponent(activeMegaCategory.slug)}`} onClick={closeMenus}>Explore all <ArrowUpRight size={13} /></Link>
                      </div>
                      <div className="mega-subcategory-columns">
                        {getChildren(activeMegaCategory.id).length ? getChildren(activeMegaCategory.id).map((child) => (
                          <div className="mega-subcategory-column" key={child.id}>
                            <Link to={getChildren(child.id).length ? `/categories/${encodeURIComponent(child.slug)}` : `/shop?category=${encodeURIComponent(child.slug)}`} onClick={closeMenus}>{child.name}</Link>
                            {getChildren(child.id).map((leaf) => (
                              <Link className="mega-leaf-link" key={leaf.id} to={`/shop?category=${encodeURIComponent(leaf.slug)}`} onClick={closeMenus}>{leaf.name}</Link>
                            ))}
                          </div>
                        )) : <p className="mega-empty">Explore this department to see its collection.</p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <Link to="/shop" onClick={closeMenus}>Shop</Link>
          
        </nav>

        <div className="header-actions">

          {/* AMAZON-STYLE SEARCH */}
          <div className="header-search-wrapper">
            {searchOpen && <button type="button" className="search-backdrop" aria-label="Close search suggestions" onClick={() => setSearchOpen(false)} />}
            <label className="header-search" aria-label="Search products">
              <button type="button" className="search-submit-button" aria-label="Submit search" onClick={() => handleProductSearch()}>
                <Search size={19} />
              </button>
              <input
                type="search"
                value={searchQuery}
                placeholder="Search 999+ KART..."
                aria-label="Search 999+ KART products"
                onFocus={() => setSearchOpen(true)}
                onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true); }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") { event.preventDefault(); handleProductSearch(); }
                  if (event.key === "Escape") setSearchOpen(false);
                }}
              />
              {searchQuery && <button type="button" className="search-clear-button" aria-label="Clear search" onClick={() => { setSearchQuery(""); if (location.pathname === "/shop") navigate("/shop"); }}><X size={16} /></button>}
            </label>

            {searchOpen && (
              <div className="amazon-search-panel">
                {recentProducts.length > 0 && (
                  <section className="search-recent-products">
                    <h3>KEEP SHOPPING FOR</h3>
                    <div className="search-recent-product-list">
                      {recentProducts.slice(0, 6).map((product) => (
                        <button type="button" className="search-recent-product" key={product.id} onClick={() => { setSearchOpen(false); navigate(`/product/${product.id}`); }}>
                          {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" /> : <div className="search-product-placeholder">999+ KART</div>}
                          <span title={product.name}>{product.name}</span>
                          <small>Recently viewed</small>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {recentSearches.length > 0 && (
                  <section className="search-history" aria-label="Recent searches">
                    {recentSearches.map((item) => (
                      <div className="search-history-item" key={item}>
                        <button type="button" className="search-history-query" onClick={() => handleProductSearch(item)}>
                          <Search size={15} /><span>{item}</span>
                        </button>
                        <button type="button" className="search-history-remove" aria-label={`Remove ${item} from recent searches`} onClick={() => removeRecentSearch(item)}><X size={18} /></button>
                      </div>
                    ))}
                  </section>
                )}

                {recentProducts.length === 0 && recentSearches.length === 0 && (
                  <div className="search-empty-state"><Search size={28} /><h3>Start exploring</h3><p>Your recently viewed products and searches will appear here.</p></div>
                )}

                {searchQuery.trim() && (
                  <button type="button" className="search-view-results" onClick={() => handleProductSearch()}>
                    Search for “{searchQuery.trim()}” <ArrowUpRight size={16} />
                  </button>
                )}
              </div>
            )}
          </div>

          <Link to="/account/returns-orders" className="orders-shortcut" onClick={closeMenus}>
            <span>Returns</span><strong>& Orders</strong>
          </Link>

          {/* NOTIFICATIONS */}

          <div className="header-dropdown" ref={notificationRef}>
            <button
              type="button"
              className={`header-icon-button ${
                notificationsOpen ? "active" : ""
              }`}
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              title="Notifications"
              onClick={() => {
                setNotificationsOpen((previous) => !previous);
                setProfileOpen(false);
              }}
            >
              <Bell size={21} strokeWidth={1.8} />
            </button>

            {notificationsOpen && (
              <div className="header-dropdown-menu notification-menu">

                <div className="dropdown-heading">
                  <div>
                    <h3>Notifications</h3>
                    <p>Your latest updates</p>
                  </div>

                  <span className="notification-count">0 new</span>
                </div>

                <div className="notification-empty">
                  <span className="notification-empty-icon">
                    <Bell size={25} />
                  </span>

                  <h4>Stay up to date</h4>

                  <p>
                    View order updates, delivery alerts, return updates
                    and account activity in your notification centre.
                  </p>

                  <Link
                    to="/account/notifications"
                    className="notification-view-all"
                    onClick={() => setNotificationsOpen(false)}
                  >
                    View all notifications
                  </Link>
                </div>

              </div>
            )}
          </div>

          {/* PROFILE DROPDOWN */}

          <div className="header-dropdown" ref={profileRef}>
            <button
              type="button"
              className={`header-icon-button profile-trigger ${
                profileOpen ? "active" : ""
              }`}
              aria-label="My account menu"
              aria-expanded={profileOpen}
              title="My Account"
              onClick={() => {
                setProfileOpen((previous) => !previous);
                setNotificationsOpen(false);
              }}
            >
              <UserRound size={21} strokeWidth={1.8} />
              <ChevronDown size={13} className="profile-chevron" />
            </button>

            {profileOpen && (
              <div className="header-dropdown-menu profile-menu">

                <div className="dropdown-heading">
                  <div>
                    <h3>My Account</h3>
                    <p>Manage your shopping account</p>
                  </div>
                </div>

                <div className="dropdown-divider" />

                <Link
                  to="/account/dashboard"
                  className="dropdown-item"
                  onClick={closeMenus}
                >
                  <LayoutDashboard size={18} />
                  <span>My Dashboard</span>
                </Link>

                <Link to="/account/benefits" className="dropdown-item" onClick={closeMenus}>
                  <Sparkles size={18} />
                  <span>Wishlist & Rewards</span>
                </Link>

                <Link
                  to="/account/dashboard?section=settings"
                  className="dropdown-item"
                  onClick={closeMenus}
                >
                  
                  <LockKeyhole size={18} />
                  <span>Password & Security</span>
                </Link>

                <Link
                  to="/account/support"
                  className="dropdown-item"
                  onClick={closeMenus}
                >
                  <Shield size={18} />
                  <span>Customer Support</span>
                </Link>

                <div className="dropdown-divider" />

                <button
                  type="button"
                  className="dropdown-item logout-item"
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  <LogOut size={18} />
                  <span>
                    {loggingOut ? "Logging out..." : "Logout"}
                  </span>
                </button>

              </div>
            )}
          </div>

          {/* SHOPPING CART */}

          <Link
            to="/cart"
            className="header-cart-link"
            aria-label={`Shopping bag with ${cartCount} items`}
            title="Shopping Cart"
          >
            <ShoppingBag size={21} strokeWidth={1.8} />

            <span className="header-cart-count">
              {cartCount}
            </span>
          </Link>

        </div>
      </header>

      <div className="store-subnav">
        <Link to="/categories"><span className="subnav-dot" /> Shop all categories</Link>
        <Link to="/shop">Today's finds</Link>
        <Link to="/shop">Best sellers</Link>
        <span className="subnav-message"><Truck size={14} /> Easy ordering. Convenient delivery.</span>
      </div>

      {/* MAIN CONTENT */}

      <main>

        {currentPage === "home" && (
          <>
        {/* HERO SECTION */}

        <section className="hero">

          <div className="hero-content">

            <p className="eyebrow">
              THE NEW WAY TO SHOP
            </p>

            <h1>
              Everything
              <br />
              you love.
              <br />
              <span>One kart.</span>
            </h1>

            <p className="hero-description">
              Explore handpicked fashion, lifestyle essentials and everyday
              finds, all in one easy shopping destination.
            </p>

            <Link to="/shop" className="primary-button">
              SHOP THE COLLECTION
              <ArrowUpRight size={18} />
            </Link>

          </div>

          <div className="hero-image">

            <img
              src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200"
              alt="Modern shopping collection"
            />

            <div className="hero-sticker">
              <strong>999+</strong>
              <span>FINDS TO LOVE</span>
            </div>

          </div>

        </section>

        {/* BENEFITS */}

        <section className="benefits">

          <div>
            <Sparkles size={19} strokeWidth={1.8} />
            <span>Carefully Selected Products</span>
          </div>

          <div>
            <Heart size={19} strokeWidth={1.8} />
            <span>Easy Shopping Experience</span>
          </div>

          <div>
            <Truck size={19} strokeWidth={1.8} />
            <span>Cash on Delivery</span>
          </div>

          <div>
            <ShieldCheck size={19} strokeWidth={1.8} />
            <span>Secure Account Access</span>
          </div>

        </section>

      
        

        {/* PROMOTIONAL BANNERS */}
        <section className="home-promo-grid section">
          <Link to="/shop" className="home-promo-banner home-promo-purple">
            <div>
              <span>DISCOVER SOMETHING NEW</span>
              <h2>Everyday finds.<br />Better choices.</h2>
              <strong>SHOP NOW <ArrowUpRight size={16} /></strong>
            </div>
            <div className="promo-decoration"><ShoppingBag size={75} /></div>
          </Link>

          <Link to="/categories" className="home-promo-banner home-promo-lilac">
            <div>
              <span>YOUR NEXT FAVOURITE IS HERE</span>
              <h2>Explore more.<br />Find more.</h2>
              <strong>EXPLORE CATEGORIES <ArrowUpRight size={16} /></strong>
            </div>
            <div className="promo-decoration"><Sparkles size={75} /></div>
          </Link>
        </section>

        <section className="delivery-assurance" aria-label="Shopping and delivery information">
          <div className="assurance-icon"><Truck size={22} /></div>
          <div><strong>Delivery made simple</strong><span>Track your order updates from your account dashboard.</span></div>
          <div className="assurance-divider" />
          <div className="assurance-icon"><ShieldCheck size={22} /></div>
          <div><strong>Shop with confidence</strong><span>Secure sign-in and convenient payment options.</span></div>
          <Link to="/account/dashboard" className="assurance-link">MY ORDERS <ArrowUpRight size={15} /></Link>
        </section>

        {/* RECENTLY VIEWED */}
        {recentProducts.length > 0 && (
          <section className="homepage-shelf section" aria-label="Recently viewed products">
            <div className="section-heading"><div><p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2>Recently viewed</h2></div></div>
            <div className="homepage-product-row">
              {recentProducts.map((product) => (
                <button type="button" className="homepage-mini-product" key={product.id} onClick={() => navigate(`/product/${product.id}`)}>
                  {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" /> : <span className="mini-no-image">999+ KART</span>}
                  <strong>{product.name}</strong>
                  <span>{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(product.selling_price)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* SUGGESTED PICKS */}
        {suggestedProducts.length > 0 && (
          <section className="homepage-shelf section">
            <div className="section-heading"><div><p className="eyebrow">FRESH FINDS TO EXPLORE</p><h2>Picked for you</h2></div></div>
            <div className="homepage-product-row">
              {suggestedProducts.map((product) => (
                <button type="button" className="homepage-mini-product" key={product.id} onClick={() => navigate(`/product/${product.id}`)}>
                  {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" /> : <span className="mini-no-image">999+ KART</span>}
                  <strong>{product.name}</strong>
                  <span>{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(product.selling_price)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ALL PRODUCTS: FULL HOMEPAGE CATALOGUE */}
        <section className="products section homepage-all-products">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE 999+ KART COLLECTION</p>
              <h2>Explore all products</h2>
              <p className="home-products-subtitle">
                Discover everything available in our store.
              </p>
            </div>
            <Link to="/shop" className="section-link">
              OPEN SHOP <ArrowUpRight size={17} />
            </Link>
          </div>

          <ProductGrid categoryIds={[]} searchQuery={searchQuery} />
        </section>

          </>
        )}

        {currentPage === "categories" && (
          <section className="category-browser-page">
            {!categorySlug ? (
              <>
                <div className="category-page-hero">
                  <div>
                    <p className="eyebrow">FIND YOUR NEXT FAVOURITE</p>
                    <h1>Shop by <span>department.</span></h1>
                    <p>Explore every corner of 999+ KART, from everyday essentials to your next favourite find.</p>
                  </div>
                  <div className="category-hero-orbit"><Sparkles size={34} /></div>
                </div>
                <div className="category-browser-heading">
                  <div><p className="eyebrow">ALL DEPARTMENTS</p><h2>Explore categories</h2></div>
                  <span>{mainCategories.length} departments</span>
                </div>
                <div className="department-card-grid">
                  {mainCategories.map((category, index) => {
                    const childCount = getChildren(category.id).length;
                    const Icon = categoryIcon(category.name);
                    return (
                      <button type="button" className="department-card" key={category.id} onClick={() => navigateToCategory(category)} style={{ animationDelay: `${index * 55}ms` }}>
                        <div className="department-card-image">
                          {category.image_url ? <img src={category.image_url} alt={category.name} loading="lazy" /> : <span className="department-placeholder"><Icon size={42} /></span>}
                          {category.is_featured && <span className="department-featured">FEATURED</span>}
                        </div>
                        <div className="department-card-copy">
                          <div><h3>{category.name}</h3><p>{category.description || `${childCount} collections to explore`}</p></div>
                          <span className="department-arrow"><ArrowUpRight size={18} /></span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {mainCategories.length === 0 && <div className="category-empty-state"><Sparkles size={30} /><h3>Categories are being prepared</h3><p>New collections will appear here soon.</p></div>}
              </>
            ) : activeCategory ? (
              <>
                <div className="category-breadcrumbs">
                  <Link to="/categories">All departments</Link><ChevronRight size={14} />
                  {activeCategoryParent && <><Link to={`/categories/${encodeURIComponent(activeCategoryParent.slug)}`}>{activeCategoryParent.name}</Link><ChevronRight size={14} /></>}
                  <span>{activeCategory.name}</span>
                </div>
                <div className="category-detail-hero">
                  <div className="category-detail-copy">
                    <p className="eyebrow">EXPLORE THE COLLECTION</p>
                    <h1>{activeCategory.name}</h1>
                    <p>{activeCategory.description || `Discover the latest ${activeCategory.name.toLowerCase()} collection at 999+ KART.`}</p>
                    <button type="button" className="primary-button" onClick={() => chooseCategory(activeCategory)}>SHOP {activeCategory.name.toUpperCase()} <ArrowUpRight size={17} /></button>
                  </div>
                  {activeCategory.banner_image_url || activeCategory.image_url
                    ? <img className="category-detail-image" src={activeCategory.banner_image_url || activeCategory.image_url || ""} alt={activeCategory.name} />
                    : <div className="category-detail-image category-detail-placeholder">{(() => { const Icon = categoryIcon(activeCategory.name); return <Icon size={70} />; })()}</div>}
                </div>
                <div className="category-browser-heading category-detail-heading">
                  <div><p className="eyebrow">BROWSE BY COLLECTION</p><h2>{activeCategoryChildren.length ? `Shop ${activeCategory.name}` : `Explore ${activeCategory.name}`}</h2></div>
                  <span>{activeCategoryChildren.length} collections</span>
                </div>
                {activeCategoryChildren.length > 0 ? (
                  <div className="subcategory-card-grid">
                    {activeCategoryChildren.map((child, index) => {
                      const Icon = categoryIcon(child.name);
                      const grandchildCount = getChildren(child.id).length;
                      return (
                        <button type="button" className="subcategory-card" key={child.id} onClick={() => navigateToCategory(child)} style={{ animationDelay: `${index * 45}ms` }}>
                          <div className="subcategory-card-image">
                            {child.image_url ? <img src={child.image_url} alt={child.name} loading="lazy" /> : <span className="department-placeholder"><Icon size={34} /></span>}
                          </div>
                          <div className="subcategory-card-copy"><div><strong>{child.name}</strong><span>{grandchildCount ? `${grandchildCount} subcategories` : "Explore products"}</span></div><ArrowUpRight size={17} /></div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="category-leaf-cta"><div><strong>Ready to explore?</strong><span>Browse all available products in {activeCategory.name}.</span></div><button type="button" className="primary-button" onClick={() => chooseCategory(activeCategory)}>VIEW PRODUCTS <ArrowUpRight size={16} /></button></div>
                )}
              </>
            ) : (
              <div className="category-empty-state"><h3>We couldn't find that category</h3><p>It may have been moved or is no longer available.</p><Link className="primary-button" to="/categories">Browse all categories</Link></div>
            )}
          </section>
        )}
        {currentPage === "shop" && (
        <section
          className="products section"
          id="products"
        >

          <div className="section-heading">

            <div>
              <p className="eyebrow">
                HANDPICKED FOR YOU
              </p>

              <h2>{selectedCategoryName ? `Shop ${selectedCategoryName}` : "Trending finds"}</h2>
            </div>

            <Link to="/shop" className="section-link">
              DISCOVER MORE
              <ArrowUpRight size={17} />
            </Link>

          </div>

          {selectedCategoryName && <button type="button" className="clear-category-filter" onClick={clearCategory}>Clear category filter <X size={14} /></button>}
          <ProductGrid categoryIds={selectedCategoryIds} searchQuery={searchQuery} />

        </section>

        )}


        {currentPage === "home" && (
          <section className="home-discovery-links">
            <Link to="/categories" className="discovery-tile">
              <span className="discovery-kicker">FIND YOUR NEXT FAVOURITE</span>
              <strong>Explore categories</strong>
              <span>Browse every collection <ArrowUpRight size={16} /></span>
            </Link>
            <Link to="/shop" className="discovery-tile discovery-tile-accent">
              <span className="discovery-kicker">FRESH FINDS, ALL IN ONE PLACE</span>
              <strong>Shop all products</strong>
              <span>Discover the collection <ArrowUpRight size={16} /></span>
            </Link>
            <Link to="/about" className="discovery-tile">
              <span className="discovery-kicker">GET TO KNOW US</span>
              <strong>About 999+ KART</strong>
              <span>Our story and promise <ArrowUpRight size={16} /></span>
            </Link>
          </section>
        )}

      </main>

      {/* FOOTER */}

      <footer className="footer">

        <Link className="logo" to="/">
          999<span>+</span> KART
        </Link>

        <p>
          © 2026 999+ KART. All rights reserved.
        </p>

        <p>
          Made for everyday discoveries.
        </p>

      </footer>

    </div>
  );
}

// ------------------------------------
// ADMIN LOGIN
// ------------------------------------

function AdminLoginRoute() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      setIsAdmin(
        !error && data.user?.app_metadata?.role === "admin"
      );

      setChecking(false);
    }

    checkSession();

    return () => {
      active = false;
    };
  }, []);

  if (checking) {
    return (
      <div className="product-message">
        Checking account...
      </div>
    );
  }

  return isAdmin ? (
    <Navigate to="/admin/dashboard" replace />
  ) : (
    <AdminLogin
      onLogin={() => {
        window.location.assign("/admin/dashboard");
      }}
    />
  );
}

// ------------------------------------
// MAIN APP ROUTES
// ------------------------------------

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Routes>

          {/* STOREFRONT */}

          <Route path="/" element={<Storefront />} />
          <Route path="/categories" element={<Storefront />} />
          <Route path="/categories/:slug" element={<Storefront />} />
          <Route path="/shop" element={<Storefront />} />
          <Route path="/about" element={<Storefront />} />

          {/* CUSTOMER LOGIN / REGISTER */}

          <Route
            path="/account"
            element={<CustomerAuth />}
          />

          {/* CUSTOMER SETTINGS */}

          <Route
            path="/account/settings"
            element={<CustomerSettings />}
          />

          {/* CUSTOMER PASSWORD RECOVERY */}

          <Route
            path="/account/update-password"
            element={<UpdatePassword />}
          />

          {/* CUSTOMER DASHBOARD */}

          <Route
            path="/account/dashboard"
            element={<CustomerDashboard />}
          />

          {/* CUSTOMER RETURNS & ORDERS */}
          <Route
            path="/account/returns-orders"
            element={<ReturnsOrders />}
          />

          {/* CUSTOMER NOTIFICATIONS */}
          <Route
            path="/account/notifications"
            element={<Notifications />}
          />

          {/* CUSTOMER WISHLIST, OFFERS, REWARDS AND SHOPPING TOOLS */}
          <Route path="/account/benefits" element={<GrowthHub />} />

          {/* CUSTOMER SUPPORT */}
          <Route
            path="/account/support"
            element={<CustomerSupport />}
          />

          {/* CUSTOMER ORDER DETAILS */}

          <Route
            path="/account/orders/:orderId"
            element={<OrderDetails />}
          />

          {/* ADMIN LOGIN */}

          <Route
            path="/admin"
            element={<AdminLoginRoute />}
          />

          {/* ADMIN DASHBOARD */}

          <Route
            path="/admin/dashboard"
            element={
              <ProtectedAdmin>
                <AdminDashboard />
              </ProtectedAdmin>
            }
          />

          {/* ADMIN STORE ANALYTICS */}
          <Route path="/admin/analytics" element={<ProtectedAdmin><AdminGrowthAnalytics /></ProtectedAdmin>} />

          {/* ADMIN PRODUCTS */}

          <Route
            path="/admin/products"
            element={
              <ProtectedAdmin>
                <AdminProducts />
              </ProtectedAdmin>
            }
          />

          {/* ADMIN ORDERS */}

          <Route
            path="/admin/orders"
            element={
              <ProtectedAdmin>
                <AdminOrders />
              </ProtectedAdmin>
            }
          />

          {/* ADMIN CATEGORIES */}

          <Route
            path="/admin/categories"
            element={
              <ProtectedAdmin>
                <AdminCategories />
              </ProtectedAdmin>
            }
          />

          {/* ADMIN CUSTOMERS */}

          <Route
            path="/admin/customers"
            element={
              <ProtectedAdmin>
                <AdminCustomers />
              </ProtectedAdmin>
            }
          />

          {/* ADMIN PRODUCT RETURNS */}
          <Route
            path="/admin/returns"
            element={
              <ProtectedAdmin>
                <AdminReturns />
              </ProtectedAdmin>
            }
          />

          {/* ADMIN CUSTOMER SUPPORT */}
          <Route
            path="/admin/support"
            element={
              <ProtectedAdmin>
                <AdminSupport />
              </ProtectedAdmin>
            }
          />

          {/* PRODUCT DETAILS */}

          <Route
            path="/product/:id"
            element={<ProductDetails />}
          />

          {/* SHOPPING CART */}

          <Route
            path="/cart"
            element={<CartPage />}
          />

          {/* INVALID ROUTES */}

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />

        </Routes>
      </CartProvider>
    </BrowserRouter>
  );
}
