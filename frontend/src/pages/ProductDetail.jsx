import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useParams,
  useNavigate,
  Link,
} from "react-router-dom";
import { api, formatINR } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import {
  ShoppingCart,
  ArrowLeft,
  Plus,
  Minus,
  ShieldCheck,
  Truck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const { addItem } = useCart();

  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);

  const [qty, setQty] = useState(1);

  /*
  |--------------------------------------------------------------------------
  | Selected Variant
  |--------------------------------------------------------------------------
  |
  | NULL means customer is buying the normal/base product.
  |
  | Variant is OPTIONAL.
  |--------------------------------------------------------------------------
  */

  const [selectedVariant, setSelectedVariant] =
    useState(null);

  /*
  |--------------------------------------------------------------------------
  | Load Product
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setProduct(null);
    setRelated([]);
    setSelectedVariant(null);
    setQty(1);

    api
      .get(`/products/${slug}`)
      .then(async ({ data }) => {
        if (!mounted) return;

        setProduct(data);

        try {
          if (data?.category_slug) {
            const { data: rel } =
              await api.get(
                `/products?category=${data.category_slug}&limit=8`
              );

            if (!mounted) return;

            const relatedProducts =
              Array.isArray(rel)
                ? rel
                : Array.isArray(rel?.products)
                ? rel.products
                : [];

            setRelated(
              relatedProducts
                .filter(
                  (item) =>
                    item.slug !== slug
                )
                .slice(0, 4)
            );
          }
        } catch {
          if (mounted) {
            setRelated([]);
          }
        }
      })
      .catch(() => {
        if (mounted) {
          setProduct(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [slug]);

  /*
  |--------------------------------------------------------------------------
  | Normalize Variants
  |--------------------------------------------------------------------------
  |
  | Supports both:
  |
  | variants
  | varients
  |
  | because older backend data may contain the typo.
  |--------------------------------------------------------------------------
  */

  const variants = useMemo(() => {
    if (!product) {
      return [];
    }

    const rawVariants =
      Array.isArray(product.variants)
        ? product.variants
        : Array.isArray(product.varients)
        ? product.varients
        : [];

    if (rawVariants.length === 0) {
      return [];
    }

    return rawVariants
      .map((variant, index) => {
        /*
        |--------------------------------------------------------------------------
        | Backend may return object
        |--------------------------------------------------------------------------
        */

        if (
          typeof variant === "string"
        ) {
          return {
            id: `${variant}-${index}`,
            label: variant,
            price: Number(
              product.price || 0
            ),
            unit: variant,
          };
        }

        const label = String(
          variant?.label ||
            variant?.unit ||
            variant?.name ||
            ""
        ).trim();

        const price = Number(
          variant?.price ??
            variant?.selling_price ??
            variant?.amount ??
            product.price ??
            0
        );

        const unit =
          variant?.unit ||
          label ||
          product.unit ||
          "1 pc";

        return {
          ...variant,

          id:
            variant?.id ||
            variant?._id ||
            `${label}-${index}`,

          label,

          price:
            Number.isFinite(price) &&
            price >= 0
              ? price
              : Number(
                  product.price || 0
                ),

          unit,
        };
      })
      .filter(
        (variant) =>
          variant.label
      );
  }, [product]);

  /*
  |--------------------------------------------------------------------------
  | Current Price
  |--------------------------------------------------------------------------
  |
  | No variant selected:
  |     product.price
  |
  | Variant selected:
  |     variant.price
  |--------------------------------------------------------------------------
  */

  const displayPrice =
    selectedVariant
      ? Number(
          selectedVariant.price || 0
        )
      : Number(
          product?.price || 0
        );

  /*
  |--------------------------------------------------------------------------
  | Current Unit
  |--------------------------------------------------------------------------
  */

  const displayUnit =
    selectedVariant?.unit ||
    selectedVariant?.label ||
    product?.unit ||
    "1 pc";

  /*
  |--------------------------------------------------------------------------
  | MRP
  |--------------------------------------------------------------------------
  */

  const displayMrp =
    selectedVariant?.mrp ??
    selectedVariant?.compare_at_price ??
    product?.mrp ??
    null;

  /*
  |--------------------------------------------------------------------------
  | Discount
  |--------------------------------------------------------------------------
  */

  // Promotional badge is fixed at 10%. The actual discount is applied
  // only after GROCERY10 is explicitly applied at checkout.
  const discount = 10;

  /*
  |--------------------------------------------------------------------------
  | Add To Cart
  |--------------------------------------------------------------------------
  */

  const handleAddToCart = () => {
    if (!product) {
      return;
    }

    if (
      Number(product.stock || 0) <= 0
    ) {
      toast.error(
        "This product is currently out of stock."
      );
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | IMPORTANT:
    | Variant is OPTIONAL.
    |--------------------------------------------------------------------------
    */

    if (selectedVariant) {
      addItem(
        {
          ...product,

          price:
            selectedVariant.price,

          unit:
            selectedVariant.unit ||
            selectedVariant.label ||
            product.unit,
        },

        qty,

        null,

        selectedVariant.label,

        selectedVariant.price,

        selectedVariant.unit ||
          selectedVariant.label ||
          product.unit
      );

      return;
    }

    /*
    |--------------------------------------------------------------------------
    | Normal product without variant
    |--------------------------------------------------------------------------
    */

    addItem(
      {
        ...product,

        price: Number(
          product.price || 0
        ),

        unit:
          product.unit ||
          "1 pc",
      },

      qty
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Buy Now
  |--------------------------------------------------------------------------
  */

  const handleBuyNow = () => {
    if (!product) {
      return;
    }

    if (
      Number(product.stock || 0) <= 0
    ) {
      toast.error(
        "This product is currently out of stock."
      );
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | Variant selected
    |--------------------------------------------------------------------------
    */

    if (selectedVariant) {
      addItem(
        {
          ...product,

          price:
            selectedVariant.price,

          unit:
            selectedVariant.unit ||
            selectedVariant.label ||
            product.unit,
        },

        qty,

        null,

        selectedVariant.label,

        selectedVariant.price,

        selectedVariant.unit ||
          selectedVariant.label ||
          product.unit
      );
    } else {
      /*
      |--------------------------------------------------------------------------
      | Normal product
      |--------------------------------------------------------------------------
      */

      addItem(
        {
          ...product,

          price: Number(
            product.price || 0
          ),

          unit:
            product.unit ||
            "1 pc",
        },

        qty
      );
    }

    navigate("/checkout");
  };

  /*
  |--------------------------------------------------------------------------
  | Loading
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <div className="container-app flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B4332]" />
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Product Not Found
  |--------------------------------------------------------------------------
  */

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

  return (
    <div
      className="container-app py-8"
      data-testid="product-detail-page"
    >
      {/* BACK */}

      <button
        type="button"
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
              src={
                product.image ||
                "/placeholder-product.png"
              }
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
              Number(displayMrp) >
                Number(displayPrice) && (
                <>
                  <div className="text-lg text-gray-400 line-through">
                    {formatINR(
                      displayMrp
                    )}
                  </div>

                  <span className="rounded-full bg-[#E07A5F]/10 px-2.5 py-0.5 text-sm font-semibold text-[#E07A5F]">
                    {discount}% off
                  </span>
                </>
              )}

            {!(displayMrp && Number(displayMrp) > Number(displayPrice)) && (
              <span className="rounded-full bg-[#E07A5F]/10 px-2.5 py-0.5 text-sm font-semibold text-[#E07A5F]">
                {discount}% off
              </span>
            )}
          </div>

          {/* ===================================================
              STOCK
          ==================================================== */}

          {Number(product.stock || 0) >
          0 ? (
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
              OPTIONAL VARIANT SELECTOR
          ==================================================== */}

          {variants.length > 0 && (
            <div
              className="mt-6"
              data-testid="variant-picker"
            >
              <div className="mb-3 text-sm font-semibold text-[#1A1A1A]">
                Select Weight / Variant{" "}
                <span className="font-normal text-gray-400">
                  (Optional)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {variants.map(
                  (variant) => {
                    const active =
                      selectedVariant?.id ===
                      variant.id;

                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() =>
                          setSelectedVariant(
                            active
                              ? null
                              : variant
                          )
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
                          {formatINR(
                            variant.price
                          )}
                        </div>
                      </button>
                    );
                  }
                )}
              </div>

              <p className="mt-2 text-xs text-gray-500">
                You can buy the normal product price
                without selecting a variant.
              </p>
            </div>
          )}

          {/* ===================================================
              SELECTED VARIANT
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
                  {formatINR(
                    selectedVariant.price
                  )}
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
                  setQty((value) =>
                    Math.max(
                      1,
                      value - 1
                    )
                  )
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
                  setQty(
                    (value) =>
                      value + 1
                  )
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
                Number(
                  product.stock || 0
                ) <= 0
              }
              onClick={
                handleAddToCart
              }
              className="btn-primary flex-1 sm:flex-initial disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="add-to-cart-btn"
            >
              <ShoppingCart className="h-4 w-4" />

              {selectedVariant
                ? `Add ${selectedVariant.label}`
                : "Add to Cart"}
            </button>

            {/* =================================================
                BUY NOW
            ================================================= */}

            <button
              type="button"
              disabled={
                Number(
                  product.stock || 0
                ) <= 0
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
                  Within 30–45 minutes in
                  Ambajogai
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
                  100% quality assured or
                  refund
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
            {related.map((item) => (
              <Link
                key={
                  item.id ||
                  item._id ||
                  item.slug
                }
                to={`/products/${item.slug}`}
                className="card-base group overflow-hidden"
                data-testid={`related-${item.slug}`}
              >
                <div className="aspect-square overflow-hidden bg-gray-50">
                  <img
                    src={
                      item.image ||
                      "/placeholder-product.png"
                    }
                    alt={item.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>

                <div className="p-3">
                  <div className="text-xs text-gray-500">
                    {item.unit ||
                      "1 pc"}
                  </div>

                  <div className="mt-1 line-clamp-2 text-sm font-semibold">
                    {item.name}
                  </div>

                  <div className="mt-1 font-bold text-[#1B4332]">
                    {formatINR(
                      item.price
                    )}
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