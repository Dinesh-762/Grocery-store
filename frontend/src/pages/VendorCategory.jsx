import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { Loader2, ArrowLeft, Store, ChevronRight } from "lucide-react";

// Customer navigation: Home -> shop-type section -> vendor -> category -> that vendor's products.
export default function VendorCategory() {
  const { id, slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get(`/vendors/${id}/products`, { params: { category: slug } })
      .then(({ data: res }) => {
        if (active) setData(res);
      })
      .catch((e) => {
        if (!active) return;
        const status = e?.response?.status;
        setError(status === 404 || status === 400 ? "This category is not available for this vendor." : "Unable to load products.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, slug]);

  if (loading) {
    return (
      <div className="container-app flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B4332]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container-app py-20 text-center" data-testid="vendor-category-missing">
        <p className="font-semibold">{error || "Category not found"}</p>
        <Link to={`/vendors/${id}`} className="mt-4 inline-block text-[#1B4332] underline">
          Back to store
        </Link>
      </div>
    );
  }

  const { vendor, category, products } = data;

  return (
    <div data-testid="vendor-category-page">
      <section className="border-b border-[#E5E5E5] bg-[#FDFBF7]">
        <div className="container-app py-8">
          <nav className="flex flex-wrap items-center gap-1 text-xs text-[#4A4A4A]" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-[#1B4332]">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <span>{vendor.shop_type_label || "Stores"}</span>
            <ChevronRight className="h-3 w-3" />
            <Link to={`/vendors/${vendor.id}`} className="hover:text-[#1B4332]">{vendor.business_name}</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-semibold text-[#1B4332]">{category?.name}</span>
          </nav>

          <Link
            to={`/vendors/${vendor.id}`}
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#4A4A4A] hover:text-[#1B4332]"
            data-testid="back-to-vendor"
          >
            <ArrowLeft className="h-4 w-4" /> {vendor.business_name}
          </Link>

          <div className="mt-4 flex items-center gap-4">
            {vendor.shop_logo ? (
              <img src={vendor.shop_logo} alt={vendor.business_name} className="h-12 w-12 rounded-xl border border-[#E5E5E5] bg-white object-cover" />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#1B4332] text-white">
                <Store className="h-5 w-5" />
              </div>
            )}
            <div>
              <h1 className="font-heading text-2xl font-bold sm:text-3xl" data-testid="vendor-category-title">
                {category?.name}
              </h1>
              <p className="text-sm text-[#4A4A4A]">
                {products.length} item{products.length !== 1 ? "s" : ""} from {vendor.business_name}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container-app py-10">
        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E5E5E5] p-10 text-center text-[#4A4A4A]" data-testid="vendor-category-empty">
            {vendor.business_name} hasn&apos;t added any products in this category yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" data-testid="vendor-category-products">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
