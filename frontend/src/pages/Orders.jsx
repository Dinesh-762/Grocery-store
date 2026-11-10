import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { api, formatINR, formatApiError } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";
import { Loader2, Package, ArrowRight, RotateCcw } from "lucide-react";

const STATUS_COLORS = {
  Pending: "bg-yellow-100 text-yellow-800",
  Accepted: "bg-blue-100 text-blue-800",
  Preparing: "bg-blue-100 text-blue-800",
  Packed: "bg-indigo-100 text-indigo-800",
  Ready: "bg-indigo-100 text-indigo-800",
  "Out For Delivery": "bg-orange-100 text-orange-800",
  Delivered: "bg-green-100 text-green-800",
  Cancelled: "bg-red-100 text-red-800",
};

const OPEN_STATUSES = new Set([
  "Pending",
  "Accepted",
  "Preparing",
  "Packed",
  "Ready",
  "Out For Delivery",
]);

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { addItem } = useCart();
  const ordersRef = useRef([]);

  const loadOrders = useCallback(async () => {
    try {
      const { data } = await api.get("/orders/my");
      const next = Array.isArray(data) ? data : [];
      ordersRef.current = next;
      setOrders(next);
      setError("");
    } catch (err) {
      ordersRef.current = [];
      setOrders([]);
      setError(formatApiError(err, "Could not load your orders"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      if (cancelled) return;
      await loadOrders();
    };

    refresh();

    const t = setInterval(() => {
      const hasOpen = ordersRef.current.some((order) =>
        OPEN_STATUSES.has(order.status)
      );
      if (hasOpen || ordersRef.current.length === 0) {
        refresh();
      }
    }, 20000);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [loadOrders]);

  if (loading) {
    return (
      <div className="container-app flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B4332]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-app py-16" data-testid="orders-error">
        <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-white p-10 text-center">
          <h1 className="font-heading text-2xl font-bold text-red-800">Could not load orders</h1>
          <p className="mt-2 text-sm text-[#4A4A4A]">{error}</p>
          <button type="button" onClick={() => { setLoading(true); loadOrders(); }} className="btn-primary mt-6">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="container-app py-16" data-testid="orders-empty">
        <div className="mx-auto max-w-md rounded-2xl border border-[#E5E5E5] bg-white p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#1B4332]/10 text-[#1B4332]">
            <Package className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-heading text-2xl font-bold">No orders yet</h1>
          <p className="mt-2 text-sm text-[#4A4A4A]">Once you place an order, it&apos;ll appear here.</p>
          <Link to="/products" className="btn-primary mt-6 inline-flex">Start shopping</Link>
        </div>
      </div>
    );
  }

  const hasLiveOrders = orders.some((order) => OPEN_STATUSES.has(order.status));

  return (
    <div className="container-app py-8" data-testid="orders-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold sm:text-4xl">My orders</h1>
          <p className="mt-2 text-sm text-[#4A4A4A]">{orders.length} total order{orders.length !== 1 ? "s" : ""}</p>
        </div>
        {hasLiveOrders && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            Live · refreshes every 20s
          </span>
        )}
      </div>

      <div className="mt-8 space-y-4">
        {orders.map((o) => (
          <div
            key={o.id}
            className="card-base flex flex-col gap-4 p-5 hover:border-[#8BA888] md:flex-row md:items-center md:justify-between"
            data-testid={`order-${o.id}`}
          >
            <Link to={`/orders/${o.id}`} className="flex flex-1 items-center gap-4">
              <div className="flex -space-x-3">
                {o.items.slice(0, 3).map((i, idx) => (
                  <img key={idx} src={i.image} alt="" className="h-12 w-12 rounded-full border-2 border-white object-cover" />
                ))}
                {o.items.length > 3 && (
                  <div className="grid h-12 w-12 place-items-center rounded-full border-2 border-white bg-gray-100 text-xs font-semibold">
                    +{o.items.length - 3}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-[#4A4A4A]">Order #{o.id.slice(-6).toUpperCase()}</div>
                <div className="font-semibold">
                  {o.items.length} item{o.items.length !== 1 ? "s" : ""} · {formatINR(o.total)}
                </div>
                <div className="text-xs text-[#4A4A4A]">
                  {new Date(o.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[o.status] || "bg-gray-100"}`}>
                {o.status}
              </span>
              <button
                onClick={async () => {
                  try {
                    const { data } = await api.get(`/orders/${o.id}/reorder`);
                    let added = 0;
                    data.items.forEach((it) => {
                      if (it.in_stock) {
                        addItem({ id: it.product_id, name: it.name, price: it.price, image: it.image, unit: it.unit, stock: 999 }, it.quantity);
                        added += 1;
                      }
                    });
                    if (added === 0) toast.error("None of these items are currently available");
                    else toast.success(`Added ${added} item(s) to cart`);
                  } catch (e) { toast.error(formatApiError(e)); }
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#1B4332] px-3 py-1 text-xs font-semibold text-[#1B4332] hover:bg-[#1B4332]/10"
                data-testid={`reorder-${o.id}`}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Re-order
              </button>
              <Link to={`/orders/${o.id}`} className="grid h-8 w-8 place-items-center rounded-full text-[#1B4332] hover:bg-[#1B4332]/10">
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
