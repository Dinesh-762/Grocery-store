import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const CartContext = createContext(null);
const STORAGE_KEY = "ambajogai_cart";

function lineKey(item) {
  return `${item.product_id}::${item.variant_label || ""}::${item.note || ""}`;
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (
    product,
    qty = 1,
    note = null,
    variant_label = null,
    variant_price = null,
    variant_unit = null
  ) => {
    const selectedPrice =
      variant_price !== null && variant_price !== undefined
        ? Number(variant_price)
        : Number(product.price);

    const selectedUnit =
      variant_unit || product.unit || "1 pc";

    setItems((prev) => {
      const idx = prev.findIndex(
        (p) =>
          p.product_id === product.id &&
          (p.variant_label || null) === (variant_label || null) &&
          (p.note || null) === (note || null)
      );

      if (idx >= 0) {
        const next = [...prev];

        next[idx] = {
          ...next[idx],
          quantity: next[idx].quantity + qty,
        };

        return next;
      }

      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          price: selectedPrice,
          image: product.image,
          unit: selectedUnit,
          quantity: qty,
          variant_label: variant_label || null,
          note: note || null,
          vendor_id: product.vendor_id || null,
          vendor_name: product.vendor_name || null,
        },
      ];
    });

    toast.success(
      `${product.name}${variant_label ? ` (${variant_label})` : ""} added to cart`
    );
  };

  const removeItem = (key) => {
    setItems((prev) => prev.filter((p) => lineKey(p) !== key));
  };

  const setQuantity = (key, quantity) => {
    setItems((prev) =>
      prev
        .map((p) =>
          lineKey(p) === key
            ? { ...p, quantity }
            : p
        )
        .filter((p) => p.quantity > 0)
    );
  };

  const clearCart = () => setItems([]);

  const { subtotal, count } = useMemo(() => {
    const s = items.reduce(
      (sum, p) => sum + Number(p.price || 0) * Number(p.quantity || 0),
      0
    );

    const c = items.reduce(
      (sum, p) => sum + Number(p.quantity || 0),
      0
    );

    return {
      subtotal: Math.round(s * 100) / 100,
      count: c,
    };
  }, [items]);

  /*
   * Delivery is calculated from the customer's GPS distance
   * during checkout.
   *
   * Rules:
   * <= 1.5 km  = ₹13 per km
   * > 1.5 km   = ₹20 per km
   */
  const PLATFORM_FEE = 10;

  const GST_RATE = 0.05;
  const CGST_RATE = 0.025;
  const SGST_RATE = 0.025;

  const deliveryFee = 0;

  const platformFee = subtotal > 0 ? PLATFORM_FEE : 0;

  const gstBase = subtotal + platformFee;

  const gst = Math.round(gstBase * GST_RATE * 100) / 100;

  const cgst = Math.round(gstBase * CGST_RATE * 100) / 100;

  const sgst = Math.round(gstBase * SGST_RATE * 100) / 100;

  const total =
    subtotal === 0
      ? 0
      : Math.round(
          (subtotal + platformFee + deliveryFee + gst) * 100
        ) / 100;

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        setQuantity,
        clearCart,

        subtotal,
        deliveryFee,

        platformFee,
        gst,
        cgst,
        sgst,

        total,
        count,

        GST_RATE,
        CGST_RATE,
        SGST_RATE,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}

export { lineKey };