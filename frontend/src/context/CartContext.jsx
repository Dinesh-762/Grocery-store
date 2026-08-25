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
| Same product + same variant = same cart line.
|
| Example:
|
| Tomato + no variant
| Tomato + 500g
| Tomato + 1kg
|
| These remain separate lines.
|--------------------------------------------------------------------------
*/

function lineKey(item) {
  return `${item.product_id}::${item.variant_label || ""}`;
}

/*
|--------------------------------------------------------------------------
| Cart Provider
|--------------------------------------------------------------------------
*/

export function CartProvider({ children }) {
  /*
  |--------------------------------------------------------------------------
  | Load cart
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
  |
  | IMPORTANT:
  | Variant/weight is OPTIONAL.
  |
  | If variant is selected:
  |   selected variant price is used.
  |
  | If variant is NOT selected:
  |   product base price is used.
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
    |--------------------------------------------------------------------------
    | Validate product
    |--------------------------------------------------------------------------
    */

    if (!product || !product.id) {
      toast.error("Invalid product.");
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | Validate quantity
    |--------------------------------------------------------------------------
    */

    const numericQty = Number(qty);

    const safeQty =
      Number.isFinite(numericQty) && numericQty > 0
        ? numericQty
        : 1;

    /*
    |--------------------------------------------------------------------------
    | Determine price
    |--------------------------------------------------------------------------
    |
    | Variant price is used ONLY when a variant was actually selected.
    | Otherwise product.price is used.
    |--------------------------------------------------------------------------
    */

    const hasVariant =
      variant_label !== null &&
      variant_label !== undefined &&
      String(variant_label).trim() !== "";

    const selectedPrice =
      hasVariant &&
      variant_price !== null &&
      variant_price !== undefined &&
      variant_price !== ""
        ? Number(variant_price)
        : Number(product.price || 0);

    /*
    |--------------------------------------------------------------------------
    | Determine unit
    |--------------------------------------------------------------------------
    */

    const selectedUnit =
      hasVariant && variant_unit
        ? variant_unit
        : product.unit || "1 pc";

    /*
    |--------------------------------------------------------------------------
    | Validate price
    |--------------------------------------------------------------------------
    */

    if (
      !Number.isFinite(selectedPrice) ||
      selectedPrice < 0
    ) {
      toast.error("Invalid product price.");
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | Add / Merge Cart Item
    |--------------------------------------------------------------------------
    */

    setItems((prev) => {
      const idx = prev.findIndex(
        (item) =>
          item.product_id === product.id &&
          (item.variant_label || null) ===
            (hasVariant
              ? String(variant_label)
              : null)
      );

      /*
      |--------------------------------------------------------------------------
      | Existing product + same variant
      |--------------------------------------------------------------------------
      */

      if (idx >= 0) {
        const next = [...prev];

        const existing = next[idx];

        next[idx] = {
          ...existing,

          quantity:
            Number(existing.quantity || 0) +
            safeQty,

          price: selectedPrice,

          unit: selectedUnit,

          variant_label: hasVariant
            ? String(variant_label)
            : null,

          note: null,

          /*
           * Keep latest vendor information if available.
           */

          vendor_id:
            product.vendor_id ||
            existing.vendor_id ||
            null,

          vendor_name:
            product.vendor_name ||
            existing.vendor_name ||
            null,
        };

        return next;
      }

      /*
      |--------------------------------------------------------------------------
      | New cart item
      |--------------------------------------------------------------------------
      */

      return [
        ...prev,

        {
          product_id: product.id,

          name: product.name,

          price: selectedPrice,

          image: product.image || null,

          unit: selectedUnit,

          quantity: safeQty,

          variant_label: hasVariant
            ? String(variant_label)
            : null,

          note: null,

          vendor_id:
            product.vendor_id || null,

          vendor_name:
            product.vendor_name || null,
        },
      ];
    });

    /*
    |--------------------------------------------------------------------------
    | Success message
    |--------------------------------------------------------------------------
    */

    if (hasVariant) {
      toast.success(
        `${product.name} (${variant_label}) added to cart`
      );
    } else {
      toast.success(
        `${product.name} added to cart`
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Remove Item
  |--------------------------------------------------------------------------
  */

  const removeItem = (key) => {
    setItems((prev) =>
      prev.filter(
        (item) => lineKey(item) !== key
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
    const numericQuantity = Number(quantity);

    const safeQuantity =
      Number.isFinite(numericQuantity)
        ? Math.max(0, numericQuantity)
        : 0;

    setItems((prev) =>
      prev
        .map((item) =>
          lineKey(item) === key
            ? {
                ...item,
                quantity: safeQuantity,
              }
            : item
        )
        .filter(
          (item) =>
            Number(item.quantity || 0) > 0
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
  | Subtotal + Count
  |--------------------------------------------------------------------------
  */

  const { subtotal, count } = useMemo(() => {
    const calculatedSubtotal = items.reduce(
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

    const calculatedCount = items.reduce(
      (sum, item) =>
        sum +
        Number(item.quantity || 0),
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
  | Taxable Amount
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
  | Delivery is calculated separately in Checkout.jsx
  | using customer location.
  |--------------------------------------------------------------------------
  */

  const deliveryFee = 0;

  /*
  |--------------------------------------------------------------------------
  | Total
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
        |--------------------------------------------------------------------------
        | Cart
        |--------------------------------------------------------------------------
        */

        items,

        addItem,

        removeItem,

        setQuantity,

        clearCart,

        /*
        |--------------------------------------------------------------------------
        | Pricing
        |--------------------------------------------------------------------------
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
        |--------------------------------------------------------------------------
        | Rates
        |--------------------------------------------------------------------------
        */

        GST_RATE,

        CGST_RATE,

        SGST_RATE,

        /*
        |--------------------------------------------------------------------------
        | Configuration
        |--------------------------------------------------------------------------
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