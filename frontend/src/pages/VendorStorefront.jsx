import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Loader2, Store, Package, ArrowLeft } from "lucide-react";

// Customer-facing store view intentionally exposes only the vendor's public name
// and the categories/products available from that vendor.
export default function VendorStorefront() {
  const { id } = useParams();
  const [vendor, setVendor] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.get(`/vendors/${id}`),
      api.get(`/vendors/${id}/categories`),
    ])
      .then(([vendorRes, categoryRes]) => {
        if (!active) return;
        setVendor(vendorRes.data);
        setCategories(categoryRes.data?.categories || []);
      })
      .catch((e) => {
        if (!active) return;
        setError(e?.response?.status === 404 ? "Vendor not found." : "Unable to load this store.");
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="container-app flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#1B4332]" /></div>;
  if (error || !vendor) return <div className="container-app py-20 text-center"><p className="font-semibold">{error || "Vendor not found"}</p><Link to="/" className="mt-4 inline-block text-[#1B4332] underline">Back to home</Link></div>;

  return (
    <div data-testid="vendor-storefront-page">
      <section className="border-b border-[#E5E5E5] bg-[#FDFBF7]">
        <div className="container-app py-8 sm:py-10">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[#4A4A4A] hover:text-[#1B4332]" data-testid="storefront-back-home">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <div className="mt-6 flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#1B4332] text-white"><Store className="h-8 w-8" /></div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-[#1B4332] sm:text-3xl" data-testid="vendor-name">{vendor.business_name}</h1>
              <p className="mt-1 text-sm text-[#68756B]">{vendor.shop_type_label || "Local store"}</p>
            </div>
          </div>
        </div>
      </section>
      <section className="container-app py-8 sm:py-10">
        <h2 className="font-heading text-xl font-bold text-[#20392A] sm:text-2xl">Shop by category</h2>
        {categories.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#E5E5E5] p-10 text-center text-sm text-[#68756B]">No categories are available for this store yet.</div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" data-testid="vendor-categories-grid">
            {categories.map((c) => (
              <Link key={c.slug} to={`/vendors/${vendor.id}/category/${c.slug}`} className="group overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg" data-testid={`vendor-category-${c.slug}`}>
                <div className="aspect-[4/3] overflow-hidden bg-[#F0F4EF]">
                  {c.image ? <img src={c.image} alt={c.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="grid h-full place-items-center"><Package className="h-8 w-8 text-[#77947B]" /></div>}
                </div>
                <div className="p-3 sm:p-4">
                  <h3 className="truncate text-sm font-bold text-[#20392A] sm:text-base">{c.name}</h3>
                  <p className="mt-0.5 text-xs text-[#68756B]">{c.product_count || 0} products</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
