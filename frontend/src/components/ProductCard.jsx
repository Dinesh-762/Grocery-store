import { Link } from "react-router-dom";
import { Plus, Minus, ShoppingCart } from "lucide-react";
import { useCart, lineKey } from "@/context/CartContext";
import { formatINR } from "@/lib/api";
import { useMemo, useState } from "react";

export default function ProductCard({ product }) {
  const { addItem, items, setQuantity } = useCart();

  /*
   * ---------------------------------------------------------------
   * Product variants
   * ---------------------------------------------------------------
   *
   * Supports variant objects such as:
   *
   * {
   *   label: "1 kg",
   *   price: 50,
   *   unit: "1 kg"
   * }
   *
   * Also safely handles label/name/unit differences.
   */

  const variants = useMemo(() => {
    if (!Array.isArray(product?.variants)) {
      return [];
    }

    return product.variants
      .map((variant, index) => {
        const label =
          variant?.label ??
          variant?.name ??
          variant?.unit ??
          `Option ${index + 1}`;

        const price = Number(
          variant?.price ??
            variant?.selling_price ??
            product.price ??
            0
        );

        const unit =
          variant?.unit ??
          variant?.label ??
          label;

        const mrp =
          variant?.mrp !== undefined &&
          variant?.mrp !== null
            ? Number(variant.mrp)
            : Number(product.mrp ?? 0);

        return {
          ...variant,
          label: String(label),
          price,
          unit: String(unit),
          mrp,
        };
      })
      .filter((variant) => variant.price >= 0);
  }, [product]);

  /*
   * Selected variant.
   *
   * If variants exist, first variant is selected automatically.
   * If there are no variants, null means normal product.
   */

  const [selectedVariantLabel, setSelectedVariantLabel] =
    useState(
      variants.length > 0
        ? variants[0].label
        : null
    );

  /*
   * Get currently selected variant.
   */

  const selectedVariant = useMemo(() => {
    if (!selectedVariantLabel) {
      return null;
    }

    return (
      variants.find(
        (variant) =>
          variant.label ===
          selectedVariantLabel
      ) || null
    );
  }, [
    variants,
    selectedVariantLabel,
  ]);

  /*
   * ---------------------------------------------------------------
   * Active product values
   * ---------------------------------------------------------------
   */

  const activePrice = selectedVariant
    ? Number(selectedVariant.price)
    : Number(product.price || 0);

  const activeUnit = selectedVariant
    ? selectedVariant.unit
    : product.unit;

  const activeMrp = selectedVariant
    ? Number(selectedVariant.mrp || 0)
    : Number(product.mrp || 0);

  /*
   * ---------------------------------------------------------------
   * Discount
   * ---------------------------------------------------------------
   */

  // Promotional badge is fixed at 10% for every product.
  // This does NOT change the product price. The real 10% discount is applied
  // only after the customer explicitly applies GROCERY10 at checkout.
  const off = 10;

  /*
   * ---------------------------------------------------------------
   * Stock
   * ---------------------------------------------------------------
   *
   * Variant stock is used when available.
   * Otherwise product stock is used.
   */

  const stock = Number(
    selectedVariant?.stock ??
      product.stock ??
      0
  );

  /*
   * ---------------------------------------------------------------
   * Current cart item
   * ---------------------------------------------------------------
   *
   * IMPORTANT:
   * Product + variant are treated as separate cart lines.
   *
   * Example:
   *
   * Tomato 1 kg
   * Tomato 2 kg
   *
   * can both exist independently in the cart.
   */

  const inCart = Array.isArray(items)
    ? items.find(
        (item) =>
          item.product_id === product.id &&
          (item.variant_label || null) ===
            (selectedVariant?.label || null)
      )
    : null;

  /*
   * ---------------------------------------------------------------
   * Add selected variant
   * ---------------------------------------------------------------
   */

  const handleAddToCart = () => {
    if (stock <= 0) {
      return;
    }

    addItem(
      product,
      1,
      null,
      selectedVariant?.label || null,
      activePrice,
      activeUnit
    );
  };

  /*
   * ---------------------------------------------------------------
   * Quantity controls
   * ---------------------------------------------------------------
   */

  const handleIncrease = () => {
    if (!inCart) {
      return;
    }

    if (inCart.quantity >= stock) {
      return;
    }

    setQuantity(
      lineKey(inCart),
      inCart.quantity + 1
    );
  };

  const handleDecrease = () => {
    if (!inCart) {
      return;
    }

    setQuantity(
      lineKey(inCart),
      inCart.quantity - 1
    );
  };

  return (
    <div
      className="card-base group flex flex-col overflow-hidden hover:border-[#8BA888] hover:shadow-md"
      data-testid={`product-card-${product.slug}`}
    >
      {/* =========================================================
          PRODUCT IMAGE
      ========================================================= */}

      <Link
        to={`/products/${product.slug}`}
        className="relative aspect-square overflow-hidden bg-gray-50"
      >
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Discount */}

        {off > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-[#E07A5F] px-2 py-0.5 text-xs font-semibold text-white">
            {off}% OFF
          </span>
        )}

        {/* Out of Stock */}

        {stock <= 0 && (
          <div className="absolute inset-0 grid place-items-center bg-white/70">
            <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
              Out of stock
            </span>
          </div>
        )}
      </Link>

      {/* =========================================================
          PRODUCT INFORMATION
      ========================================================= */}

      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Unit + Vendor */}

        <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
          <span>
            {selectedVariant
              ? selectedVariant.unit
              : product.unit}
          </span>

          {product.vendor_id &&
            product.vendor_name && (
              <Link
                to={`/vendors/${product.vendor_id}`}
                onClick={(e) =>
                  e.stopPropagation()
                }
                className="max-w-[55%] truncate rounded-full bg-[#8BA888]/15 px-2 py-0.5 text-[10px] font-semibold text-[#1B4332] hover:bg-[#8BA888]/30"
                data-testid={`vendor-badge-${product.slug}`}
              >
                by {product.vendor_name}
              </Link>
            )}
        </div>

        {/* Product Name */}

        <Link
          to={`/products/${product.slug}`}
          className="line-clamp-2 text-sm font-semibold text-[#1A1A1A] hover:text-[#1B4332]"
        >
          {product.name}
        </Link>

        {/* =======================================================
            VARIANT SELECTOR
        ======================================================= */}

        {variants.length > 0 && (
          <div className="mt-1">
            <div className="mb-1.5 text-[11px] font-semibold text-gray-500">
              Select weight
            </div>

            <div className="flex flex-wrap gap-1.5">
              {variants.map((variant) => {
                const selected =
                  selectedVariantLabel ===
                  variant.label;

                const variantStock = Number(
                  variant.stock ??
                    product.stock ??
                    0
                );

                return (
                  <button
                    key={variant.label}
                    type="button"
                    disabled={
                      variantStock <= 0
                    }
                    onClick={() =>
                      setSelectedVariantLabel(
                        variant.label
                      )
                    }
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
                      selected
                        ? "border-[#1B4332] bg-[#1B4332] text-white"
                        : "border-gray-200 bg-white text-[#1B4332] hover:border-[#8BA888] hover:bg-[#8BA888]/10"
                    } ${
                      variantStock <= 0
                        ? "cursor-not-allowed opacity-40"
                        : ""
                    }`}
                    data-testid={`variant-${product.slug}-${variant.label}`}
                  >
                    {variant.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* =======================================================
            PRICE + CART CONTROLS
        ======================================================= */}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          {/* Price */}

          <div>
            <div className="text-lg font-bold text-[#1B4332]">
              {formatINR(activePrice)}
            </div>

            {activeMrp > activePrice && (
              <div className="text-xs text-gray-400 line-through">
                {formatINR(activeMrp)}
              </div>
            )}

            {/* Selected variant */}

            {selectedVariant && (
              <div className="mt-0.5 text-[10px] font-medium text-gray-500">
                {selectedVariant.label}
              </div>
            )}
          </div>

          {/* =====================================================
              CART CONTROLS
          ===================================================== */}

          {inCart ? (
            <div className="flex items-center gap-2 rounded-full border border-[#1B4332] bg-white p-0.5 shadow-sm">
              {/* Decrease */}

              <button
                type="button"
                onClick={
                  handleDecrease
                }
                className="grid h-8 w-8 place-items-center rounded-full text-[#1B4332] transition-colors hover:bg-[#1B4332]/10"
                data-testid={`decrement-${product.slug}`}
                aria-label={`Decrease ${product.name} quantity`}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>

              {/* Quantity */}

              <span
                className="min-w-6 text-center text-sm font-bold text-[#1B4332]"
                data-testid={`qty-${product.slug}`}
              >
                {inCart.quantity}
              </span>

              {/* Increase */}

              <button
                type="button"
                onClick={
                  handleIncrease
                }
                disabled={
                  inCart.quantity >=
                  stock
                }
                className="grid h-8 w-8 place-items-center rounded-full text-[#1B4332] transition-colors hover:bg-[#1B4332]/10 disabled:cursor-not-allowed disabled:opacity-30"
                data-testid={`increment-${product.slug}`}
                aria-label={`Increase ${product.name} quantity`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            /* Add To Cart */

            <button
              type="button"
              disabled={stock <= 0}
              onClick={
                handleAddToCart
              }
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1B4332] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2D6A4F] disabled:cursor-not-allowed disabled:opacity-40"
              data-testid={`add-to-cart-${product.slug}`}
            >
              <ShoppingCart className="h-3.5 w-3.5" />

              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}