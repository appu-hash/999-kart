
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../../lib/supabase";
import "./AdminProducts.css";

interface Product {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  sku: string | null;
  short_description: string | null;
  description: string | null;
  selling_price: number;
  compare_at_price: number | null;
  image_url: string | null;
  is_active: boolean;
  track_inventory: boolean;
  stock_quantity: number;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  parent_category_id?: string | null;
}

interface CategorySuggestion {
  category: Category | null;
  confidence: number;
  reason: string;
}

// Keyword rules provide the first, local layer of hybrid categorization.
// AI fallback will be added in the next implementation step.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  fashion: ["fashion", "clothing", "clothes", "dress", "kurti", "saree", "shirt", "tshirt", "t-shirt", "top", "jeans", "trouser", "legging", "wear", "outfit", "ethnic", "western", "women", "men"],
  "women's clothing": ["women", "woman", "kurti", "kurta", "top", "dress", "saree", "salwar", "leggings", "gown", "blouse", "co-ord", "coord set"],
  "men's clothing": ["men", "man", "shirt", "tshirt", "t-shirt", "jeans", "trouser", "track pant", "shorts", "kurta"],
  "ethnic wear": ["ethnic", "saree", "salwar", "kurta", "lehenga", "dupatta", "anarkali", "traditional"],
  "western wear": ["western", "crop top", "gown", "jumpsuit", "jeans", "top", "skirt", "dress"],
  "kids' clothing": ["kids clothing", "baby dress", "children clothing", "boys clothing", "girls clothing"],
  "innerwear & sleepwear": ["innerwear", "bra", "brief", "nightwear", "night suit", "sleepwear", "pajama"],
  electronics: ["electronic", "phone", "mobile", "charger", "cable", "earphone", "headphone", "speaker", "bluetooth", "power bank", "keyboard", "mouse", "gadget", "led"],
  "mobile phones & accessories": ["mobile", "phone case", "phone cover", "screen guard", "tempered glass", "mobile stand", "phone holder"],
  "audio & headphones": ["earphone", "earbud", "headphone", "neckband", "speaker", "wireless audio"],
  "computer accessories": ["keyboard", "mouse", "laptop stand", "webcam", "usb hub", "mouse pad"],
  "smart devices": ["smartwatch", "smart watch", "fitness band", "smart bulb", "smart device"],
  "cables & chargers": ["charger", "charging cable", "usb cable", "type c", "power bank", "adapter"],
  "home & living": ["home", "living", "bedsheet", "pillow", "curtain", "storage", "organizer", "organiser", "cleaning", "furniture"],
  bedding: ["bedsheet", "bed sheet", "pillow", "pillow cover", "blanket", "comforter", "mattress protector"],
  "storage & organisation": ["storage", "organizer", "organiser", "rack", "drawer", "storage box", "shelf"],
  "cleaning supplies": ["cleaning", "mop", "broom", "scrub", "brush", "dustpan", "cleaner"],
  "furniture & utility": ["stool", "table", "folding chair", "shoe rack", "utility stand"],
  "kitchen & dining": ["kitchen", "cookware", "dinnerware", "cooking", "utensil", "bottle", "flask", "lunch box"],
  cookware: ["cookware", "pan", "kadai", "pressure cooker", "tawa", "pot", "frying pan"],
  "kitchen tools": ["chopper", "peeler", "grater", "knife", "spatula", "strainer", "kitchen tool"],
  dinnerware: ["plate", "bowl", "cup", "mug", "dinner set", "serving set"],
  "water bottles & flasks": ["water bottle", "bottle", "flask", "thermos", "sipper"],
  "beauty & personal care": ["beauty", "skincare", "skin care", "serum", "cream", "makeup", "cosmetic", "lipstick", "face wash", "shampoo", "hair oil", "lotion", "perfume", "nail"],
  skincare: ["skincare", "skin care", "face wash", "serum", "moisturizer", "moisturiser", "sunscreen", "toner"],
  makeup: ["makeup", "lipstick", "foundation", "concealer", "eyeliner", "mascara", "compact", "blush"],
  "hair care": ["shampoo", "conditioner", "hair oil", "hair serum", "hair brush", "hair dryer"],
  fragrances: ["perfume", "body spray", "deodorant", "fragrance", "attar"],
  "bags & accessories": ["bag", "handbag", "sling", "wallet", "belt", "backpack", "purse", "tote"],
  "handbags & sling bags": ["handbag", "sling bag", "tote bag", "shoulder bag", "purse"],
  backpacks: ["backpack", "school bag", "laptop bag", "rucksack"],
  "wallets & belts": ["wallet", "card holder", "belt", "purse"],
  footwear: ["footwear", "shoes", "shoe", "sandal", "slipper", "sneaker", "heels", "loafers"],
  "women's footwear": ["women shoes", "women sandals", "ladies sandals", "heels", "flats", "women slippers"],
  "men's footwear": ["men shoes", "men sandals", "men slippers", "loafers", "men sneakers"],
  "kids' footwear": ["kids shoes", "baby shoes", "children sandals"],
  jewellery: ["jewellery", "jewelry", "necklace", "earring", "bracelet", "bangle", "chain", "pendant", "ring"],
  earrings: ["earring", "studs", "jhumka", "hoop earrings"],
  "necklaces & chains": ["necklace", "chain", "pendant", "mangalsutra"],
  "bracelets & bangles": ["bracelet", "bangle", "kada"],
  watches: ["watch", "wristwatch", "analog watch", "digital watch"],
  "kids & baby products": ["baby", "infant", "toddler", "kids product", "feeding bottle"],
  "baby care": ["baby care", "diaper", "wipes", "baby lotion", "baby shampoo"],
  "feeding & nursing": ["feeding bottle", "nursing", "breast pump", "baby feeder", "sipper cup"],
  "kids' accessories": ["kids accessory", "hair clips", "school accessory", "kids cap"],
  "toys & games": ["toy", "toys", "game", "puzzle", "board game", "soft toy", "doll"],
  "educational toys": ["educational toy", "learning toy", "alphabet", "abacus", "building blocks"],
  "soft toys": ["soft toy", "teddy", "plush", "stuffed toy"],
  "board games & puzzles": ["board game", "puzzle", "chess", "ludo", "carrom"],
  "sports & fitness": ["sports", "fitness", "gym", "workout", "yoga", "exercise", "dumbbell"],
  "fitness accessories": ["dumbbell", "resistance band", "skipping rope", "gym gloves", "exercise mat"],
  "yoga accessories": ["yoga mat", "yoga block", "yoga strap"],
  "outdoor sports": ["football", "cricket", "badminton", "basketball", "cycling"],
  "travel & luggage": ["travel bag", "luggage", "suitcase", "duffel", "travel organiser", "passport holder"],
  "travel bags": ["duffel bag", "travel bag", "trolley bag", "suitcase", "weekender bag"],
  "luggage accessories": ["luggage tag", "packing cube", "passport cover", "travel pouch"],
  "automotive accessories": ["car accessory", "bike accessory", "car cover", "bike cover", "vehicle"],
  "car accessories": ["car phone holder", "car charger", "car mat", "car cover", "car organiser"],
  "bike accessories": ["bike cover", "helmet", "bike phone holder", "bike gloves"],
  "books & stationery": ["book", "notebook", "diary", "pen", "pencil", "stationery", "office supplies"],
  "notebooks & diaries": ["notebook", "diary", "journal", "planner"],
  "writing supplies": ["pen", "pencil", "marker", "highlighter", "crayon"],
  "office supplies": ["stapler", "tape", "file folder", "desk organiser", "office supplies"],
  "pet supplies": ["pet", "dog", "cat", "pet food", "pet toy", "pet collar"],
  "pet accessories": ["pet collar", "leash", "pet toy", "pet bowl", "pet bed"],
  "pet grooming": ["pet grooming", "pet brush", "pet shampoo", "pet comb"],
  "home decor": ["home decor", "wall decor", "showpiece", "vase", "wall art", "decorative"],
  "wall decor": ["wall art", "wall hanging", "wall sticker", "wall clock"],
  lighting: ["lamp", "led light", "night light", "string light", "decor light"],
  "decorative accessories": ["showpiece", "vase", "figurine", "decor tray", "table decor"],
  "gifts & occasions": ["gift", "gift set", "birthday", "anniversary", "party decoration", "return gift"],
  "gift sets": ["gift set", "gift hamper", "combo gift", "gift box"],
  "party supplies": ["balloon", "party decoration", "birthday banner", "confetti", "party supplies"]
};

