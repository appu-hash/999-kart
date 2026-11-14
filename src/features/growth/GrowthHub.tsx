import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Heart, Gift, TicketPercent, Users, Sparkles, Scale, Trash2, Search, Copy } from "lucide-react";
import "./GrowthHub.css";

type Product = { id: string; name: string; selling_price: number; image_url: string | null; short_description?: string | null };
type Coupon = { id: string; code: string; title: string; description: string | null; discount_type: string; discount_value: number; minimum_order_value: number; maximum_discount: number | null; expires_at: string | null };
type Tab = "wishlist" | "offers" | "rewards" | "compare" | "referrals" | "assistant";
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const safeIds = (key: string): string[] => { try { const v = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 20) : []; } catch { return []; } };

export default function GrowthHub() {
  const [tab, setTab] = useState<Tab>("wishlist");
  const [userId, setUserId] = useState("");
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>(safeIds("999kart_compare"));
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [compare, setCompare] = useState<Product[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [points, setPoints] = useState(0);
  const [referralCode, setReferralCode] = useState("");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("Tell me what you are shopping for, your budget, or a product category.");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      if (!data.user) { setNotice("Sign in to sync wishlist, rewards and referral details."); return; }
      setUserId(data.user.id);
      const [w, c, p, r] = await Promise.all([
        supabase.from("wishlists").select("product_id").eq("user_id", data.user.id),
        supabase.from("coupons").select("id,code,title,description,discount_type,discount_value,minimum_order_value,maximum_discount,expires_at").eq("is_active", true).order("created_at", { ascending: false }),
        supabase.from("loyalty_transactions").select("points").eq("user_id", data.user.id),
        supabase.from("customer_referrals").select("referral_code").eq("referrer_id", data.user.id).maybeSingle(),
      ]);
      if (!alive) return;
      const ids = (w.data || []).map((x: any) => x.product_id as string);
      setWishlistIds(ids);
      setCoupons((c.data || []) as Coupon[]);
      setPoints((p.data || []).reduce((sum: number, row: any) => sum + Number(row.points || 0), 0));
      setReferralCode(r.data?.referral_code || "");
      const allIds = [...new Set([...ids, ...compareIds])];
      if (allIds.length) {
        const { data: rows } = await supabase.from("products").select("id,name,selling_price,image_url,short_description").in("id", allIds);
        if (alive) { const list = (rows || []) as Product[]; setProducts(list); setWishlist(list.filter(x => ids.includes(x.id))); setCompare(list.filter(x => compareIds.includes(x.id))); }
      }
    })();
    return () => { alive = false; };
  }, []);

  async function addWishlist(productId: string) {
    if (!userId) { setNotice("Please sign in first."); return; }
    const exists = wishlistIds.includes(productId);
    const result = exists
      ? await supabase.from("wishlists").delete().eq("user_id", userId).eq("product_id", productId)
      : await supabase.from("wishlists").insert({ user_id: userId, product_id: productId });
    if (result.error) { setNotice(result.error.message); return; }
    const next = exists ? wishlistIds.filter(x => x !== productId) : [...wishlistIds, productId];
    setWishlistIds(next); setWishlist(products.filter(x => next.includes(x.id))); setNotice(exists ? "Removed from wishlist." : "Saved to wishlist.");
  }
  async function findProducts() {
    setBusy(true); setNotice("");
    const { data, error } = await supabase.from("products").select("id,name,selling_price,image_url,short_description").eq("is_active", true).ilike("name", `%${search.trim()}%`).limit(12);
    setBusy(false); if (error) { setNotice(error.message); return; } setProducts(data as Product[] || []);
  }
  function toggleCompare(p: Product) {
    const next = compareIds.includes(p.id) ? compareIds.filter(x => x !== p.id) : [...compareIds, p.id].slice(-4);
    setCompareIds(next); localStorage.setItem("999kart_compare", JSON.stringify(next)); setCompare(products.filter(x => next.includes(x.id)).concat(p).filter((x, i, a) => next.includes(x.id) && a.findIndex(y => y.id === x.id) === i));
  }
  async function askAssistant() {
    const q = question.trim(); if (!q) return;
    setBusy(true); setAnswer("Searching the current catalogue...");
    const number = q.match(/(?:under|below|less than|upto|up to)\s*₹?\s*(\d+)/i);
    const { data, error } = await supabase.from("products").select("id,name,selling_price,short_description").eq("is_active", true).order("selling_price", { ascending: true }).limit(60);
    setBusy(false);
    if (error) { setAnswer("I couldn't reach the product catalogue. Please try again shortly."); return; }
    const terms = q.toLowerCase().split(/\W+/).filter(x => x.length > 2 && !["show","find","suggest","under","below","with","for","the","and","best","good","want","need"].includes(x));
    const matches = (data || []).filter((p: any) => (!number || Number(p.selling_price) <= Number(number[1])) && (!terms.length || terms.some(t => p.name.toLowerCase().includes(t) || (p.short_description || "").toLowerCase().includes(t)))).slice(0, 5);
    setAnswer(matches.length ? `Here are catalogue matches${number ? ` under ${money(Number(number[1]))}` : ""}:\n` + matches.map((p: any) => `• ${p.name} · ${money(Number(p.selling_price))}`).join("\n") : "I couldn't find a close match. Try a category or a different budget. I can only recommend products currently listed in the 999+ KART catalogue.");
  }
  const tabs: { id: Tab; label: string; icon: any }[] = [{id:"wishlist",label:"Wishlist",icon:Heart},{id:"offers",label:"Offers",icon:TicketPercent},{id:"rewards",label:"Rewards",icon:Gift},{id:"compare",label:"Compare",icon:Scale},{id:"referrals",label:"Refer & earn",icon:Users},{id:"assistant",label:"AI assistant",icon:Sparkles}];
  const availableProducts = useMemo(() => products.filter(p => !wishlistIds.includes(p.id)), [products, wishlistIds]);
  return <main className="growth-page"><header className="growth-head"><div><span className="growth-eyebrow">999+ KART CUSTOMER CLUB</span><h1>Shopping, with extra perks.</h1><p>Save favourites, unlock offers and get more from every order.</p></div><Link to="/shop" className="growth-shop-link">Explore products</Link></header>
    {notice && <p className="growth-notice">{notice}</p>}
    <nav className="growth-tabs">{tabs.map(t => <button key={t.id} className={tab===t.id?"active":""} onClick={()=>setTab(t.id)}><t.icon size={17}/>{t.label}</button>)}</nav>
    {tab === "wishlist" && <section className="growth-panel"><h2><Heart/> Your wishlist</h2>{wishlist.length ? <div className="growth-grid">{wishlist.map(p=><article className="growth-product" key={p.id}>{p.image_url && <img src={p.image_url} alt={p.name}/>}<b>{p.name}</b><strong>{money(Number(p.selling_price))}</strong><div><Link to={`/product/${p.id}`}>View product</Link><button onClick={()=>addWishlist(p.id)}><Trash2 size={15}/> Remove</button></div></article>)}</div> : <p>Your wishlist is waiting for its first favourite.</p>}
      <div className="growth-search"><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&findProducts()} placeholder="Find a product to save"/><button onClick={findProducts} disabled={busy}><Search size={16}/> Search</button></div><div className="growth-inline-results">{availableProducts.slice(0,8).map(p=><button key={p.id} onClick={()=>addWishlist(p.id)}>♡ {p.name} · {money(Number(p.selling_price))}</button>)}</div></section>}
    {tab === "offers" && <section className="growth-panel"><h2><TicketPercent/> Available offers</h2>{coupons.length ? <div className="growth-coupons">{coupons.map(c=><article key={c.id}><div><b>{c.title}</b><p>{c.description || "Use this offer at checkout."}</p><small>Minimum order {money(Number(c.minimum_order_value))}{c.expires_at?` · Expires ${new Date(c.expires_at).toLocaleDateString("en-IN")}`:""}</small></div><div className="growth-coupon-code"><strong>{c.code}</strong><button onClick={()=>{void navigator.clipboard?.writeText(c.code);setNotice(`Coupon ${c.code} copied.`)}}><Copy size={14}/> Copy</button></div></article>)}</div> : <p>No active offers right now. Check back soon.</p>}<p className="growth-muted">Coupon eligibility and final discount are validated securely during checkout. Do not rely on browser-side price calculations.</p></section>}
    {tab === "rewards" && <section className="growth-panel"><h2><Gift/> Rewards wallet</h2><div className="growth-points"><strong>{points.toLocaleString("en-IN")}</strong><span>available points</span></div><p>Earn points on qualifying delivered orders. Rewards are subject to the store's loyalty rules.</p></section>}
    {tab === "compare" && <section className="growth-panel"><h2><Scale/> Product comparison</h2><p className="growth-muted">Compare up to four products. Add products from search below.</p><div className="growth-grid">{compare.map(p=><article className="growth-product" key={p.id}>{p.image_url&&<img src={p.image_url} alt={p.name}/>}<b>{p.name}</b><strong>{money(Number(p.selling_price))}</strong><p>{p.short_description}</p><button onClick={()=>toggleCompare(p)}><Trash2 size={15}/> Remove</button></article>)}</div><div className="growth-search"><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&findProducts()} placeholder="Search products to compare"/><button onClick={findProducts}><Search size={16}/> Search</button></div><div className="growth-inline-results">{products.filter(p=>!compareIds.includes(p.id)).slice(0,8).map(p=><button key={p.id} onClick={()=>toggleCompare(p)}>＋ {p.name} · {money(Number(p.selling_price))}</button>)}</div></section>}
    {tab === "referrals" && <section className="growth-panel"><h2><Users/> Refer a friend</h2>{referralCode ? <><p>Your referral code</p><div className="growth-refcode"><strong>{referralCode}</strong><button onClick={()=>{void navigator.clipboard?.writeText(referralCode);setNotice("Referral code copied.")}}><Copy size={15}/> Copy</button></div></> : <p>Referral rewards are not configured for your account yet. Your unique code will appear here when the referral programme is enabled.</p>}</section>}
    {tab === "assistant" && <section className="growth-panel"><h2><Sparkles/> 999+ KART shopping assistant</h2><p>Ask for product ideas by keyword or budget. Recommendations are based on active products in our catalogue.</p><div className="growth-assistant-answer">{answer}</div><div className="growth-search"><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>e.key==="Enter"&&askAssistant()} placeholder="e.g. Suggest something under ₹999"/><button disabled={busy} onClick={askAssistant}>Ask <Sparkles size={15}/></button></div><small className="growth-muted">This catalogue assistant is not a generative AI service and does not make claims beyond product data.</small></section>}
  </main>;
}
