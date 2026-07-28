import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, formatINR } from "@/lib/api";
import { Loader2, CheckCircle2, Circle, MapPin, Phone, MessageCircle, Package } from "lucide-react";

const STATUSES = ["Pending", "Accepted", "Preparing", "Packed", "Ready", "Out For Delivery", "Delivered"];

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState({ whatsapp: "+919999999999" });

  useEffect(() => {
    api.get("/store/info").then(({ data }) => setStore(data)).catch(() => {});
    api
      .get(`/orders/${id}`)
      .then(({ data }) => setOrder(data))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="container-app flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B4332]" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container-app py-16 text-center">
        <p className="font-semibold">Order not found.</p>
        <Link to="/orders" className="mt-4 inline-block text-[#1B4332] underline">Back to orders</Link>
      </div>
    );
  }

  const isCancelled = order.status === "Cancelled";
  const currentIdx = STATUSES.indexOf(order.status);
  const num = store.whatsapp.replace(/[^\d]/g, "");
  const helpMsg = encodeURIComponent(`Hi, I need help with my order #${order.id.slice(-6).toUpperCase()}.`);

  return (
    <div className="container-app py-8" data-testid="order-detail-page">
      <Link to="/orders" className="text-sm text-[#4A4A4A] hover:text-[#1B4332]">
        ← All orders
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">Order #{order.id.slice(-6).toUpperCase()}</h1>
          <p className="mt-1 text-sm text-[#4A4A4A]">
            Placed on {new Date(order.created_at).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}
          </p>
        </div>
        <a
          href={`https://wa.me/${num}?text=${helpMsg}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
          data-testid="whatsapp-help"
        >
          <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
        </a>
      </div>

      {/* Tracker */}
      <section className="card-base mt-8 p-6" data-testid="order-tracker">
        <h2 className="font-heading text-lg font-semibold">Order status</h2>
        {isCancelled ? (
          <div className="mt-6 rounded-xl bg-red-50 p-6 text-center">
            <div className="font-heading text-lg font-semibold text-red-700">This order was cancelled</div>
          </div>
        ) : (
          <ol className="mt-6 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            {STATUSES.map((s, i) => {
              const done = i <= currentIdx;
              const active = i === currentIdx;
              return (
                <li key={s} className="relative flex flex-1 items-start gap-3 md:flex-col md:items-center md:gap-2 md:text-center">
                  <div className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-full ${done ? "bg-[#1B4332] text-white" : "bg-gray-100 text-gray-400"}`}>
                    {done ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className={`text-sm font-semibold ${active ? "text-[#E07A5F]" : done ? "text-[#1B4332]" : "text-gray-400"}`}>{s}</div>
                    {order.status_history?.find((h) => h.status === s) && (
                      <div className="text-xs text-[#4A4A4A]">
                        {new Date(order.status_history.find((h) => h.status === s).at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      </div>
                    )}
                  </div>
                  {i < STATUSES.length - 1 && (
                    <div className={`hidden h-0.5 flex-1 md:absolute md:top-4 md:left-[calc(50%+18px)] md:right-[calc(-50%+18px)] md:block ${i < currentIdx ? "bg-[#1B4332]" : "bg-gray-200"}`} />
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Items */}
        <section className="card-base p-6">
          <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold">
            <Package className="h-5 w-5 text-[#1B4332]" /> Items
          </h2>
          <div className="space-y-4">
            {order.items.map((it, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <img src={it.image} alt="" className="h-16 w-16 rounded-xl object-cover" />
                <div className="flex-1">
                  <div className="font-semibold">{it.name}</div>
                  <div className="text-xs text-[#4A4A4A]">{it.unit} · Qty {it.quantity}</div>
                </div>
                <div className="font-semibold text-[#1B4332]">{formatINR(it.price * it.quantity)}</div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="card-base p-6">
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-[#8BA888]">Delivery to</h3>
            <div className="mt-3 space-y-1 text-sm">
              <div className="font-semibold">{order.address.full_name}</div>
              <div className="text-[#4A4A4A] flex items-start gap-1"><MapPin className="mt-0.5 h-3.5 w-3.5" /> {order.address.line1}{order.address.landmark ? `, ${order.address.landmark}` : ""}, {order.address.area}, {order.address.city} - {order.address.pincode}</div>
              <div className="text-[#4A4A4A] flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {order.address.phone}</div>
              {order.notes && <div className="mt-2 text-xs italic text-[#4A4A4A]">Note: {order.notes}</div>}
            </div>
          </section>

          <section className="card-base p-6">
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-[#8BA888]">Payment</h3>
            <div className="mt-2 text-sm">
              <div className="font-semibold">{order.payment_method === "UPI" ? "UPI QR" : "Cash on Delivery"}</div>
            </div>
            <div className="mt-4 space-y-2 border-t border-dashed pt-4 text-sm">
              <Row label="Subtotal" value={formatINR(order.subtotal)} />
              <Row label="Delivery" value={order.delivery_fee === 0 ? "FREE" : formatINR(order.delivery_fee)} />
              {order.discount > 0 && (
                <Row
                  label={`Coupon${order.coupon?.code ? ` (${order.coupon.code})` : ""}`}
                  value={`- ${formatINR(order.discount)}`}
                />
              )}
              <div className="mt-2 flex items-center justify-between border-t border-dashed pt-2">
                <span className="font-semibold">Total</span>
                <span className="font-heading text-xl font-bold text-[#1B4332]">{formatINR(order.total)}</span>
              </div>
            </div>
          </section>
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
