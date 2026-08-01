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

  const addItem = (product, qty = 1, note = null, variant_label = null) => {
    setItems((prev) => {
      const idx = prev.findIndex(
        (p) => p.product_id === product.id && (p.variant_label || null) === (variant_label || null) && (p.note || null) === (note || null)
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        return next;
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          unit: product.unit,
          quantity: qty,
          variant_label: variant_label || null,
          note: note || null,
        },
      ];
    });
    toast.success(`${product.name}${variant_label ? ` (${variant_label})` : ""} added to cart`);
  };

  const removeItem = (key) => {
    setItems((prev) => prev.filter((p) => lineKey(p) !== key));
  };

  const setQuantity = (key, quantity) => {
    setItems((prev) =>
      prev
        .map((p) => (lineKey(p) === key ? { ...p, quantity } : p))
        .filter((p) => p.quantity > 0)
    );
  };

  const clearCart = () => setItems([]);

  const { subtotal, count } = useMemo(() => {
    const s = items.reduce((sum, p) => sum + p.price * p.quantity, 0);
    const c = items.reduce((sum, p) => sum + p.quantity, 0);
    return { subtotal: Math.round(s * 100) / 100, count: c };
  }, [items]);

  const DELIVERY_FEE = 30;
  const FREE_THRESHOLD = 499;
  const deliveryFee = subtotal >= FREE_THRESHOLD || subtotal === 0 ? 0 : DELIVERY_FEE;
  const total = Math.round((subtotal + deliveryFee) * 100) / 100;

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
        total,
        count,
        FREE_THRESHOLD,
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
