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

const GST_RATE = 0.10;
const CGST_RATE = 0.05;
const SGST_RATE = 0.05;

/*
|--------------------------------------------------------------------------
| Cart Line Key
|--------------------------------------------------------------------------
|
| Same product + same variant = same cart line.
|
| Examples:
|
| Tomato + no variant
| Tomato + 500g
| Tomato + 1kg
|
| These remain separate cart lines.
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
  | Load Cart
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
  | Save Cart
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
  | Variant price is used when a variant is selected.
  | Otherwise product base price is used.
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
    | Validate Product
    |--------------------------------------------------------------------------
    */

    if (!product || !product.id) {
      toast.error("Invalid product.");
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | Validate Quantity
    |--------------------------------------------------------------------------
    */

    const numericQty = Number(qty);

    const safeQty =
      Number.isFinite(numericQty) && numericQty > 0
        ? numericQty
        : 1;

    /*
    |--------------------------------------------------------------------------
    | Determine Variant
    |--------------------------------------------------------------------------
    */

    const hasVariant =
      variant_label !== null &&
      variant_label !== undefined &&
      String(variant_label).trim() !== "";

    /*
    |--------------------------------------------------------------------------
    | Determine Price
    |--------------------------------------------------------------------------
    */

    let selectedPrice;

    if (
      hasVariant &&
      variant_price !== null &&
      variant_price !== undefined &&
      variant_price !== ""
    ) {
      selectedPrice = Number(variant_price);
    } else {
      selectedPrice = Number(product.price || 0);
    }

    /*
    |--------------------------------------------------------------------------
    | Determine Unit
    |--------------------------------------------------------------------------
    */

    const selectedUnit =
      hasVariant && variant_unit
        ? variant_unit
        : product.unit || "1 pc";

    /*
    |--------------------------------------------------------------------------
    | Validate Price
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
    | Normalized Variant Label
    |--------------------------------------------------------------------------
    */

    const normalizedVariantLabel = hasVariant
      ? String(variant_label).trim()
      : null;

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
            normalizedVariantLabel
      );

      /*
      |--------------------------------------------------------------------------
      | Existing Product + Same Variant
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

          /*
           * Always keep the latest selected price.
           */

          price: selectedPrice,

          unit: selectedUnit,

          variant_label:
            normalizedVariantLabel,

          /*
           * Keep note behavior compatible
           * with existing cart implementation.
           */

          note: note || existing.note || null,

          /*
           * Preserve latest vendor information
           * when available.
           */

          vendor_id:
            product.vendor_id ||
            existing.vendor_id ||
            null,

          vendor_name:
            product.vendor_name ||
            existing.vendor_name ||
            null,

          /*
           * Preserve product metadata.
           */

          image:
            product.image ||
            existing.image ||
            null,

          name:
            product.name ||
            existing.name,
        };

        return next;
      }

      /*
      |--------------------------------------------------------------------------
      | New Cart Item
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

          variant_label:
            normalizedVariantLabel,

          note: note || null,

          vendor_id:
            product.vendor_id || null,

          vendor_name:
            product.vendor_name || null,
        },
      ];
    });

    /*
    |--------------------------------------------------------------------------
    | Success Message
    |--------------------------------------------------------------------------
    */

    if (hasVariant) {
      toast.success(
        `${product.name} (${normalizedVariantLabel}) added to cart`
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

        if (
          !Number.isFinite(price) ||
          !Number.isFinite(quantity)
        ) {
          return sum;
        }

        return (
          sum +
          price * quantity
        );
      },
      0
    );

    const calculatedCount = items.reduce(
      (sum, item) => {
        const quantity = Number(
          item.quantity || 0
        );

        return (
          sum +
          (
            Number.isFinite(quantity)
              ? quantity
              : 0
          )
        );
      },
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
  |
  | Existing project logic:
  |
  | taxable amount = subtotal + platform fee
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
  | Delivery Fee
  |--------------------------------------------------------------------------
  |
  | Delivery is calculated separately inside Checkout.jsx
  | because it depends on the customer's delivery location.
  |
  | Current delivery logic:
  |
  | 0 - 1.5 km  -> ₹16 fixed
  | Above 1.5km -> ₹16 + ₹12 per additional km
  |
  | ₹499+ free-delivery rule is handled by Checkout.jsx.
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
  | Context Value
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