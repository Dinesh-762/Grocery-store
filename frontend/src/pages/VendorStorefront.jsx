import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { Loader2, Store, MapPin, Package, ArrowLeft, ShieldCheck, Phone, Clock, Truck, Palmtree } from "lucide-react";

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

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

  const closed = vendor.vacation_mode || vendor.open_now === false;
  const todayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
  const todayHours = vendor.business_hours?.[todayKey];

  return (
    <div data-testid="vendor-storefront-page">
      {/* Banner + Hero */}
      <section className="border-b border-[#E5E5E5] bg-[#FDFBF7]">
        {vendor.banner_image && (
          <div className="relative h-40 w-full overflow-hidden bg-[#1B4332]/10 sm:h-56">
            <img src={vendor.banner_image} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#FDFBF7] via-transparent to-transparent" />
          </div>
        )}
        <div className="container-app py-10">
          <Link to="/products" className="inline-flex items-center gap-1.5 text-sm text-[#4A4A4A] hover:text-[#1B4332]">
            <ArrowLeft className="h-4 w-4" /> All products
          </Link>
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
            {vendor.shop_logo ? (
              <img src={vendor.shop_logo} alt={vendor.business_name} className="h-20 w-20 flex-shrink-0 rounded-2xl border border-[#E5E5E5] bg-white object-cover shadow-md" />
            ) : (
              <div className="grid h-20 w-20 flex-shrink-0 place-items-center rounded-2xl bg-[#1B4332] text-white shadow-md">
                <Store className="h-9 w-9" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {vendor.verified && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#8BA888]/20 px-2.5 py-0.5 text-xs font-semibold text-[#1B4332]">
                    <ShieldCheck className="h-3 w-3" /> Verified vendor
                  </span>
                )}
                {closed ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700" data-testid="temporarily-closed-badge">
                    <Palmtree className="h-3 w-3" /> {vendor.vacation_mode ? "Temporarily closed" : "Closed now"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700" data-testid="open-now-badge">
                    <Clock className="h-3 w-3" /> Open now{todayHours ? ` · ${todayHours}` : ""}
                  </span>
                )}
              </div>
              <h1 className="mt-2 font-heading text-3xl font-bold sm:text-4xl" data-testid="vendor-name">{vendor.business_name}</h1>
              {vendor.business_description && (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#4A4A4A]">{vendor.business_description}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#4A4A4A]">
                {vendor.business_address && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {vendor.business_address}{vendor.business_pincode && ` - ${vendor.business_pincode}`}
                  </span>
                )}
                {vendor.shop_phone && (
                  <a href={`tel:${vendor.shop_phone}`} className="inline-flex items-center gap-1 hover:text-[#1B4332]">
                    <Phone className="h-3.5 w-3.5" /> {vendor.shop_phone}
                  </a>
                )}
                <span className="inline-flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" />
                  {vendor.products.length} product{vendor.products.length !== 1 ? "s" : ""}
                </span>
                {vendor.estimated_delivery_min ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> ~{vendor.estimated_delivery_min} min delivery
                  </span>
                ) : null}
                {vendor.delivery_radius_km ? (
                  <span className="inline-flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" /> Delivers within {vendor.delivery_radius_km} km
                  </span>
                ) : null}
                {vendor.min_order_amount ? (
                  <span className="inline-flex items-center gap-1">Min order ₹{vendor.min_order_amount}</span>
                ) : null}
              </div>
            </div>
          </div>

          {closed && (
            <div className={`mt-6 rounded-xl p-4 text-sm ${vendor.vacation_mode ? "bg-red-50 text-red-800" : "bg-yellow-50 text-yellow-800"}`} data-testid="vacation-notice">
              <div className="font-semibold">
                {vendor.vacation_mode ? "This vendor is on vacation." : "This vendor is closed right now."}
              </div>
              {vendor.vacation_message && <div className="mt-1">{vendor.vacation_message}</div>}
              <div className="mt-1 text-xs">Orders cannot be placed until they reopen.</div>
            </div>
          )}

          {vendor.business_hours && Object.keys(vendor.business_hours).length > 0 && (
            <div className="mt-6 rounded-xl border border-[#E5E5E5] bg-white p-4 text-sm" data-testid="business-hours">
              <div className="mb-3 flex items-center gap-2 font-semibold text-[#1B4332]">
                <Clock className="h-4 w-4" /> Business hours
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {DAYS.map((d) => {
                  const isToday = d.key === todayKey;
                  return (
                    <div key={d.key} className={`flex items-center justify-between rounded-md px-2 py-1 text-xs ${isToday ? "bg-[#1B4332]/10 font-semibold text-[#1B4332]" : ""}`}>
                      <span>{d.label}{isToday ? " · Today" : ""}</span>
                      <span className={isToday ? "" : "text-[#4A4A4A]"}>{vendor.business_hours[d.key] || "Closed"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" data-testid="vendor-products-grid">
            {vendor.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
