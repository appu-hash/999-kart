import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Search, Shirt, House, Headphones, Flower2, Gem, Sparkles } from "lucide-react";
import { supabase } from "../../lib/supabase";
import ProductGrid from "./ProductGrid";
import "./CategoriesPage.css";

type Category = { id: string; name: string; slug: string; description: string | null; parent_category_id: string | null; sort_order: number };

function iconFor(name: string) {
  const n = name.toLowerCase();
  if (n.includes("fashion") || n.includes("clothing") || n.includes("wear")) return Shirt;
  if (n.includes("electronic") || n.includes("mobile")) return Headphones;
  if (n.includes("home") || n.includes("decor") || n.includes("kitchen")) return House;
  if (n.includes("beauty") || n.includes("skin")) return Flower2;
  if (n.includes("jewel") || n.includes("watch")) return Gem;
  return Sparkles;
}

export default function CategoriesPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase.from("categories")
        .select("id,name,slug,description,parent_category_id,sort_order")
        .eq("is_active", true).order("sort_order", { ascending: true }).order("name", { ascending: true });
      if (!active) return;
      if (error) setError("Unable to load categories. Please try again.");
      else {
        const rows = (data ?? []) as Category[];
        setCategories(rows);
        const current = rows.find((item) => item.slug === slug);
        if (current?.parent_category_id) setSelectedSubcategory(current.id);
      }
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [slug]);

  const mainCategories = categories.filter((item) => !item.parent_category_id);
  const activeCategory = categories.find((item) => item.slug === slug) ?? null;
  const parentCategory = activeCategory?.parent_category_id
    ? categories.find((item) => item.id === activeCategory.parent_category_id) ?? null
    : activeCategory;
  const childCategories = useMemo(
    () => categories.filter((item) => item.parent_category_id === parentCategory?.id),
    [categories, parentCategory?.id]
  );
  const isDetail = Boolean(slug);
  const productCategoryIds = selectedSubcategory
    ? [selectedSubcategory]
    : activeCategory
      ? activeCategory.parent_category_id
        ? [activeCategory.id]
        : [activeCategory.id, ...childCategories.map((item) => item.id)]
      : [];

  if (loading) return <div className="category-page-message">Loading categories...</div>;
  if (error) return <div className="category-page-message">{error}</div>;

  return (
    <div className="category-page">
      <header className="category-page-header">
        <Link to="/" className="category-brand">999<span>+</span> KART</Link>
        <Link to="/" className="category-back"><ArrowLeft size={16} /> Back to home</Link>
      </header>

      <main className="category-page-main">
        <div className="category-breadcrumb"><Link to="/">Home</Link><span>/</span><span>{isDetail ? parentCategory?.name ?? activeCategory?.name ?? "Category" : "Categories"}</span></div>

        {!isDetail ? (
          <>
            <div className="category-page-title">
              <p>FIND YOUR NEXT FAVOURITE</p>
              <h1>Explore categories</h1>
              <span>Browse all collections and discover something new.</span>
            </div>
            <div className="category-page-grid">
              {mainCategories.map((category) => {
                const Icon = iconFor(category.name);
                const count = categories.filter((child) => child.parent_category_id === category.id).length;
                return <button type="button" className="category-page-card" key={category.id} onClick={() => navigate(`/categories/${category.slug}`)}>
                  <span className="category-page-icon"><Icon size={25} /></span>
                  <strong>{category.name}</strong>
                  <small>{count} {count === 1 ? "collection" : "collections"}</small>
                  <ArrowUpRight className="category-card-arrow" size={17} />
                </button>;
              })}
            </div>
          </>
        ) : activeCategory ? (
          <>
            <div className="category-page-title">
              <p>999+ KART COLLECTION</p>
              <h1>{parentCategory?.name ?? activeCategory.name}</h1>
              <span>{activeCategory.description || "Explore this collection and find products picked for everyday life."}</span>
            </div>
            {childCategories.length > 0 && (
              <div className="subcategory-block">
                <h2>Shop by subcategory</h2>
                <div className="subcategory-list">
                  <button type="button" className={!selectedSubcategory ? "subcategory-chip active" : "subcategory-chip"} onClick={() => setSelectedSubcategory("")}>All {parentCategory?.name}</button>
                  {childCategories.map((child) => (
                    <button type="button" className={selectedSubcategory === child.id ? "subcategory-chip active" : "subcategory-chip"} key={child.id} onClick={() => setSelectedSubcategory(child.id)}>{child.name}</button>
                  ))}
                </div>
              </div>
            )}
            <section className="category-products">
              <div className="category-products-heading"><div><p>DISCOVER THE COLLECTION</p><h2>{selectedSubcategory ? childCategories.find((item) => item.id === selectedSubcategory)?.name : activeCategory.parent_category_id ? activeCategory.name : "All products"}</h2></div><span>Browse available products</span></div>
              <ProductGrid categoryIds={productCategoryIds} />
            </section>
          </>
        ) : (
          <div className="category-page-message">This category could not be found. <Link to="/categories">Browse all categories</Link></div>
        )}
      </main>
      <footer className="category-page-footer">© 2026 999+ KART. All rights reserved.</footer>
    </div>
  );
}
