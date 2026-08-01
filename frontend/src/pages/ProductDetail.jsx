import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, formatINR } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { ShoppingCart, ArrowLeft, Plus, Minus, ShieldCheck, Truck } from "lucide-react";
import { Loader2 } from "lucide-react";

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [customNote, setCustomNote] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .get(`/products/${slug}`)
      .then(async ({ data }) => {
        setProduct(data);
        const { data: rel } = await api.get(`/products?category=${data.category_slug}&limit=8`);
        setRelated(rel.filter((r) => r.slug !== slug).slice(0, 4));
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="container-app flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B4332]" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container-app py-20 text-center">
        <p className="font-semibold">Product not found.</p>
        <Link to="/products" className="mt-4 inline-block text-[#1B4332] underline">
          Browse products
        </Link>
      </div>
    );
  }

  const off = product.mrp && product.mrp > product.price
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
    : 0;

  const displayPrice = selectedVariant?.price ?? product.price;
  const displayUnit = selectedVariant?.unit ?? product.unit;
  const displayMrp = selectedVariant ? null : product.mrp;
  const displayOff = selectedVariant ? 0 : off;

  return (
    <div className="container-app py-8" data-testid="product-detail-page">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[#4A4A4A] hover:text-[#1B4332]"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="card-base overflow-hidden">
          <div className="aspect-square overflow-hidden bg-gray-50">
            <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
          </div>
        </div>

        <div>
        <div>
          <div className="text-sm text-[#4A4A4A]">{displayUnit}</div>
          {product.vendor_id && product.vendor_name && (
            <Link
              to={`/vendors/${product.vendor_id}`}
              className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#8BA888]/15 px-2.5 py-0.5 text-xs font-semibold text-[#1B4332] hover:bg-[#8BA888]/30"
              data-testid="pdp-vendor-link"
            >
              by {product.vendor_name}
            </Link>
          )}
        </div>
          <h1 className="mt-2 font-heading text-3xl font-bold sm:text-4xl" data-testid="product-name">
            {product.name}
          </h1>

          <div className="mt-4 flex items-baseline gap-3">
            <div className="text-3xl font-bold text-[#1B4332]" data-testid="product-price">
              {formatINR(displayPrice)}
            </div>
            {displayMrp && displayMrp > displayPrice && (
              <>
                <div className="text-lg text-gray-400 line-through">{formatINR(displayMrp)}</div>
                <span className="rounded-full bg-[#E07A5F]/10 px-2.5 py-0.5 text-sm font-semibold text-[#E07A5F]">
                  {displayOff}% off
                </span>
              </>
            )}
          </div>

          {product.stock > 0 ? (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              In stock ({product.stock})
            </div>
          ) : (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
              Currently out of stock
            </div>
          )}

          <p className="mt-6 leading-relaxed text-[#4A4A4A]">{product.description || "Fresh, quality-checked and delivered fast."}</p>

          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <div className="mt-6" data-testid="variant-picker">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#4A4A4A]">Choose size / pack</div>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const active = selectedVariant?.label === v.label;
                  return (
                    <button
                      key={v.label}
                      onClick={() => setSelectedVariant(active ? null : v)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? "border-[#1B4332] bg-[#1B4332] text-white" : "border-[#E5E5E5] text-[#1A1A1A] hover:border-[#1B4332]"}`}
                      data-testid={`variant-${v.label}`}
                    >
                      {v.label} · ₹{v.price}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom quantity note */}
          <div className="mt-4">
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Custom quantity / note (optional)</label>
            <input
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="e.g. 750 grams, riper ones please"
              className="input-base"
              data-testid="custom-note-input"
              maxLength={140}
            />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-[#1B4332] p-1">
              <button
                onClick={() => setQty((v) => Math.max(1, v - 1))}
                className="grid h-9 w-9 place-items-center rounded-full text-[#1B4332] hover:bg-[#1B4332]/10"
                data-testid="qty-decrement"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-8 text-center text-base font-semibold" data-testid="qty-value">{qty}</span>
              <button
                onClick={() => setQty((v) => v + 1)}
                className="grid h-9 w-9 place-items-center rounded-full text-[#1B4332] hover:bg-[#1B4332]/10"
                data-testid="qty-increment"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              disabled={product.stock <= 0}
              onClick={() => {
                const variantExtras = selectedVariant
                  ? { variant_label: selectedVariant.label, price: selectedVariant.price, unit: selectedVariant.unit || product.unit }
                  : {};
                addItem({ ...product, ...variantExtras }, qty, customNote.trim() || null, selectedVariant?.label || null);
              }}
              className="btn-primary flex-1 sm:flex-initial"
              data-testid="add-to-cart-btn"
            >
              <ShoppingCart className="h-4 w-4" /> Add to Cart
            </button>

            <button
              disabled={product.stock <= 0}
              onClick={() => {
                const variantExtras = selectedVariant
                  ? { variant_label: selectedVariant.label, price: selectedVariant.price, unit: selectedVariant.unit || product.unit }
                  : {};
                addItem({ ...product, ...variantExtras }, qty, customNote.trim() || null, selectedVariant?.label || null);
                navigate("/checkout");
              }}
              className="btn-accent flex-1 sm:flex-initial"
              data-testid="buy-now-btn"
            >
              Buy Now
            </button>
          </div>

          <div className="mt-8 grid gap-3 rounded-2xl border border-[#E5E5E5] p-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Truck className="h-5 w-5 text-[#1B4332]" />
              <div>
                <div className="text-sm font-semibold">Fast delivery</div>
                <div className="text-xs text-[#4A4A4A]">Within 30–45 minutes in Ambajogai</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-[#1B4332]" />
              <div>
                <div className="text-sm font-semibold">Freshness guaranteed</div>
                <div className="text-xs text-[#4A4A4A]">100% quality assured or refund</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-16">
          <h2 className="font-heading text-2xl font-bold sm:text-3xl">You may also like</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <Link
                key={p.id}
                to={`/products/${p.slug}`}
                className="card-base overflow-hidden group"
                data-testid={`related-${p.slug}`}
              >
                <div className="aspect-square overflow-hidden bg-gray-50">
                  <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                </div>
                <div className="p-3">
                  <div className="text-xs text-gray-500">{p.unit}</div>
                  <div className="mt-1 line-clamp-2 text-sm font-semibold">{p.name}</div>
                  <div className="mt-1 font-bold text-[#1B4332]">{formatINR(p.price)}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
