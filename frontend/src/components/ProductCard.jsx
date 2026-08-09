import { Link } from "react-router-dom";
import { Plus, Minus, ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { formatINR } from "@/lib/api";

export default function ProductCard({ product }) {
  const { addItem, items, setQuantity } = useCart();
  
  // FIXED: Added Array.isArray check and corrected .find() syntax
  const inCart = Array.isArray(items) ? items.find((i) => i.product_id === product.id) : null;
  
  const off = product.mrp && product.mrp > product.price
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
    : 0;

  return (
    <div
      className="card-base group flex flex-col overflow-hidden hover:border-[#8BA888] hover:shadow-md"
      data-testid={`product-card-${product.slug}`}
    >
      <Link to={`/products/${product.slug}`} className="relative aspect-square overflow-hidden bg-gray-50">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {off > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-[#E07A5F] px-2 py-0.5 text-xs font-semibold text-white">
            {off}% OFF
          </span>
        )}
        {product.stock <= 0 && (
          <div className="absolute inset-0 grid place-items-center bg-white/70">
            <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">Out of stock</span>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
          <span>{product.unit}</span>
          {product.vendor_id && product.vendor_name && (
            <Link
              to={`/vendors/${product.vendor_id}`}
              onClick={(e) => e.stopPropagation()}
              className="max-w-[55%] truncate rounded-full bg-[#8BA888]/15 px-2 py-0.5 text-[10px] font-semibold text-[#1B4332] hover:bg-[#8BA888]/30"
              data-testid={`vendor-badge-${product.slug}`}
            >
              by {product.vendor_name}
            </Link>
          )}
        </div>
        <Link to={`/products/${product.slug}`} className="line-clamp-2 text-sm font-semibold text-[#1A1A1A] hover:text-[#1B4332]">
          {product.name}
        </Link>

        <div className="mt-auto flex items-center justify-between pt-2">
          <div>
            <div className="text-lg font-bold text-[#1B4332]">{formatINR(product.price)}</div>
            {product.mrp && product.mrp > product.price && (
              <div className="text-xs text-gray-400 line-through">{formatINR(product.mrp)}</div>
            )}
          </div>

          {inCart ? (
            <div className="flex items-center gap-2 rounded-full border border-[#1B4332] p-0.5">
              <button
                onClick={() => setQuantity(product.id, inCart.quantity - 1)}
                className="grid h-7 w-7 place-items-center rounded-full text-[#1B4332] hover:bg-[#1B4332]/10"
                data-testid={`decrement-${product.slug}`}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-6 text-center text-sm font-semibold text-[#1B4332]" data-testid={`qty-${product.slug}`}>
                {inCart.quantity}
              </span>
              <button
                onClick={() => setQuantity(product.id, inCart.quantity + 1)}
                className="grid h-7 w-7 place-items-center rounded-full text-[#1B4332] hover:bg-[#1B4332]/10"
                data-testid={`increment-${product.slug}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              disabled={product.stock <= 0}
              onClick={() => addItem(product)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1B4332] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2D6A4F] disabled:cursor-not-allowed disabled:opacity-40"
              data-testid={`add-to-cart-${product.slug}`}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}