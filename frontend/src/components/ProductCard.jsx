import React, { useMemo, useState } from "react";
import { ShoppingCart, Plus, Minus } from "lucide-react";
import { useCart } from "../context/CartContext";

export default function ProductCard({ product }) {
  const {
    addItem,
    items,
    setQuantity,
    removeItem,
  } = useCart();

  const variants = useMemo(() => {
    if (!Array.isArray(product?.variants)) {
      return [];
    }

    return product.variants.filter(
      (variant) =>
        variant &&
        variant.label &&
        Number.isFinite(Number(variant.price))
    );
  }, [product]);

  /*
  |--------------------------------------------------------------------------
  | Variant Selection
  |--------------------------------------------------------------------------
  */

  const [selectedVariant, setSelectedVariant] = useState(
    variants.length > 0 ? variants[0] : null
  );

  /*
  |--------------------------------------------------------------------------
  | Selected Price
  |--------------------------------------------------------------------------
  */

  const selectedPrice = selectedVariant
    ? Number(selectedVariant.price)
    : Number(product?.price || 0);

  /*
  |--------------------------------------------------------------------------
  | Selected Unit
  |--------------------------------------------------------------------------
  */

  const selectedUnit = selectedVariant
    ? selectedVariant.unit ||
      selectedVariant.label ||
      product?.unit ||
      "1 pc"
    : product?.unit || "1 pc";

  /*
  |--------------------------------------------------------------------------
  | Cart Key
  |--------------------------------------------------------------------------
  */

  const cartKey = `${product?.id}::${
    selectedVariant?.label || ""
  }`;

  /*
  |--------------------------------------------------------------------------
  | Current Cart Item
  |--------------------------------------------------------------------------
  */

  const cartItem = items.find((item) => {
    return (
      item.product_id === product?.id &&
      (item.variant_label || null) ===
        (selectedVariant?.label || null)
    );
  });

  const quantity = Number(
    cartItem?.quantity || 0
  );

  /*
  |--------------------------------------------------------------------------
  | Add To Cart
  |--------------------------------------------------------------------------
  */

  const handleAddToCart = () => {
    if (!product?.id) {
      return;
    }

    if (
      !Number.isFinite(selectedPrice) ||
      selectedPrice < 0
    ) {
      return;
    }

    addItem(
      product,
      1,
      null,
      selectedVariant?.label || null,
      selectedPrice,
      selectedUnit
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Increase Quantity
  |--------------------------------------------------------------------------
  */

  const handleIncrease = () => {
    addItem(
      product,
      1,
      null,
      selectedVariant?.label || null,
      selectedPrice,
      selectedUnit
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Decrease Quantity
  |--------------------------------------------------------------------------
  */

  const handleDecrease = () => {
    if (!cartItem) {
      return;
    }

    if (quantity <= 1) {
      removeItem(cartKey);
      return;
    }

    setQuantity(
      cartKey,
      quantity - 1
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Product Image
  |--------------------------------------------------------------------------
  */

  const image =
    product?.image ||
    product?.image_url ||
    "/placeholder-product.png";

  /*
  |--------------------------------------------------------------------------
  | MRP
  |--------------------------------------------------------------------------
  */

  const mrp = selectedVariant
    ? Number(
        selectedVariant.mrp ||
        selectedVariant.compare_at_price ||
        0
      )
    : Number(
        product?.mrp ||
        product?.compare_at_price ||
        0
      );

  /*
  |--------------------------------------------------------------------------
  | Discount
  |--------------------------------------------------------------------------
  */

  const discount =
    mrp > selectedPrice
      ? Math.round(
          ((mrp - selectedPrice) /
            mrp) *
            100
        )
      : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Image */}

      <div className="relative bg-gray-50 aspect-square overflow-hidden">
        <img
          src={image}
          alt={product?.name || "Product"}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.src =
              "/placeholder-product.png";
          }}
        />

        {discount > 0 && (
          <span className="absolute top-2 left-2 bg-green-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
            {discount}% OFF
          </span>
        )}
      </div>

      {/* Content */}

      <div className="p-3">
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 min-h-[40px]">
          {product?.name}
        </h3>

        {/* Variant Selector */}

        {variants.length > 0 && (
          <div className="mt-2">
            <select
              value={
                selectedVariant?.label || ""
              }
              onChange={(event) => {
                const variant =
                  variants.find(
                    (item) =>
                      String(item.label) ===
                      event.target.value
                  );

                setSelectedVariant(
                  variant || null
                );
              }}
              className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white outline-none focus:border-green-500"
            >
              {variants.map(
                (variant, index) => (
                  <option
                    key={`${variant.label}-${index}`}
                    value={variant.label}
                  >
                    {variant.label} - ₹
                    {Number(
                      variant.price
                    ).toFixed(0)}
                  </option>
                )
              )}
            </select>
          </div>
        )}

        {/* Price */}

        <div className="flex items-center gap-2 mt-3">
          <span className="text-lg font-bold text-gray-900">
            ₹{selectedPrice.toFixed(0)}
          </span>

          {mrp > selectedPrice && (
            <span className="text-xs text-gray-400 line-through">
              ₹{mrp.toFixed(0)}
            </span>
          )}
        </div>

        <div className="text-xs text-gray-500 mt-1">
          {selectedUnit}
        </div>

        {/* Cart Controls */}

        <div className="mt-3">
          {quantity <= 0 ? (
            <button
              type="button"
              onClick={handleAddToCart}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl transition-colors"
            >
              <ShoppingCart size={17} />
              Add to Cart
            </button>
          ) : (
            <div className="w-full flex items-center justify-between border border-green-600 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={handleDecrease}
                className="w-11 h-10 flex items-center justify-center text-green-700 hover:bg-green-50"
                aria-label="Decrease quantity"
              >
                <Minus size={17} />
              </button>

              <span className="font-semibold text-gray-900">
                {quantity}
              </span>

              <button
                type="button"
                onClick={handleIncrease}
                className="w-11 h-10 flex items-center justify-center text-green-700 hover:bg-green-50"
                aria-label="Increase quantity"
              >
                <Plus size={17} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}