import { Link, useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { formatINR } from "@/lib/api";
import { Minus, Plus, X, ShoppingBag, ArrowRight } from "lucide-react";

export default function Cart() {
  const { items, setQuantity, removeItem, subtotal, deliveryFee, total, FREE_THRESHOLD } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const goCheckout = () => {
    if (!user) navigate("/login", { state: { from: "/checkout" } });
    else navigate("/checkout");
  };

  if (items.length === 0) {
    return (
      <div className="container-app py-16" data-testid="cart-empty">
        <div className="mx-auto max-w-md rounded-2xl border border-[#E5E5E5] bg-white p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#1B4332]/10 text-[#1B4332]">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-heading text-2xl font-bold">Your cart is empty</h1>
          <p className="mt-2 text-sm text-[#4A4A4A]">Add some fresh produce to get started.</p>
          <Link to="/products" className="btn-primary mt-6 inline-flex">
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  const toGo = FREE_THRESHOLD - subtotal;

  return (
    <div className="container-app py-8" data-testid="cart-page">
      <h1 className="font-heading text-3xl font-bold sm:text-4xl">Your cart</h1>
      <p className="mt-2 text-sm text-[#4A4A4A]">{items.length} item{items.length !== 1 ? "s" : ""}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {items.map((it) => (
            <div
              key={it.product_id}
              className="card-base flex gap-4 p-4"
              data-testid={`cart-item-${it.product_id}`}
            >
              <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-gray-50">
                <img src={it.image} alt={it.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[#1A1A1A]">{it.name}</div>
                      <div className="text-xs text-gray-500">{it.unit}</div>
                    </div>
                    <button
                      onClick={() => removeItem(it.product_id)}
                      className="text-gray-400 hover:text-red-500"
                      aria-label="Remove"
                      data-testid={`remove-${it.product_id}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-1 text-sm text-[#4A4A4A]">{formatINR(it.price)} each</div>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 rounded-full border border-[#1B4332] p-0.5">
                    <button
                      onClick={() => setQuantity(it.product_id, it.quantity - 1)}
                      className="grid h-7 w-7 place-items-center rounded-full text-[#1B4332] hover:bg-[#1B4332]/10"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-6 text-center text-sm font-semibold text-[#1B4332]">{it.quantity}</span>
                    <button
                      onClick={() => setQuantity(it.product_id, it.quantity + 1)}
                      className="grid h-7 w-7 place-items-center rounded-full text-[#1B4332] hover:bg-[#1B4332]/10"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="font-bold text-[#1B4332]">{formatINR(it.price * it.quantity)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="card-base sticky top-24 h-fit p-6" data-testid="cart-summary">
          <h2 className="font-heading text-lg font-semibold">Order summary</h2>
          <div className="mt-4 space-y-2 text-sm">
            <Row label="Subtotal" value={formatINR(subtotal)} />
            <Row label="Delivery fee" value={deliveryFee === 0 ? "FREE" : formatINR(deliveryFee)} />
            {toGo > 0 && (
              <div className="rounded-xl bg-[#E07A5F]/10 p-3 text-xs text-[#E07A5F]">
                Add {formatINR(toGo)} more for free delivery
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-dashed pt-4">
            <div className="text-sm font-semibold">Total</div>
            <div className="font-heading text-2xl font-bold text-[#1B4332]" data-testid="cart-total">
              {formatINR(total)}
            </div>
          </div>
          <button onClick={goCheckout} className="btn-primary mt-6 w-full" data-testid="checkout-btn">
            Proceed to Checkout <ArrowRight className="h-4 w-4" />
          </button>
          <Link to="/products" className="mt-3 block text-center text-sm text-[#4A4A4A] hover:text-[#1B4332]">
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#4A4A4A]">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
