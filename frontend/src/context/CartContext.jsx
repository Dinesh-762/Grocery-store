import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const CartContext = createContext(null);
const STORAGE_KEY = "ambajogai_cart";

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore parse errors */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (product, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.product_id === product.id);
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
        },
      ];
    });
    toast.success(`${product.name} added to cart`);
  };

  const removeItem = (product_id) => {
    setItems((prev) => prev.filter((p) => p.product_id !== product_id));
  };

  const setQuantity = (product_id, quantity) => {
    setItems((prev) =>
      prev
        .map((p) => (p.product_id === product_id ? { ...p, quantity } : p))
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
