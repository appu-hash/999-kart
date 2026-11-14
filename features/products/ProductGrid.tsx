import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useCart } from "../cart/CartContext";
import "./ProductGrid.css";

interface Product {
  id: string; name: string; short_description: string | null;
  selling_price: number; compare_at_price: number | null; image_url: string | null;
}
interface ProductGridProps { categoryIds?: string[]; searchQuery?: string; }

export default function ProductGrid({ categoryIds = [], searchQuery = "" }: ProductGridProps) {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    async function loadProducts() {
      setLoading(true); setError("");
      try {
        let query = supabase.from("products").select("id, name, short_description, selling_price, compare_at_price, image_url")
          .eq("is_active", true).order("created_at", { ascending: false });
        if (categoryIds.length) query = query.in("category_id", categoryIds);
        const term = searchQuery.trim();
        if (term) { const safeTerm = term.replace(/[%_]/g, "\\$&"); query = query.or(`name.ilike.%${safeTerm}%,short_description.ilike.%${safeTerm}%`); }
        const { data, error } = await query;
        if (error) throw error;
        if (isMounted) setProducts(data ?? []);
      } catch (err) {
        console.error("Product loading error:", err);
        if (isMounted) setError("Unable to load products. Please try again later.");
      } finally { if (isMounted) setLoading(false); }
    }
    loadProducts();
    return () => { isMounted = false; };
  }, [categoryIds.join(","), searchQuery]);

  const formatPrice = (price: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(price);
  const openProduct = (productId: string) => navigate(`/product/${productId}`);
  if (loading) return <div className="product-loading">Loading products...</div>;
  if (error) return <div className="product-error">{error}</div>;
  if (products.length === 0) return <div className="product-empty"><h3>{searchQuery ? "No matching products found" : "New discoveries coming soon!"}</h3><p>{searchQuery ? "Try another product name or category." : "We're preparing something special for you."}</p></div>;

  return <section className="product-grid-section"><div className="product-grid">
    {products.map((product) => {
      const original = product.compare_at_price;
      const hasDiscount = original !== null && original > product.selling_price && original > 0;
      const discount = hasDiscount ? Math.round(((original - product.selling_price) / original) * 100) : 0;
      return <article className="store-product-card" key={product.id}>
        <div className="store-product-image" onClick={() => openProduct(product.id)} role="button" tabIndex={0}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openProduct(product.id); } }} aria-label={`View ${product.name}`}>
          {hasDiscount && <span className="product-discount">{discount}% OFF</span>}
          {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" /> : <div className="product-no-image">999+ KART</div>}
        </div>
        <div className="store-product-info"><h3>{product.name}</h3>
          {product.short_description && <p>{product.short_description}</p>}
          <div className="store-product-prices"><strong>{formatPrice(product.selling_price)}</strong>{hasDiscount && <span className="product-original-price">{formatPrice(original)}</span>}</div>
          {hasDiscount && <span className="product-savings">You save {formatPrice(original - product.selling_price)}</span>}
          <button type="button" className="product-buy-button" onClick={() => addToCart({ id: product.id, name: product.name, selling_price: product.selling_price, image_url: product.image_url })}>ADD TO CART</button>
          <button type="button" className="product-view-button" onClick={() => openProduct(product.id)}>VIEW PRODUCT</button>
        </div>
      </article>;
    })}
  </div></section>;
}
