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
   * ---------------------------------------------------------------
   * Selected variant
   * ---------------------------------------------------------------
   */

  const [selectedVariantLabel, setSelectedVariantLabel] =
    useState(
      variants.length > 0
        ? variants[0].label
        : null
    );

  /*
   * ---------------------------------------------------------------
   * Get currently selected variant
   * ---------------------------------------------------------------
   */

  const selectedVariant = useMemo(() => {
    if (!selectedVariantLabel) {
      return null;
    }

    return (
      variants.find(
        (variant) =>
          variant.label === selectedVariantLabel
      ) || null
    );
  }, [variants, selectedVariantLabel]);

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
   *
   * IMPORTANT:
   * This remains fixed at 10%.
   * It does NOT change the actual product price.
   */

  const off = 10;

  /*
   * ---------------------------------------------------------------
   * Stock
   * ---------------------------------------------------------------
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
      {
        ...product,
        price: activePrice,
        unit: activeUnit,
      },
      1,
      null,
      selectedVariant?.label || null
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
      className="card-base group flex flex-col overflow-hidden rounded-2xl hover:border-[#8BA888] hover:shadow-md"
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

        {/* Discount Badge */}

        {off > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-[#16A34A] px-3 py-1 text-xs font-semibold text-white shadow-sm">
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

      <div className="flex flex-1 flex-col p-4">

        {/* Product Name */}

        <Link
          to={`/products/${product.slug}`}
          className="mb-3 line-clamp-2 text-base font-bold text-[#111827] hover:text-[#1B4332]"
        >
          {product.name}
        </Link>

        {/* =======================================================
            VARIANT DROPDOWN
        ======================================================= */}

        {variants.length > 0 && (
          <div className="mb-4">
            <select
              value={selectedVariantLabel || ""}
              onChange={(e) =>
                setSelectedVariantLabel(e.target.value)
              }
              className="h-12 w-full cursor-pointer appearance-none rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-[#111827] outline-none transition-all hover:border-[#8BA888] focus:border-[#1B4332] focus:ring-2 focus:ring-[#1B4332]/10"
              data-testid={`variant-select-${product.slug}`}
            >
              {variants.map((variant) => {
                const variantStock = Number(
                  variant.stock ??
                    product.stock ??
                    0
                );

                return (
                  <option
                    key={variant.label}
                    value={variant.label}
                    disabled={variantStock <= 0}
                  >
                    {variant.label} - {formatINR(variant.price)}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* =======================================================
            PRICE
        ======================================================= */}

        <div className="mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-[#111827]">
              {formatINR(activePrice)}
            </span>

            {activeMrp > activePrice && (
              <span className="text-sm text-gray-400 line-through">
                {formatINR(activeMrp)}
              </span>
            )}
          </div>

          {/* Selected unit */}

          <div className="mt-1 text-sm text-gray-500">
            {activeUnit}
          </div>
        </div>

        {/* =======================================================
            CART CONTROLS
        ======================================================= */}

        <div className="mt-auto w-full">
          {inCart ? (
            <div className="flex h-12 w-full items-center justify-between rounded-xl border border-[#1B4332] bg-white px-2 shadow-sm">
              
              {/* Decrease */}

              <button
                type="button"
                onClick={handleDecrease}
                className="grid h-9 w-9 place-items-center rounded-lg text-[#1B4332] transition-colors hover:bg-[#1B4332]/10"
                data-testid={`decrement-${product.slug}`}
                aria-label={`Decrease ${product.name} quantity`}
              >
                <Minus className="h-4 w-4" />
              </button>

              {/* Quantity */}

              <span
                className="text-base font-bold text-[#1B4332]"
                data-testid={`qty-${product.slug}`}
              >
                {inCart.quantity}
              </span>

              {/* Increase */}

              <button
                type="button"
                onClick={handleIncrease}
                disabled={inCart.quantity >= stock}
                className="grid h-9 w-9 place-items-center rounded-lg text-[#1B4332] transition-colors hover:bg-[#1B4332]/10 disabled:cursor-not-allowed disabled:opacity-30"
                data-testid={`increment-${product.slug}`}
                aria-label={`Increase ${product.name} quantity`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          ) : (
            /* Add To Cart */

            <button
              type="button"
              disabled={stock <= 0}
              onClick={handleAddToCart}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#16A34A] px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#15803D] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
              data-testid={`add-to-cart-${product.slug}`}
            >
              <ShoppingCart className="h-5 w-5" />

              Add to Cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}