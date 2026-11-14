import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import ProductGrid from "./ProductGrid";
import "./CategoriesPage.css";

export default function SearchResultsPage() {
  const [params] = useSearchParams();
  const query = params.get("q")?.trim() ?? "";
  return (
    <div className="category-page">
      <header className="category-page-header">
        <Link to="/" className="category-brand">999<span>+</span> KART</Link>
        <Link to="/" className="category-back"><ArrowLeft size={16} /> Back to home</Link>
      </header>
      <main className="category-page-main">
        <div className="category-breadcrumb"><Link to="/">Home</Link><span>/</span><span>Search</span></div>
        <div className="category-page-title search-results-title">
          <p>SEARCH 999+ KART</p>
          <h1>Search results</h1>
          <span>{query ? <>Showing products matching <strong>“{query}”</strong></> : "Enter a product name in the search bar to begin."}</span>
        </div>
        {query ? <ProductGrid searchQuery={query} /> : <div className="category-page-message"><Search size={24} /><p>Use the search bar to find products.</p></div>}
      </main>
      <footer className="category-page-footer">© 2026 999+ KART. All rights reserved.</footer>
    </div>
  );
}
