import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatINR } from "@/lib/api";
import { Loader2, Package, ArrowRight } from "lucide-react";

const STATUS_COLORS = {
  Pending: "bg-yellow-100 text-yellow-800",
  Confirmed: "bg-blue-100 text-blue-800",
  Packed: "bg-indigo-100 text-indigo-800",
  "Out For Delivery": "bg-orange-100 text-orange-800",
  Delivered: "bg-green-100 text-green-800",
  Cancelled: "bg-red-100 text-red-800",
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/orders/my")
      .then(({ data }) => setOrders(data))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="container-app flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B4332]" />
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

  return (
    <div className="container-app py-8" data-testid="orders-page">
      <h1 className="font-heading text-3xl font-bold sm:text-4xl">My orders</h1>
      <p className="mt-2 text-sm text-[#4A4A4A]">{orders.length} total order{orders.length !== 1 ? "s" : ""}</p>

      <div className="mt-8 space-y-4">
        {orders.map((o) => (
          <Link
            key={o.id}
            to={`/orders/${o.id}`}
            className="card-base flex flex-col gap-4 p-5 hover:border-[#8BA888] md:flex-row md:items-center md:justify-between"
            data-testid={`order-${o.id}`}
          >
            <div className="flex items-center gap-4">
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
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[o.status] || "bg-gray-100"}`}>
                {o.status}
              </span>
              <ArrowRight className="h-4 w-4 text-[#1B4332]" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
