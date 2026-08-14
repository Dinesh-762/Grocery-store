import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, formatINR } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import {
  ShoppingCart,
  ArrowLeft,
  Plus,
  Minus,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);

  // Selected weight/variant
  const [selectedVariant, setSelectedVariant] = useState(null);

  useEffect(() => {
    setLoading(true);
    setSelectedVariant(null);
    setQty(1);

    api
      .get(`/products/${slug}`)
      .then(async ({ data }) => {
        setProduct(data);

        const { data: rel } = await api.get(
          `/products?category=${data.category_slug}&limit=8`
        );

        setRelated(
          rel.filter((r) => r.slug !== slug).slice(0, 4)
        );
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [slug]);

  /*
   * ============================================================
   * VARIANT PRICING
   * ============================================================
   *
   * These are the fixed prices discussed:
   *
   * 500g = â‚¹20
   * 1kg  = â‚¹30
   * 2kg  = â‚¹55
   * 3kg  = â‚¹80
   * 4kg  = â‚¹105
   * 5kg  = â‚¹130
   *
   * Backend variants will be used when available.
   * For Fresh Tomato, these prices are also supported here
   * so the UI immediately shows the correct price.
   */

  const DEFAULT_VARIANT_PRICES = {
    "500g": 20,
    "500gm": 20,
    "0.5kg": 20,
    "1kg": 30,
    "1 Kg": 30,
    "2kg": 55,
    "2 Kg": 55,
    "3kg": 80,
    "3 Kg": 80,
    "4kg": 105,
    "4 Kg": 105,
    "5kg": 130,
    "5 Kg": 130,
  };

  /*
   * Normalize backend variant data.
   *
   * If backend already contains:
   * { label: "500g", price: 20 }
   * we use it directly.
   *
   * Otherwise the predefined pricing above is used.
   */
  const getVariants = () => {
    if (!product) return [];

    if (
      Array.isArray(product.variants) &&
      product.variants.length > 0
    ) {
      return product.variants.map((variant) => {
        const label = String(
          variant.label ||
            variant.unit ||
            variant.name ||
            ""
        ).trim();

        const normalizedPrice =
          variant.price !== undefined &&
          variant.price !== null
            ? Number(variant.price)
            : DEFAULT_VARIANT_PRICES[label];

        return {
          ...variant,
          label,
          price: Number.isFinite(normalizedPrice)
            ? normalizedPrice
            : Number(product.price || 0),
          unit: variant.unit || label || product.unit,
        };
      });
    }

    /*
     * If the product has no variants yet, create the
     * requested standard weight options.
     *
     * The product's 1kg price is used only as a fallback
     * for products other than Fresh Tomato.
     */
    const basePrice = Number(product.price || 0);

    return [
      {
        label: "500g",
        price:
          product.slug === "fresh-tomato"
            ? 20
            : Math.round(basePrice * 0.67),
        unit: "500g",
      },
      {
        label: "1kg",
        price: basePrice,
        unit: "1kg",
      },
      {
        label: "2kg",
        price:
          product.slug === "fresh-tomato"
            ? 55
            : Math.round(basePrice * 1.83),
        unit: "2kg",
      },
      {
        label: "3kg",
        price:
          product.slug === "fresh-tomato"
            ? 80
            : Math.round(basePrice * 2.67),
        unit: "3kg",
      },
      {
        label: "4kg",
        price:
          product.slug === "fresh-tomato"
            ? 105
            : Math.round(basePrice * 3.5),
        unit: "4kg",
      },
      {
        label: "5kg",
        price:
          product.slug === "fresh-tomato"
            ? 130
            : Math.round(basePrice * 4.33),
        unit: "5kg",
      },
    ];
  };

  const variants = getVariants();

  /*
   * Automatically select 1kg if available.
   * Otherwise select the first variant.
   */
  useEffect(() => {
    if (!product) return;

    const availableVariants = variants;

    if (availableVariants.length === 0) {
      setSelectedVariant(null);
      return;
    }

    const oneKg =
      availableVariants.find(
        (variant) =>
          String(variant.label).toLowerCase() === "1kg"
      ) || availableVariants[0];

    setSelectedVariant(oneKg);
  }, [product, variants]);

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
        <p className="font-semibold">
          Product not found.
        </p>

        <Link
          to="/products"
          className="mt-4 inline-block text-[#1B4332] underline"
        >
          Browse products
        </Link>
      </div>
    );
  }

  const displayPrice =
    selectedVariant?.price ?? Number(product.price || 0);

  const displayUnit =
    selectedVariant?.unit ||
    selectedVariant?.label ||
    product.unit ||
    "1kg";

  /*
   * MRP is shown only when the selected variant does not
   * have its own MRP.
   */
  const displayMrp = selectedVariant
    ? null
    : product.mrp;

  const off =
    product.mrp &&
    product.mrp > product.price
      ? Math.round(
          ((product.mrp - product.price) /
            product.mrp) *
            100
        )
      : 0;

  /*
   * ============================================================
   * ADD TO CART
   * ============================================================
   */
  const handleAddToCart = () => {
    if (!selectedVariant) {
      toast.error("Please select a weight.");
      return;
    }

    if (product.stock <= 0) {
      toast.error("This product is currently out of stock.");
      return;
    }

    addItem(
      {
        ...product,

        /*
         * IMPORTANT:
         * Selected variant price is passed explicitly.
         */
        price: selectedVariant.price,

        unit:
          selectedVariant.unit ||
          selectedVariant.label ||
          product.unit,

        variant_label: selectedVariant.label,
      },

      qty,

      /*
       * No custom note.
       */
      null,

      selectedVariant.label,

      selectedVariant.price,

      selectedVariant.unit ||
        selectedVariant.label ||
        product.unit
    );
  };

  /*
   * ============================================================
   * BUY NOW
   * ============================================================
   */
  const handleBuyNow = () => {
    if (!selectedVariant) {
      toast.error("Please select a weight.");
      return;
    }

    if (product.stock <= 0) {
      toast.error("This product is currently out of stock.");
      return;
    }

    addItem(
      {
        ...product,
        price: selectedVariant.price,
        unit:
          selectedVariant.unit ||
          selectedVariant.label ||
          product.unit,
        variant_label: selectedVariant.label,
      },

      qty,

      null,

      selectedVariant.label,

      selectedVariant.price,

      selectedVariant.unit ||
        selectedVariant.label ||
        product.unit
    );

    navigate("/checkout");
  };

  return (
    <div
      className="container-app py-8"
      data-testid="product-detail-page"
    >
      {/* BACK */}

      <button
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[#4A4A4A] hover:text-[#1B4332]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* =====================================================
            PRODUCT IMAGE
        ====================================================== */}

        <div className="card-base overflow-hidden">
          <div className="aspect-square overflow-hidden bg-gray-50">
            <img
              src={product.image}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        {/* =====================================================
            PRODUCT INFORMATION
        ====================================================== */}

        <div>
          {/* UNIT / VENDOR */}

          <div>
            <div className="text-sm text-[#4A4A4A]">
              {displayUnit}
            </div>

            {product.vendor_id &&
              product.vendor_name && (
                <Link
                  to={`/vendors/${product.vendor_id}`}
                  className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#8BA888]/15 px-2.5 py-0.5 text-xs font-semibold text-[#1B4332] hover:bg-[#8BA888]/30"
                  data-testid="pdp-vendor-link"
                >
                  by {product.vendor_name}
                </Link>
              )}
          </div>

          {/* NAME */}

          <h1
            className="mt-2 font-heading text-3xl font-bold sm:text-4xl"
            data-testid="product-name"
          >
            {product.name}
          </h1>

          {/* ===================================================
              PRICE
          ==================================================== */}

          <div className="mt-4 flex items-baseline gap-3">
            <div
              className="text-3xl font-bold text-[#1B4332]"
              data-testid="product-price"
            >
              {formatINR(displayPrice)}
            </div>

            {displayMrp &&
              displayMrp > displayPrice && (
                <>
                  <div className="text-lg text-gray-400 line-through">
                    {formatINR(displayMrp)}
                  </div>

                  <span className="rounded-full bg-[#E07A5F]/10 px-2.5 py-0.5 text-sm font-semibold text-[#E07A5F]">
                    {off}% off
                  </span>
                </>
              )}
          </div>

          {/* ===================================================
              STOCK
          ==================================================== */}

          {product.stock > 0 ? (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              In stock ({product.stock})
            </div>
          ) : (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
              Currently out of stock
            </div>
          )}

          {/* DESCRIPTION */}

          <p className="mt-6 leading-relaxed text-[#4A4A4A]">
            {product.description ||
              "Fresh, quality-checked and delivered fast."}
          </p>

          {/* ===================================================
              REQUIRED WEIGHT SELECTOR
          ==================================================== */}

          <div
            className="mt-6"
            data-testid="variant-picker"
          >
            <div className="mb-3 text-sm font-semibold text-[#1A1A1A]">
              Select Weight{" "}
              <span className="text-red-500">*</span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {variants.map((variant) => {
                const active =
                  selectedVariant?.label ===
                  variant.label;

                return (
                  <button
                    key={variant.label}
                    type="button"
                    onClick={() =>
                      setSelectedVariant(variant)
                    }
                    className={`rounded-xl border px-3 py-3 text-center transition-all ${
                      active
                        ? "border-[#1B4332] bg-[#1B4332] text-white shadow-sm"
                        : "border-[#E5E5E5] bg-white text-[#1A1A1A] hover:border-[#1B4332]"
                    }`}
                    data-testid={`variant-${variant.label}`}
                  >
                    <div className="text-sm font-bold">
                      {variant.label}
                    </div>

                    <div
                      className={`mt-1 text-xs ${
                        active
                          ? "text-white/90"
                          : "text-[#4A4A4A]"
                      }`}
                    >
                      {formatINR(variant.price)}
                    </div>
                  </button>
                );
              })}
            </div>

            {!selectedVariant && (
              <p className="mt-2 text-xs font-medium text-red-500">
                Please select a weight before adding this
                product to cart.
              </p>
            )}
          </div>

          {/* ===================================================
              SELECTED VARIANT PRICE
          ==================================================== */}

          {selectedVariant && (
            <div className="mt-4 rounded-xl bg-[#8BA888]/10 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#4A4A4A]">
                  Selected
                </span>

                <span className="font-semibold text-[#1B4332]">
                  {selectedVariant.label}
                </span>
              </div>

              <div className="mt-1 flex items-center justify-between">
                <span className="text-sm text-[#4A4A4A]">
                  Price
                </span>

                <span className="text-lg font-bold text-[#1B4332]">
                  {formatINR(selectedVariant.price)}
                </span>
              </div>
            </div>
          )}

          {/* ===================================================
              QUANTITY
          ==================================================== */}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-[#1B4332] p-1">
              <button
                type="button"
                onClick={() =>
                  setQty((v) => Math.max(1, v - 1))
                }
                className="grid h-9 w-9 place-items-center rounded-full text-[#1B4332] hover:bg-[#1B4332]/10"
                data-testid="qty-decrement"
              >
                <Minus className="h-4 w-4" />
              </button>

              <span
                className="min-w-8 text-center text-base font-semibold"
                data-testid="qty-value"
              >
                {qty}
              </span>

              <button
                type="button"
                onClick={() =>
                  setQty((v) => v + 1)
                }
                className="grid h-9 w-9 place-items-center rounded-full text-[#1B4332] hover:bg-[#1B4332]/10"
                data-testid="qty-increment"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* =================================================
                ADD TO CART
            ================================================= */}

            <button
              type="button"
              disabled={
                product.stock <= 0 ||
                !selectedVariant
              }
              onClick={handleAddToCart}
              className="btn-primary flex-1 sm:flex-initial disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="add-to-cart-btn"
            >
              <ShoppingCart className="h-4 w-4" />

              {!selectedVariant
                ? "Select Weight"
                : "Add to Cart"}
            </button>

            {/* =================================================
                BUY NOW
            ================================================= */}

            <button
              type="button"
              disabled={
                product.stock <= 0 ||
                !selectedVariant
              }
              onClick={handleBuyNow}
              className="btn-accent flex-1 sm:flex-initial disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="buy-now-btn"
            >
              Buy Now
            </button>
          </div>

          {/* ===================================================
              DELIVERY / GUARANTEE
          ==================================================== */}

          <div className="mt-8 grid gap-3 rounded-2xl border border-[#E5E5E5] p-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Truck className="h-5 w-5 text-[#1B4332]" />

              <div>
                <div className="text-sm font-semibold">
                  Fast delivery
                </div>

                <div className="text-xs text-[#4A4A4A]">
                  Within 30â€“45 minutes in Ambajogai
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-[#1B4332]" />

              <div>
                <div className="text-sm font-semibold">
                  Freshness guaranteed
                </div>

                <div className="text-xs text-[#4A4A4A]">
                  100% quality assured or refund
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =======================================================
          RELATED PRODUCTS
      ======================================================== */}

      {related.length > 0 && (
        <div className="mt-16">
          <h2 className="font-heading text-2xl font-bold sm:text-3xl">
            You may also like
          </h2>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <Link
                key={p.id}
                to={`/products/${p.slug}`}
                className="card-base group overflow-hidden"
                data-testid={`related-${p.slug}`}
              >
                <div className="aspect-square overflow-hidden bg-gray-50">
                  <img
                    src={p.image}
                    alt={p.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>

                <div className="p-3">
                  <div className="text-xs text-gray-500">
                    {p.unit}
                  </div>

                  <div className="mt-1 line-clamp-2 text-sm font-semibold">
                    {p.name}
                  </div>

                  <div className="mt-1 font-bold text-[#1B4332]">
                    {formatINR(p.price)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

