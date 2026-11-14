import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, ArrowUpRight, Clock3 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "./StoreSearch.css";

type ProductSuggestion = { id: string; name: string; image_url: string | null; selling_price: number };
type CategorySuggestion = { id: string; name: string; slug: string };

export default function StoreSearch() {
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ProductSuggestion[]>([]);
  const [categories, setCategories] = useState<CategorySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("999kart_recent_searches") || "[]");
      if (Array.isArray(saved)) setRecent(saved.filter((v): v is string => typeof v === "string").slice(0, 5));
    } catch { setRecent([]); }
    const close = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    let active = true;
    const term = query.trim();
    if (term.length < 2) {
      setProducts([]);
      setCategories([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const [productResult, categoryResult] = await Promise.all([
        supabase.from("products").select("id,name,image_url,selling_price").eq("is_active", true).ilike("name", `%${term}%`).order("created_at", { ascending: false }).limit(5),
        supabase.from("categories").select("id,name,slug").eq("is_active", true).ilike("name", `%${term}%`).limit(4),
      ]);
      if (!active) return;
      setProducts(productResult.data ?? []);
      setCategories(categoryResult.data ?? []);
      setLoading(false);
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  function rememberSearch(term: string) {
    const next = [term, ...recent.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, 5);
    setRecent(next);
    try { localStorage.setItem("999kart_recent_searches", JSON.stringify(next)); } catch { /* storage may be unavailable */ }
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const term = query.trim();
    if (!term) return;
    rememberSearch(term);
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(term)}`);
  }

  const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

  return (
    <div className="store-search-wrap" ref={wrapperRef}>
      <form className="store-search" role="search" onSubmit={submit}>
        <span className="store-search-all">All</span>
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
          placeholder="Search 999+ KART"
          aria-label="Search products and categories"
        />
        {query && <button className="store-search-clear" type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={15} /></button>}
        <button className="store-search-submit" type="submit" aria-label="Search"><Search size={20} /></button>
      </form>

      {open && (
        <div className="store-search-panel">
          {query.trim().length < 2 ? (
            <div className="search-panel-section">
              <div className="search-panel-heading"><Clock3 size={15} /> Recent searches</div>
              {recent.length ? recent.map((term) => (
                <button type="button" className="search-recent-item" key={term} onClick={() => { setQuery(term); rememberSearch(term); setOpen(false); navigate(`/search?q=${encodeURIComponent(term)}`); }}>
                  <span>{term}</span><ArrowUpRight size={14} />
                </button>
              )) : <p className="search-panel-empty">Start typing to find products and categories.</p>}
            </div>
          ) : loading ? <p className="search-panel-empty">Searching...</p> : (
            <>
              {categories.length > 0 && <div className="search-panel-section">
                <div className="search-panel-heading">CATEGORIES</div>
                {categories.map((category) => (
                  <button type="button" className="search-category-item" key={category.id} onClick={() => { setOpen(false); navigate(`/categories/${category.slug}`); }}>
                    <span>{category.name}</span><ArrowUpRight size={14} />
                  </button>
                ))}
              </div>}
              {products.length > 0 && <div className="search-panel-section">
                <div className="search-panel-heading">PRODUCTS</div>
                {products.map((product) => (
                  <button type="button" className="search-product-item" key={product.id} onClick={() => { rememberSearch(query.trim()); setOpen(false); navigate(`/product/${product.id}`); }}>
                    {product.image_url ? <img src={product.image_url} alt="" /> : <span className="search-product-placeholder">999+</span>}
                    <span className="search-product-name">{product.name}<small>{money(product.selling_price)}</small></span>
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </div>}
              {!products.length && !categories.length && <p className="search-panel-empty">No matches yet. Press Enter to see search results.</p>}
              <button type="button" className="search-all-results" onClick={() => submit()}>See all results for “{query.trim()}” <ArrowUpRight size={15} /></button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