function getCategorySuggestion(
  text: string,
  availableCategories: Category[]
): CategorySuggestion {
  const normalizedText = text.toLowerCase().replace(/[^a-z0-9&\s-]/g, " ");
  if (!normalizedText.trim() || availableCategories.length === 0) {
    return { category: null, confidence: 0, reason: "Add categories and product details to get a suggestion." };
  }

  const ranked = availableCategories.map((category) => {
    const categoryKey = category.name.toLowerCase().trim();
    const keywords = [
      ...(CATEGORY_KEYWORDS[categoryKey] ?? []),
      ...Object.entries(CATEGORY_KEYWORDS)
        .filter(([key]) => categoryKey.includes(key) || key.includes(categoryKey))
        .flatMap(([, values]) => values),
      categoryKey
    ];
    const matches = [...new Set(keywords)].filter((keyword) =>
      keyword.trim() && normalizedText.includes(keyword.toLowerCase().trim())
    );
    return { category, matches, score: matches.reduce((total, word) => total + (word.includes(" ") ? 2 : 1), 0) };
  }).sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score === 0) {
    return { category: null, confidence: 0, reason: "No clear keyword match. Choose a category manually." };
  }

  const secondScore = ranked[1]?.score ?? 0;
  const confidence = Math.min(0.96, 0.55 + best.score * 0.12 - (secondScore > 0 ? 0.08 : 0));
  return {
    category: best.category,
    confidence,
    reason: `Matched keywords: ${best.matches.slice(0, 4).join(", ")}`
  };
}

