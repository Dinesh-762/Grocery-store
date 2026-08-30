import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart, lineKey } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { formatINR } from "@/lib/api";
import { FREE_DELIVERY_THRESHOLD } from "@/lib/deliveryFee";
import CartFlowHeader, { SummaryCard } from "@/components/CartFlowHeader";
import {
  Minus,
  Plus,
  X,
  ShoppingBag,
  ArrowRight,
  Trash2,
  Truck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export default function Cart() {
  const { items, setQuantity, removeItem, removeItems } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedKeys, setSelectedKeys] = useState(() => new Set(items.map(lineKey)));

  useEffect(() => {
    setSelectedKeys((prev) => {
      const allKeys = items.map(lineKey);
      if (allKeys.length === 0) return new Set();

      const valid = new Set(allKeys);
      const next = new Set([...prev].filter((k) => valid.has(k)));
      for (const key of allKeys) {
        if (!prev.has(key)) next.add(key);
      }
      return next;
    });
  }, [items]);

  const selectedItems = useMemo(
    () => items.filter((it) => selectedKeys.has(lineKey(it))),
    [items, selectedKeys]
  );

  const selectedSubtotal = useMemo(
    () =>
      Math.round(
        selectedItems.reduce((sum, it) => sum + it.price * it.quantity, 0) * 100
      ) / 100,
    [selectedItems]
  );

  const selectedCount = useMemo(
    () => selectedItems.reduce((sum, it) => sum + it.quantity, 0),
    [selectedItems]
  );

  const allSelected = items.length > 0 && selectedKeys.size === items.length;
  const someSelected = selectedKeys.size > 0 && selectedKeys.size < items.length;

  const freeDeliveryProgress = Math.min(100, (selectedSubtotal / FREE_DELIVERY_THRESHOLD) * 100);
  const toGo = Math.max(0, FREE_DELIVERY_THRESHOLD - selectedSubtotal);

  const toggleItem = (key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelectedKeys(new Set());
    else setSelectedKeys(new Set(items.map(lineKey)));
  };

  const removeSelected = () => {
    if (selectedKeys.size === 0) return;
    removeItems([...selectedKeys]);
    toast.success(`Removed ${selectedKeys.size} item(s) from cart`);
    setSelectedKeys(new Set());
  };

  const goCheckout = () => {
    if (selectedKeys.size === 0) {
      toast.error("Select at least one item to checkout");
      return;
    }
    const keys = [...selectedKeys];
    if (!user) navigate("/login", { state: { from: "/checkout", selectedKeys: keys } });
    else navigate("/checkout", { state: { selectedKeys: keys } });
  };

  if (items.length === 0) {
    return (
      <div className="container-app py-8 sm:py-12" data-testid="cart-empty">
        <CartFlowHeader active="cart" backTo="/products" backLabel="Continue shopping" />
        <div className="mx-auto max-w-md rounded-2xl border border-[#E5E5E5] bg-white p-8 text-center shadow-sm sm:p-10">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-[#1B4332]/10 to-[#8BA888]/20 text-[#1B4332]">
            <ShoppingBag className="h-9 w-9" />
          </div>
          <h1 className="mt-6 font-heading text-2xl font-bold text-[#1B4332]">Your cart is empty</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#4A4A4A]">
            Fresh groceries are waiting — browse our store and add items to get started.
          </p>
          <Link to="/products" className="btn-primary mt-8 inline-flex">
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`container-app py-6 sm:py-8 ${selectedKeys.size > 0 ? "pb-28 sm:pb-32" : ""}`}
      data-testid="cart-page"
    >
      <CartFlowHeader active="cart" backTo="/products" backLabel="Continue shopping" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1B4332] sm:text-3xl">Your cart</h1>
          <p className="mt-1.5 text-sm text-[#4A4A4A]">
            {items.length} line{items.length !== 1 ? "s" : ""}
            {selectedKeys.size > 0 && selectedKeys.size < items.length && (
              <span className="text-[#E07A5F]"> · {selectedKeys.size} selected for checkout</span>
            )}
          </p>
        </div>
        <label className="inline-flex w-fit cursor-pointer items-center gap-2.5 rounded-full border border-[#E5E5E5] bg-white px-4 py-2.5 text-sm font-semibold text-[#1B4332] shadow-sm transition-colors hover:border-[#8BA888]">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-gray-300 text-[#1B4332] focus:ring-[#1B4332]"
            data-testid="cart-select-all"
          />
          Select all
        </label>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div className="space-y-3 sm:space-y-4">
          {items.map((it) => {
            const k = lineKey(it);
            const checked = selectedKeys.has(k);
            return (
              <article
                key={k}
                className={`group overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 ${
                  checked
                    ? "border-[#8BA888] ring-1 ring-[#8BA888]/30"
                    : "border-gray-100 opacity-95 hover:border-gray-200"
                }`}
                data-testid={`cart-item-${k}`}
              >
                <div className="flex gap-3 p-3 sm:gap-4 sm:p-4">
                  <label className="flex shrink-0 cursor-pointer items-start pt-2 sm:pt-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(k)}
                      className="h-4 w-4 rounded border-gray-300 text-[#1B4332] focus:ring-[#1B4332]"
                      data-testid={`cart-select-${k}`}
                      aria-label={`Select ${it.name}`}
                    />
                  </label>

                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-50 ring-1 ring-black/5 sm:h-24 sm:w-24">
                    <img src={it.image} alt={it.name} className="h-full w-full object-cover" />
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-[#1A1A1A] sm:text-base">{it.name}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {it.variant_label && (
                            <span className="rounded-full bg-[#8BA888]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1B4332]">
                              {it.variant_label}
                            </span>
                          )}
                          <span className="text-xs text-gray-500">{it.unit}</span>
                        </div>
                        {it.note && (
                          <p className="mt-1 line-clamp-2 text-xs italic text-[#4A4A4A]">Note: {it.note}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(k)}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        aria-label="Remove item"
                        data-testid={`remove-${k}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                      <div className="flex items-center gap-1 rounded-full border border-[#1B4332]/30 bg-[#FAFAFA] p-0.5">
                        <button
                          type="button"
                          onClick={() => setQuantity(k, it.quantity - 1)}
                          className="grid h-8 w-8 place-items-center rounded-full text-[#1B4332] transition-colors hover:bg-[#1B4332]/10"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-7 text-center text-sm font-bold text-[#1B4332]">
                          {it.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(k, it.quantity + 1)}
                          className="grid h-8 w-8 place-items-center rounded-full text-[#1B4332] transition-colors hover:bg-[#1B4332]/10"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-[#4A4A4A]">{formatINR(it.price)} each</div>
                        <div className="font-heading text-base font-bold text-[#1B4332] sm:text-lg">
                          {formatINR(it.price * it.quantity)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <SummaryCard title="Order summary" icon={ShoppingBag} testId="cart-summary">
          {selectedKeys.size === 0 ? (
            <div className="rounded-xl bg-[#FAFAFA] p-4 text-center text-sm text-[#4A4A4A]">
              Select items to see totals and proceed to checkout.
            </div>
          ) : (
            <>
              {selectedSubtotal > 0 && selectedSubtotal < FREE_DELIVERY_THRESHOLD && (
                <div className="mb-4 rounded-xl border border-[#E07A5F]/20 bg-[#E07A5F]/5 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1 text-[#E07A5F]">
                      <Truck className="h-3.5 w-3.5" />
                      Free delivery at {formatINR(FREE_DELIVERY_THRESHOLD)}
                    </span>
                    <span className="text-[#4A4A4A]">{Math.round(freeDeliveryProgress)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#E07A5F] to-[#1B4332] transition-all duration-500"
                      style={{ width: `${freeDeliveryProgress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-[#4A4A4A]">
                    Add <strong className="text-[#1B4332]">{formatINR(toGo)}</strong> more for free delivery
                  </p>
                </div>
              )}

              {selectedSubtotal >= FREE_DELIVERY_THRESHOLD && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-xs font-medium text-green-800">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  You qualify for free delivery!
                </div>
              )}

              <div className="space-y-2.5 text-sm">
                <Row
                  label={`Subtotal (${selectedCount} item${selectedCount !== 1 ? "s" : ""})`}
                  value={formatINR(selectedSubtotal)}
                />
                <Row label="Delivery & fees" value="At checkout" muted />
              </div>

              <p className="mt-3 text-xs leading-relaxed text-[#4A4A4A]">
                Delivery, platform fee, and GST are calculated at checkout based on your address.
              </p>

              <div className="mt-4 flex items-center justify-between border-t border-dashed border-[#E5E5E5] pt-4">
                <span className="text-sm font-semibold text-[#4A4A4A]">Estimated subtotal</span>
                <span className="font-heading text-2xl font-bold text-[#1B4332]" data-testid="cart-total">
                  {formatINR(selectedSubtotal)}
                </span>
              </div>

              <button
                type="button"
                onClick={goCheckout}
                className="btn-primary mt-5 w-full py-3.5"
                data-testid="checkout-btn"
              >
                Proceed to checkout
                <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}

          <Link
            to="/products"
            className="mt-4 block text-center text-sm font-medium text-[#4A4A4A] transition-colors hover:text-[#1B4332]"
          >
            Continue shopping
          </Link>
        </SummaryCard>
      </div>

      {selectedKeys.size > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[60] border-t border-[#E5E5E5] bg-white/95 px-4 py-3 shadow-[0_-8px_32px_rgba(27,67,50,0.12)] backdrop-blur-md sm:hidden"
          data-testid="cart-selection-bar"
        >
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#4A4A4A]">
                {selectedCount} item{selectedCount !== 1 ? "s" : ""} · checkout
              </p>
              <p className="truncate font-heading text-xl font-bold text-[#1B4332]">
                {formatINR(selectedSubtotal)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={removeSelected}
                className="grid h-10 w-10 place-items-center rounded-full border border-red-200 text-red-600 hover:bg-red-50"
                data-testid="cart-remove-selected"
                aria-label="Remove selected"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goCheckout}
                className="btn-primary px-5 py-2.5 text-sm"
                data-testid="cart-checkout-selected"
              >
                Checkout
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, muted = false }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={muted ? "text-[#8BA888]" : "text-[#4A4A4A]"}>{label}</span>
      <span className={`font-semibold ${muted ? "text-[#8BA888]" : "text-[#1B4332]"}`}>{value}</span>
    </div>
  );
}
