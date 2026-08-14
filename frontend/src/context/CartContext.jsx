import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

const CartContext = createContext(null);

const STORAGE_KEY = "ambajogai_cart";

/*
|--------------------------------------------------------------------------
| Pricing Configuration
|--------------------------------------------------------------------------
|
| Product price comes from the selected variant.
|
| Example:
|
| Tomato
| 500g = ₹20
| 1kg  = ₹30
| 2kg  = ₹55
| 3kg  = ₹80
| 4kg  = ₹105
| 5kg  = ₹130
|
| Platform fee = ₹10
|
| Tax:
| CGST = 2.5%
| SGST = 2.5%
| Total GST = 5%
|
| Delivery is calculated separately during checkout.
|--------------------------------------------------------------------------
*/

const PLATFORM_FEE = 10;

const GST_RATE = 0.05;
const CGST_RATE = 0.025;
const SGST_RATE = 0.025;

/*
|--------------------------------------------------------------------------
| Cart Line Key
|--------------------------------------------------------------------------
|
| Different variants of the same product must remain separate.
|
| Example:
|
| Tomato + 500g
| Tomato + 1kg
|
| These are two different cart lines.
|--------------------------------------------------------------------------
*/

function lineKey(item) {
  return `${item.product_id}::${item.variant_label || ""}`;
}