const initialForm = {
  name: "",
  category_id: "",
  sku: "",
  short_description: "",
  description: "",
  selling_price: "",
  compare_at_price: "",
  stock_quantity: "0",
  track_inventory: false,
  is_active: false,
};

function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImage, setExistingImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categorySuggestion, setCategorySuggestion] = useState<CategorySuggestion>({
    category: null,
    confidence: 0,
    reason: "Enter product details to receive a category suggestion."
  });
  const [categoryManuallySelected, setCategoryManuallySelected] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    const [productsResult, categoriesResult] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("categories")
        .select("id, name")
        .order("name"),
    ]);

    if (productsResult.error) {
      setError(productsResult.error.message);
    } else {
      setProducts(productsResult.data ?? []);
    }

    if (categoriesResult.error) {
      setError(
        (previous) =>
          previous
            ? `${previous} | Categories: ${categoriesResult.error!.message}`
            : `Categories: ${categoriesResult.error!.message}`
      );
    } else {
      const loadedCategories = categoriesResult.data ?? [];
      setCategories(loadedCategories);
      setCategorySuggestion((current) =>
        current.category || !form.name.trim()
          ? current
          : getCategorySuggestion(`${form.name} ${form.short_description} ${form.description}`, loadedCategories)
      );
    }

    setLoading(false);
  }

  function updateForm(
    field: keyof typeof initialForm,
    value: string | boolean
  ) {
    setForm((previous) => {
      const next = { ...previous, [field]: value };
      if (field === "name" || field === "short_description" || field === "description") {
        const productText = `${next.name} ${next.short_description} ${next.description}`;
        const suggestion = getCategorySuggestion(productText, categories);
        setCategorySuggestion(suggestion);
        if (!categoryManuallySelected && suggestion.category && suggestion.confidence >= 0.67) {
          next.category_id = suggestion.category.id;
        }
      }
      return next;
    });
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setImageFile(null);
    setExistingImage("");
    setCategoryManuallySelected(false);
    setCategorySuggestion({
      category: null,
      confidence: 0,
      reason: "Enter product details to receive a category suggestion."
    });
    setMessage("");
    setError("");

    const fileInput = document.getElementById(
      "product-image"
    ) as HTMLInputElement | null;

    if (fileInput) fileInput.value = "";
  }

  function editProduct(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      category_id: product.category_id ?? "",
      sku: product.sku ?? "",
      short_description: product.short_description ?? "",
      description: product.description ?? "",
      selling_price: String(product.selling_price),
      compare_at_price:
        product.compare_at_price !== null
          ? String(product.compare_at_price)
          : "",
      stock_quantity: String(product.stock_quantity),
      track_inventory: product.track_inventory,
      is_active: product.is_active,
    });

    setExistingImage(product.image_url ?? "");
    setImageFile(null);
    setCategoryManuallySelected(Boolean(product.category_id));
    setCategorySuggestion(
      getCategorySuggestion(
        `${product.name} ${product.short_description ?? ""} ${product.description ?? ""}`,
        categories
      )
    );
    setMessage("");
    setError("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadImage(): Promise<string | null> {
    if (!imageFile) return existingImage || null;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
    ];

    if (!allowedTypes.includes(imageFile.type)) {
      throw new Error("Please upload a JPG, PNG, WEBP or AVIF image.");
    }

    if (imageFile.size > 5 * 1024 * 1024) {
      throw new Error("Image size must be 5 MB or less.");
    }

    const extension = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `products/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, imageFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: imageFile.type,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const sellingPrice = Number(form.selling_price);
      const comparePrice =
        form.compare_at_price.trim() === ""
          ? null
          : Number(form.compare_at_price);

      const stockQuantity = Number(form.stock_quantity);

      if (!form.name.trim()) {
        throw new Error("Please enter a product name.");
      }

      if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
        throw new Error("Enter a valid selling price.");
      }

      if (
        comparePrice !== null &&
        (!Number.isFinite(comparePrice) || comparePrice < sellingPrice)
      ) {
        throw new Error(
          "Original price must be greater than or equal to the selling price."
        );
      }

      if (
        !Number.isInteger(stockQuantity) ||
        stockQuantity < 0
      ) {
        throw new Error("Stock quantity must be a whole number of 0 or more.");
      }

      const imageUrl = await uploadImage();
      const slug = createSlug(form.name);

      if (!slug) {
        throw new Error("Please enter a valid product name.");
      }

      const productData = {
        category_id: form.category_id || null,
        name: form.name.trim(),
        slug,
        sku: form.sku.trim() || null,
        short_description: form.short_description.trim() || null,
        description: form.description.trim() || null,
        selling_price: sellingPrice,
        compare_at_price: comparePrice,
        image_url: imageUrl,
        is_active: form.is_active,
        track_inventory: form.track_inventory,
        stock_quantity: stockQuantity,
      };

      const result = editingId
        ? await supabase
            .from("products")
            .update(productData)
            .eq("id", editingId)
        : await supabase.from("products").insert(productData);

      if (result.error) throw result.error;

      setMessage(
        editingId
          ? "Product updated successfully!"
          : "Product added successfully!"
      );

      resetForm();
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save the product."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleProduct(product: Product) {
    setError("");
    setMessage("");

    const { error } = await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage(
      product.is_active
        ? "Product unpublished."
        : "Product published successfully!"
    );

    await loadData();
  }

  async function deleteProduct(product: Product) {
    const confirmed = window.confirm(
      `Delete "${product.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Product deleted successfully!");

    if (editingId === product.id) resetForm();

    await loadData();
  }

  const filteredProducts = products.filter((product) =>
    `${product.name} ${product.sku ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="admin-products-page">
      <div className="products-page-header">
        <div>
          <p className="products-eyebrow">STORE MANAGEMENT</p>
          <h1>Products</h1>
          <p>Manage your product catalogue and inventory.</p>
        </div>

        <span className="products-total">
          {products.length} PRODUCTS
        </span>
      </div>

      {message && (
        <div className="products-success" role="status">
          {message}
        </div>
      )}

      {error && (
        <div className="products-error" role="alert">
          {error}
        </div>
      )}

      <section className="product-form-card">
        <div className="product-form-heading">
          <div>
            <p>{editingId ? "UPDATE CATALOGUE" : "NEW CATALOGUE ITEM"}</p>
            <h2>{editingId ? "Edit product" : "Add a product"}</h2>
          </div>

          {editingId && (
            <button
              type="button"
              className="product-cancel-button"
              onClick={resetForm}
            >
              Cancel editing
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="product-form-grid">
            <div className="product-field">
              <label htmlFor="product-name">Product name *</label>
              <input
                id="product-name"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                placeholder="e.g. Classic Women's Sling Bag"
                required
              />
            </div>

            <div className="product-field">
              <label htmlFor="product-sku">SKU</label>
              <input
                id="product-sku"
                value={form.sku}
                onChange={(e) => updateForm("sku", e.target.value)}
                placeholder="e.g. BAG-001"
              />
            </div>

            <div className="product-field">
              <label htmlFor="product-category">Category</label>
              <select
                id="product-category"
                value={form.category_id}
                onChange={(e) => {
                  setCategoryManuallySelected(Boolean(e.target.value));
                  updateForm("category_id", e.target.value);
                }}
              >
                <option value="">Select category</option>
                {categories.filter((category) => !category.parent_category_id).map((parent) => {
                  const children = categories.filter((category) => category.parent_category_id === parent.id);
                  return children.length ? (
                    <optgroup key={parent.id} label={parent.name}>
                      <option value={parent.id}>General {parent.name}</option>
                      {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
                    </optgroup>
                  ) : <option key={parent.id} value={parent.id}>{parent.name}</option>;
                })}
              </select>
              <div className="category-ai-suggestion" aria-live="polite">
                <strong>
                  {categorySuggestion.category
                    ? `Suggested: ${categorySuggestion.category.name}`
                    : "Category suggestion"}
                </strong>
                <small>
                  {categorySuggestion.category
                    ? `Rule confidence: ${Math.round(categorySuggestion.confidence * 100)}%`
                    : categorySuggestion.reason}
                </small>
                {categorySuggestion.category && (
                  <small>{categorySuggestion.reason}</small>
                )}
                {categorySuggestion.category && categorySuggestion.confidence < 0.67 && (
                  <small>Low confidence. Please choose the category yourself.</small>
                )}
              </div>
            </div>

            <div className="product-field">
              <label htmlFor="selling-price">Selling price (₹) *</label>
              <input
                id="selling-price"
                type="number"
                min="0"
                step="0.01"
                value={form.selling_price}
                onChange={(e) =>
                  updateForm("selling_price", e.target.value)
                }
                placeholder="499"
                required
              />
            </div>

            <div className="product-field">
              <label htmlFor="compare-price">Original price (₹)</label>
              <input
                id="compare-price"
                type="number"
                min="0"
                step="0.01"
                value={form.compare_at_price}
                onChange={(e) =>
                  updateForm("compare_at_price", e.target.value)
                }
                placeholder="799"
              />
            </div>

            <div className="product-field">
              <label htmlFor="stock-quantity">Stock quantity</label>
              <input
                id="stock-quantity"
                type="number"
                min="0"
                step="1"
                value={form.stock_quantity}
                onChange={(e) =>
                  updateForm("stock_quantity", e.target.value)
                }
              />
            </div>

            <div className="product-field product-field-full">
              <label htmlFor="short-description">
                Short description
              </label>
              <input
                id="short-description"
                value={form.short_description}
                onChange={(e) =>
                  updateForm("short_description", e.target.value)
                }
                placeholder="A short introduction to the product"
              />
            </div>

            <div className="product-field product-field-full">
              <label htmlFor="product-description">Full description</label>
              <textarea
                id="product-description"
                rows={4}
                value={form.description}
                onChange={(e) =>
                  updateForm("description", e.target.value)
                }
                placeholder="Describe the product, materials, features and details..."
              />
            </div>

            <div className="product-field product-field-full">
              <label htmlFor="product-image">Product image</label>
              <input
                id="product-image"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(e) =>
                  setImageFile(e.target.files?.[0] ?? null)
                }
              />
              <small>JPG, PNG, WEBP or AVIF. Maximum 5 MB.</small>

              {imageFile && (
                <img
                  className="product-image-preview"
                  src={URL.createObjectURL(imageFile)}
                  alt="Selected product preview"
                />
              )}

              {!imageFile && existingImage && (
                <img
                  className="product-image-preview"
                  src={existingImage}
                  alt="Current product"
                />
              )}
            </div>
          </div>

          <div className="product-options">
            <label>
              <input
                type="checkbox"
                checked={form.track_inventory}
                onChange={(e) =>
                  updateForm("track_inventory", e.target.checked)
                }
              />
              Track inventory
            </label>

            <label>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  updateForm("is_active", e.target.checked)
                }
              />
              Publish product immediately
            </label>
          </div>

          <button
            type="submit"
            className="product-submit-button"
            disabled={saving}
          >
            {saving
              ? "SAVING PRODUCT..."
              : editingId
                ? "UPDATE PRODUCT"
                : "ADD PRODUCT"}
          </button>
        </form>
      </section>

      <section className="product-list-section">
        <div className="product-list-heading">
          <div>
            <p>YOUR INVENTORY</p>
            <h2>All products</h2>
          </div>

          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            aria-label="Search products"
          />
        </div>

        {loading ? (
          <p className="product-list-message">Loading products...</p>
        ) : filteredProducts.length === 0 ? (
          <p className="product-list-message">
            No products found. Add your first product above.
          </p>
        ) : (
          <div className="product-table-wrap">
            <table className="admin-product-table">
              <thead>
                <tr>
                  <th>PRODUCT</th>
                  <th>SKU</th>
                  <th>PRICE</th>
                  <th>STOCK</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="admin-product-name">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                          />
                        ) : (
                          <div className="admin-product-placeholder">
                            999+
                          </div>
                        )}

                        <strong>{product.name}</strong>
                      </div>
                    </td>

                    <td>{product.sku || "—"}</td>

                    <td>
                      ₹
                      {Number(product.selling_price).toLocaleString(
                        "en-IN"
                      )}
                    </td>

                    <td>
                      {product.track_inventory
                        ? product.stock_quantity
                        : "Not tracked"}
                    </td>

                    <td>
                      <span
                        className={
                          product.is_active
                            ? "product-status published"
                            : "product-status draft"
                        }
                      >
                        {product.is_active ? "Published" : "Draft"}
                      </span>
                    </td>

                    <td>
                      <div className="product-row-actions">
                        <button
                          type="button"
                          onClick={() => editProduct(product)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleProduct(product)}
                        >
                          {product.is_active ? "Hide" : "Publish"}
                        </button>

                        <button
                          type="button"
                          className="delete-product-button"
                          onClick={() => deleteProduct(product)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
