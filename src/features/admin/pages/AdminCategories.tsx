import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Search, Plus, RefreshCw, Pencil, Trash2, X, Image as ImageIcon, Layers3, Eye, EyeOff } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import AdminLayout from "../components/AdminLayout";
import "./AdminCategories.css";

type Category = {
  id: string; name: string; slug: string; description: string | null;
  image_url: string | null; is_active: boolean; sort_order: number;
  created_at: string; parent_category_id: string | null;
};
type CategoryForm = { name: string; slug: string; description: string; image_url: string; is_active: boolean; sort_order: number; parent_category_id: string };
const emptyForm: CategoryForm = { name: "", slug: "", description: "", image_url: "", is_active: true, sort_order: 0, parent_category_id: "" };
const slugify = (value: string) => value.toLowerCase().trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);

  async function loadCategories() {
    setLoading(true); setError("");
    const { data, error: queryError } = await supabase.from("categories").select("id,name,slug,description,image_url,is_active,sort_order,created_at,parent_category_id").order("sort_order", { ascending: true }).order("name", { ascending: true });
    if (queryError) { setError(queryError.message); setCategories([]); }
    else setCategories((data || []) as Category[]);
    setLoading(false);
  }
  useEffect(() => { void loadCategories(); }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.filter((c) => !q || c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
  }, [categories, search]);
  const activeCount = categories.filter((c) => c.is_active).length;

  function openNew() { setEditing(null); setForm(emptyForm); setSlugTouched(false); setError(""); setNotice(""); setModalOpen(true); }
  function openEdit(category: Category) {
    setEditing(category);
    setForm({ name: category.name, slug: category.slug, description: category.description || "", image_url: category.image_url || "", is_active: category.is_active, sort_order: category.sort_order, parent_category_id: category.parent_category_id || "" });
    setSlugTouched(true); setError(""); setNotice(""); setModalOpen(true);
  }
  function updateName(name: string) {
    setForm((current) => ({ ...current, name, slug: slugTouched ? current.slug : slugify(name) }));
  }
  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    const payload = { name: form.name.trim(), slug: slugify(form.slug), description: form.description.trim() || null, image_url: form.image_url.trim() || null, is_active: form.is_active, sort_order: Number(form.sort_order) || 0, parent_category_id: form.parent_category_id || null, updated_at: new Date().toISOString() };
    if (!payload.name || !payload.slug) { setError("Category name and slug are required."); setSaving(false); return; }
    const query = editing
      ? supabase.from("categories").update(payload).eq("id", editing.id)
      : supabase.from("categories").insert(payload);
    const { error: saveError } = await query;
    if (saveError) { setError(saveError.code === "23505" ? "This category name or slug already exists. Choose a different one." : saveError.message); setSaving(false); return; }
    setModalOpen(false); setNotice(editing ? "Category updated successfully." : "Category created successfully."); setSaving(false); await loadCategories();
  }
  async function toggleActive(category: Category) {
    setError(""); setNotice("");
    const { error: updateError } = await supabase.from("categories").update({ is_active: !category.is_active, updated_at: new Date().toISOString() }).eq("id", category.id);
    if (updateError) { setError(updateError.message); return; }
    setNotice(`${category.name} ${category.is_active ? "hidden from" : "visible in"} the storefront.`); await loadCategories();
  }
  async function deleteCategory(category: Category) {
    if (!window.confirm(`Delete “${category.name}”? This cannot be undone.`)) return;
    setError(""); setNotice("");
    const { error: deleteError } = await supabase.from("categories").delete().eq("id", category.id);
    if (deleteError) {
      setError(deleteError.code === "23503" ? "This category is linked to products. Deactivate it instead, so product records stay safe." : deleteError.message);
      return;
    }
    setNotice("Category deleted."); await loadCategories();
  }

  return <AdminLayout title="Categories">
    <div className="admin-categories">
      <div className="acat-heading"><div><span className="acat-eyebrow">STORE CATALOGUE</span><h2>Categories</h2><p>Organise your products into clear shopping collections.</p></div><button className="acat-primary" onClick={openNew}><Plus size={17}/> Add category</button></div>
      <div className="acat-stats"><article><span className="acat-stat-icon"><Layers3/></span><div><strong>{categories.length}</strong><small>Total categories</small></div></article><article><span className="acat-stat-icon"><Eye/></span><div><strong>{activeCount}</strong><small>Active categories</small></div></article><article><span className="acat-stat-icon"><EyeOff/></span><div><strong>{categories.length - activeCount}</strong><small>Hidden categories</small></div></article></div>
      {notice && <div className="acat-notice">{notice}</div>}{error && !modalOpen && <div className="acat-error">{error}</div>}
      <section className="acat-panel"><div className="acat-toolbar"><label className="acat-search"><Search size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search categories..."/></label><button className="acat-refresh" onClick={() => void loadCategories()} disabled={loading}><RefreshCw size={16}/> Refresh</button></div>
        {loading ? <div className="acat-empty">Loading categories...</div> : visible.length === 0 ? <div className="acat-empty">{categories.length ? "No categories match your search." : "No categories yet. Add your first category to get started."}</div> : <div className="acat-grid">{visible.map((category) => <article className="acat-card" key={category.id}><div className="acat-image">{category.image_url ? <img src={category.image_url} alt={category.name} onError={(e) => { e.currentTarget.style.display = "none"; }}/> : <ImageIcon size={30}/>}<span className={category.is_active ? "is-active" : "is-hidden"}>{category.is_active ? "Active" : "Hidden"}</span></div><div className="acat-card-body"><div className="acat-card-title"><h3>{category.name}</h3><small>/{category.slug}</small></div>{category.parent_category_id && <p className="acat-parent-label">↳ {categories.find((item) => item.id === category.parent_category_id)?.name || "Parent category"}</p>}{category.description && <p>{category.description}</p>}<div className="acat-card-meta"><span>Order: {category.sort_order}</span><span>{new Date(category.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span></div><div className="acat-actions"><button onClick={() => openEdit(category)}><Pencil size={15}/> Edit</button><button onClick={() => void toggleActive(category)}>{category.is_active ? <EyeOff size={15}/> : <Eye size={15}/>} {category.is_active ? "Hide" : "Show"}</button><button className="danger" onClick={() => void deleteCategory(category)} aria-label={`Delete ${category.name}`}><Trash2 size={15}/></button></div></div></article>)}</div>}
        <footer className="acat-footer">Showing {visible.length} of {categories.length} categories</footer>
      </section>
      {modalOpen && <div className="acat-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setModalOpen(false); }}><form className="acat-modal" onSubmit={saveCategory}><header><div><span className="acat-eyebrow">CATEGORY DETAILS</span><h3>{editing ? "Edit category" : "Add new category"}</h3></div><button type="button" className="acat-close" onClick={() => setModalOpen(false)} aria-label="Close"><X/></button></header>
        {error && <div className="acat-error">{error}</div>}
        <label>Category name <b>*</b><input required maxLength={80} value={form.name} onChange={(e) => updateName(e.target.value)} placeholder="e.g. Home & Kitchen"/></label>
        <label>URL slug <b>*</b><input required maxLength={100} value={form.slug} onChange={(e) => { setSlugTouched(true); setForm((f) => ({ ...f, slug: e.target.value })); }} placeholder="home-kitchen"/><small>Used in category URLs. Spaces are converted to hyphens.</small></label>
        <label>Parent category<select value={form.parent_category_id} onChange={(e) => setForm((f) => ({ ...f, parent_category_id: e.target.value }))}><option value="">None (top-level category)</option>{categories.filter((c) => !c.parent_category_id && c.id !== editing?.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><small>Choose a parent to make this a subcategory. Leave empty for a main category.</small></label>
        <label>Description<textarea rows={3} maxLength={300} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="A short description for this category"/></label>
        <label>Image URL<input type="url" value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://example.com/category.jpg"/></label>
        {form.image_url && <div className="acat-preview"><img src={form.image_url} alt="Category preview" onError={(e) => { e.currentTarget.style.display = "none"; }}/></div>}
        <div className="acat-form-row"><label>Display order<input type="number" min="0" step="1" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}/></label><label className="acat-check"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}/> Active on storefront</label></div>
        <footer><button type="button" className="acat-cancel" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button><button type="submit" className="acat-primary" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Create category"}</button></footer>
      </form></div>}
    </div>
  </AdminLayout>;
}