export function CartProvider({ children }) {
  /*
  |--------------------------------------------------------------------------
  | Load cart from localStorage
  |--------------------------------------------------------------------------
  */

  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  /*
  |--------------------------------------------------------------------------
  | Save cart
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(items)
      );
    } catch {
      // Ignore localStorage errors.
    }
  }, [items]);

  /*
  |--------------------------------------------------------------------------
  | Add Item
  |--------------------------------------------------------------------------
  */

  const addItem = (
    product,
    qty = 1,
    note = null,
    variant_label = null,
    variant_price = null,
    variant_unit = null
  ) => {
    /*
     * --------------------------------------------------------------
     * Validate quantity
     * --------------------------------------------------------------
     */

    const safeQty = Math.max(
      1,
      Number(qty || 1)
    );

    /*
     * --------------------------------------------------------------
     * Determine selected variant price
     * --------------------------------------------------------------
     */

    const selectedPrice =
      variant_price !== null &&
      variant_price !== undefined &&
      variant_price !== ""
        ? Number(variant_price)
        : Number(product.price || 0);

    /*
     * --------------------------------------------------------------
     * Determine selected variant unit
     * --------------------------------------------------------------
     */

    const selectedUnit =
      variant_unit ||
      variant_label ||
      product.unit ||
      "1 pc";

    /*
     * --------------------------------------------------------------
     * Basic price validation
     * --------------------------------------------------------------
     */

    if (
      !Number.isFinite(selectedPrice) ||
      selectedPrice < 0
    ) {
      toast.error(
        "Invalid product price."
      );

      return;
    }

    /*
     * --------------------------------------------------------------
     * Variant is compulsory
     * --------------------------------------------------------------
     */

    if (!variant_label) {
      toast.error(
        "Please select a weight before adding the product."
      );

      return;
    }

    /*
     * --------------------------------------------------------------
     * Add / merge item
     * --------------------------------------------------------------
     */

    setItems((prev) => {
      const idx = prev.findIndex(
        (p) =>
          p.product_id === product.id &&
          (p.variant_label || null) ===
            (variant_label || null)
      );

      /*
       * Existing same product + same variant
       * => increase quantity.
       */

      if (idx >= 0) {
        const next = [...prev];

        next[idx] = {
          ...next[idx],

          quantity:
            Number(next[idx].quantity || 0) +
            safeQty,

          /*
           * Always keep the latest selected
           * variant price/unit.
           */

          price: selectedPrice,

          unit: selectedUnit,

          variant_label:
            variant_label || null,

          /*
           * Custom note is no longer used by
           * ProductDetail.
           */

          note: null,
        };

        return next;
      }

      /*
       * New cart line.
       */

      return [
        ...prev,

        {
          product_id: product.id,

          name: product.name,

          /*
           * IMPORTANT:
           * This is the selected variant price.
           */

          price: selectedPrice,

          image: product.image,

          unit: selectedUnit,

          quantity: safeQty,

          variant_label:
            variant_label || null,

          note: null,

          vendor_id:
            product.vendor_id || null,

          vendor_name:
            product.vendor_name || null,
        },
      ];
    });

    toast.success(
      `${product.name} (${variant_label}) added to cart`
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Remove Item
  |--------------------------------------------------------------------------
  */

  const removeItem = (key) => {
    setItems((prev) =>
      prev.filter(
        (p) => lineKey(p) !== key
      )
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Set Quantity
  |--------------------------------------------------------------------------
  */

  const setQuantity = (
    key,
    quantity
  ) => {
    const safeQuantity = Math.max(
      0,
      Number(quantity || 0)
    );

    setItems((prev) =>
      prev
        .map((p) =>
          lineKey(p) === key
            ? {
                ...p,
                quantity: safeQuantity,
              }
            : p
        )
        .filter(
          (p) =>
            Number(p.quantity || 0) > 0
        )
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Clear Cart
  |--------------------------------------------------------------------------
  */

  const clearCart = () => {
    setItems([]);
  };

  /*
  |--------------------------------------------------------------------------
  | Subtotal
  |--------------------------------------------------------------------------
  */

  const { subtotal, count } = useMemo(() => {
    const calculatedSubtotal =
      items.reduce(
        (sum, item) => {
          const price = Number(
            item.price || 0
          );

          const quantity = Number(
            item.quantity || 0
          );

          return (
            sum +
            price * quantity
          );
        },
        0
      );

    const calculatedCount =
      items.reduce(
        (sum, item) =>
          sum +
          Number(
            item.quantity || 0
          ),
        0
      );

    return {
      subtotal:
        Math.round(
          calculatedSubtotal * 100
        ) / 100,

      count: calculatedCount,
    };
  }, [items]);

  /*
  |--------------------------------------------------------------------------
  | Platform Fee
  |--------------------------------------------------------------------------
  */

  const platformFee =
    subtotal > 0
      ? PLATFORM_FEE
      : 0;

  /*
  |--------------------------------------------------------------------------
  | Tax Base
  |--------------------------------------------------------------------------
  |
  | Product subtotal + platform fee.
  |
  | Delivery is calculated at checkout.
  |--------------------------------------------------------------------------
  */

  const taxableAmount =
    subtotal +
    platformFee;

  /*
  |--------------------------------------------------------------------------
  | CGST
  |--------------------------------------------------------------------------
  */

  const cgst =
    subtotal > 0
      ? Math.round(
          taxableAmount *
            CGST_RATE *
            100
        ) / 100
      : 0;

  /*
  |--------------------------------------------------------------------------
  | SGST
  |--------------------------------------------------------------------------
  */

  const sgst =
    subtotal > 0
      ? Math.round(
          taxableAmount *
            SGST_RATE *
            100
        ) / 100
      : 0;

  /*
  |--------------------------------------------------------------------------
  | Total GST
  |--------------------------------------------------------------------------
  */

  const gst =
    Math.round(
      (cgst + sgst) * 100
    ) / 100;

  /*
  |--------------------------------------------------------------------------
  | Delivery
  |--------------------------------------------------------------------------
  |
  | Actual delivery fee is calculated by Checkout.jsx
  | using the customer's GPS location.
  |
  | CartContext keeps it at 0 until checkout.
  |--------------------------------------------------------------------------
  */

  const deliveryFee = 0;

  /*
  |--------------------------------------------------------------------------
  | Cart Total
  |--------------------------------------------------------------------------
  |
  | This is the cart-side total before actual GPS delivery.
  |--------------------------------------------------------------------------
  */

  const total =
    subtotal === 0
      ? 0
      : Math.round(
          (
            subtotal +
            platformFee +
            gst +
            deliveryFee
          ) * 100
        ) / 100;

  /*
  |--------------------------------------------------------------------------
  | Context
  |--------------------------------------------------------------------------
  */

  return (
    <CartContext.Provider
      value={{
        /*
         * Cart
         */

        items,

        addItem,

        removeItem,

        setQuantity,

        clearCart,

        /*
         * Pricing
         */

        subtotal,

        platformFee,

        deliveryFee,

        taxableAmount,

        gst,

        cgst,

        sgst,

        total,

        count,

        /*
         * Rates
         */

        GST_RATE,

        CGST_RATE,

        SGST_RATE,

        /*
         * Configuration
         */

        PLATFORM_FEE,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

/*
|--------------------------------------------------------------------------
| useCart Hook
|--------------------------------------------------------------------------
*/

export function useCart() {
  return useContext(CartContext);
}

/*
|--------------------------------------------------------------------------
| Export lineKey
|--------------------------------------------------------------------------
*/

export { lineKey };