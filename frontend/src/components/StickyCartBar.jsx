import { Link } from "react-router-dom";
import { ShoppingCart, ArrowRight } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatINR } from "@/lib/api";

export default function StickyCartBar() {
  const { count, subtotal } = useCart();

  // Don't show the bar when cart is empty
  if (count === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 left-0 right-0 z-50 px-4 sm:bottom-6"
      data-testid="sticky-cart-bar"
    >
      <div className="mx-auto max-w-2xl">
        <Link
          to="/cart"
          className="flex items-center justify-between gap-3 rounded-2xl bg-[#1B4332] px-4 py-3 text-white shadow-2xl transition-all duration-200 hover:bg-[#2D6A4F] hover:shadow-xl sm:px-5 sm:py-4"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15">
              <ShoppingCart className="h-5 w-5" />

              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#E07A5F] px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            </div>

            <div className="min-w-0">
              <p className="text-xs font-medium text-white/75">
                {count} {count === 1 ? "item" : "items"} in cart
              </p>

              <p className="truncate text-sm font-bold sm:text-base">
                {formatINR(subtotal)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#1B4332]">
            <span className="hidden sm:inline">View Cart</span>
            <span className="sm:hidden">Cart</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </Link>
      </div>
    </div>
  );
}