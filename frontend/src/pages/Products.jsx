import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { Search, SlidersHorizontal, Loader2 } from "lucide-react";

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const sort = searchParams.get("sort") || "featured";

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(q);

  useEffect(() => {
    api.get("/categories").then(({ data }) => setCategories(data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    params.set("limit", "100");
    api
      .get(`/products?${params.toString()}`)
      .then(({ data }) => setProducts(data))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [q, category]);

  const sorted = useMemo(() => {
    const arr = [...products];
    if (sort === "price-asc") arr.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") arr.sort((a, b) => b.price - a.price);
    else if (sort === "name") arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }, [products, sort]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const submitSearch = (e) => {
    e.preventDefault();
    updateParam("q", searchInput.trim());
  };

  const activeCat = Array.isArray(categories) ? categories.find((c) => c.slug === category) : null;

  return (
    <div className="container-app py-8" data-testid="products-page">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold sm:text-4xl">
          {activeCat ? activeCat.name : q ? `Results for "${q}"` : "All products"}
        </h1>
        <p className="mt-2 text-sm text-[#4A4A4A]">
          {loading ? "Loading products…" : `${sorted.length} product${sorted.length !== 1 ? "s" : ""} available`}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        {/* Sidebar filters */}
        <aside className="space-y-6" data-testid="filters-sidebar">
          <form onSubmit={submitSearch}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products"
                className="input-base pl-10"
                data-testid="filter-search-input"
              />
            </div>
          </form>

          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1A1A1A]">
              <SlidersHorizontal className="h-4 w-4" />
              Categories
            </div>
            <div className="space-y-1">
              <button
                onClick={() => updateParam("category", "")}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  !category ? "bg-[#1B4332] text-white" : "text-[#4A4A4A] hover:bg-gray-50"
                }`}
                data-testid="filter-cat-all"
              >
                All products
              </button>
              {categories.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => updateParam("category", c.slug)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    category === c.slug ? "bg-[#1B4332] text-white" : "text-[#4A4A4A] hover:bg-gray-50"
                  }`}
                  data-testid={`filter-cat-${c.slug}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 text-sm font-semibold text-[#1A1A1A]">Sort by</div>
            <select
              value={sort}
              onChange={(e) => updateParam("sort", e.target.value)}
              className="input-base"
              data-testid="filter-sort"
            >
              <option value="featured">Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </aside>

        {/* Grid */}
        <div>
          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#1B4332]" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#E5E5E5] p-10 text-center">
              <div className="text-3xl">🛒</div>
              <p className="mt-3 font-semibold">No products found</p>
              <p className="mt-1 text-sm text-[#4A4A4A]">Try a different search or category.</p>
            </div>
          ) : (
            <div
              className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4"
              data-testid="products-grid"
            >
              {sorted.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
