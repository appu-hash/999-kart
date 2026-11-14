import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useCart } from "../cart/CartContext";
import "./ProductDetails.css";

interface Product { id: string; name: string; description: string | null; short_description: string | null; selling_price: number; compare_at_price: number | null; image_url: string | null; }
export default function ProductDetails() {
  const { id } = useParams(); const navigate = useNavigate(); const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1); const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function loadProduct() {
      if (!id) { setError("Product not found."); setLoading(false); return; }
      const { data, error } = await supabase.from("products").select("id, name, description, short_description, selling_price, compare_at_price, image_url").eq("id", id).eq("is_active", true).maybeSingle();
      if (!active) return;
      if (error) { console.error(error); setError("Unable to load this product."); }
      else if (!data) setError("This product is unavailable.");
      else {
        setProduct(data);
        try {
          const oldIds = JSON.parse(localStorage.getItem("999kart_recently_viewed") || "[]");
          const safeIds = Array.isArray(oldIds) ? oldIds.filter((value): value is string => typeof value === "string") : [];
          localStorage.setItem("999kart_recently_viewed", JSON.stringify([data.id, ...safeIds.filter((value) => value !== data.id)].slice(0, 8)));
        } catch (storageError) { console.warn("Could not save recently viewed history:", storageError); }
      }
      setLoading(false);
    }
    loadProduct(); return () => { active = false; };
  }, [id]);
  const formatPrice = (price: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(price);
  if (loading) return <div className="details-message">Loading product...</div>;
  if (error || !product) return <div className="details-message"><h2>{error || "Product not found."}</h2><button onClick={() => navigate("/")}>Back to shop</button></div>;
  const original = product.compare_at_price; const hasDiscount = original !== null && original > product.selling_price;
  const discount = hasDiscount ? Math.round(((original - product.selling_price) / original) * 100) : 0;
  return <div className="product-details-page">
    <header className="details-header"><button onClick={() => navigate(-1)}>← Back</button><a href="/" className="details-logo">999<span>+</span> KART</a></header>
    <main className="details-container"><div className="details-image">
      {hasDiscount && <span className="details-discount">{discount}% OFF</span>}
      {product.image_url ? <img src={product.image_url} alt={product.name} /> : <div className="details-no-image">999+ KART</div>}
    </div><div className="details-information"><p className="details-eyebrow">999+ KART COLLECTION</p><h1>{product.name}</h1>
      {product.short_description && <p className="details-short-description">{product.short_description}</p>}
      <div className="details-prices"><strong>{formatPrice(product.selling_price)}</strong>{hasDiscount && <span className="details-original-price">{formatPrice(original)}</span>}</div>
      {hasDiscount && <p className="details-saving">You save {formatPrice(original - product.selling_price)} ({discount}% OFF)</p>}
      <div className="details-divider" /><h3>Product description</h3><p className="details-description">{product.description || product.short_description || "Discover this product from 999+ KART."}</p>
      <div className="details-delivery"><p>✓ Cash on Delivery available</p><p>✓ Carefully selected products</p><p>✓ Customer support available</p></div>
      <div className="details-quantity"><span>Quantity</span><div><button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button><strong>{quantity}</strong><button type="button" onClick={() => setQuantity((q) => q + 1)}>+</button></div></div>
      <button type="button" className="details-shop-button" onClick={() => { for (let i = 0; i < quantity; i++) addToCart({ id: product.id, name: product.name, selling_price: product.selling_price, image_url: product.image_url }); navigate("/cart"); }}>ADD TO CART</button>
      <button type="button" className="details-continue-button" onClick={() => navigate("/")}>CONTINUE SHOPPING</button>
    </div></main><footer className="details-footer">© 2026 999+ KART. All rights reserved.</footer>
  </div>;
}
