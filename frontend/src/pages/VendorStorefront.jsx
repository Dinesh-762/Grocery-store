import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { Loader2, Store, MapPin, Package, ArrowLeft } from "lucide-react";

export default function VendorStorefront() {
  const { id } = useParams();
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get(`/vendors/${id}`)
      .then(({ data }) => setVendor(data))
      .catch((e) => {
        const status = e?.response?.status;
        setError(status === 404 || status === 400 ? "Vendor not found." : "Unable to load vendor.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="container-app flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B4332]" />
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="container-app py-20 text-center" data-testid="vendor-storefront-missing">
        <p className="font-semibold">{error || "Vendor not found"}</p>
        <Link to="/products" className="mt-4 inline-block text-[#1B4332] underline">Browse all products</Link>
      </div>
    );
  }

  return (
    <div data-testid="vendor-storefront-page">
      {/* Hero */}
      <section className="border-b border-[#E5E5E5] bg-[#FDFBF7]">
        <div className="container-app py-10">
          <Link to="/products" className="inline-flex items-center gap-1.5 text-sm text-[#4A4A4A] hover:text-[#1B4332]">
            <ArrowLeft className="h-4 w-4" /> All products
          </Link>
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="grid h-20 w-20 flex-shrink-0 place-items-center rounded-2xl bg-[#1B4332] text-white shadow-md">
              <Store className="h-9 w-9" />
            </div>
            <div className="flex-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#8BA888]/20 px-2.5 py-0.5 text-xs font-semibold text-[#1B4332]">
                Verified vendor
              </span>
              <h1
                className="mt-2 font-heading text-3xl font-bold sm:text-4xl"
                data-testid="vendor-name"
              >
                {vendor.business_name}
              </h1>
              {vendor.business_description && (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#4A4A4A]">
                  {vendor.business_description}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[#4A4A4A]">
                {vendor.business_address && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {vendor.business_address}
                    {vendor.business_pincode && ` - ${vendor.business_pincode}`}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" />
                  {vendor.products.length} product{vendor.products.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="container-app py-10">
        <h2 className="font-heading text-2xl font-bold sm:text-3xl">Available now</h2>
        {vendor.products.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-[#E5E5E5] p-10 text-center text-[#4A4A4A]">
            This vendor hasn&apos;t added any products yet. Check back soon!
          </div>
        ) : (
          <div
            className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
            data-testid="vendor-products-grid"
          >
            {vendor.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
