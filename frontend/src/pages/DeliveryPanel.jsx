import { useEffect, useState, useCallback, useRef } from "react";
import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import { api, formatINR, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { playAlert } from "@/lib/audioAlert";
import {
  LayoutDashboard,
  ShoppingBag,
  History,
  Loader2,
  IndianRupee,
  MapPin,
  Phone,
  MessageCircle,
  CheckCircle2,
  Truck,
  Ban,
} from "lucide-react";

const links = [
  { to: "/delivery", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/delivery/orders", label: "My Orders", icon: ShoppingBag },
  { to: "/delivery/history", label: "History", icon: History },
];

export default function DeliveryPanel() {
  return (
    <div className="container-app py-8" data-testid="delivery-page">
      <h1 className="font-heading text-3xl font-bold sm:text-4xl">Delivery panel</h1>
      <p className="mt-2 text-sm text-[#4A4A4A]">Assigned orders, status updates, and earnings</p>

      <div className="mt-6 flex flex-col gap-6 sm:mt-8 lg:grid lg:grid-cols-[220px_1fr] lg:items-start lg:gap-8">
        <aside className="panel-nav-mobile sticky-sidebar no-scrollbar flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-y-auto lg:overflow-x-visible lg:pb-0">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors lg:gap-3 ${
                  isActive ? "bg-[#1B4332] text-white" : "text-[#4A4A4A] hover:bg-gray-50"
                }`
              }
              data-testid={`delivery-nav-${l.label.toLowerCase().replace(/\s/g, "-")}`}
            >
              <l.icon className="h-4 w-4" />
              {l.label}
            </NavLink>
          ))}
        </aside>

        <div className="min-w-0">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<AssignedOrders />} />
            <Route path="history" element={<HistoryList />} />
            <Route path="*" element={<Navigate to="/delivery" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [me, setMe] = useState(null);
  const [earn, setEarn] = useState(null);

  useEffect(() => {
    Promise.all([api.get("/delivery/me"), api.get("/delivery/earnings")])
      .then(([m, e]) => { setMe(m.data); setEarn(e.data); })
      .catch(() => {});
  }, []);

  if (!me || !earn) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  const stats = [
    { label: "Today", value: formatINR(earn.today_earnings) },
    { label: "This week", value: formatINR(earn.week_earnings) },
    { label: "This month", value: formatINR(earn.month_earnings) },
    { label: "Total delivered", value: earn.total_deliveries },
  ];

  return (
    <div className="space-y-8" data-testid="delivery-dashboard">
      <div className="card-base p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#4A4A4A]">Signed in as</div>
            <div className="mt-1 font-heading text-2xl font-bold">{me.name}</div>
            <div className="text-sm text-[#4A4A4A]">{me.email} · {me.phone}</div>
            {me.vehicle && <div className="text-xs text-[#4A4A4A]">Vehicle: {me.vehicle}</div>}
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              me.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> {me.active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card-base p-5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#1B4332] text-white">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div className="mt-4 text-xs uppercase tracking-wider text-[#4A4A4A]">{s.label}</div>
            <div className="mt-1 font-heading text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card-base p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#4A4A4A]">Pending earnings</div>
            <div className="mt-1 font-heading text-2xl font-bold text-[#E07A5F]">{formatINR(earn.pending_earnings)}</div>
            <div className="text-xs text-[#4A4A4A]">Earnings from assigned orders yet to be delivered</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-[#4A4A4A]">Total earned</div>
            <div className="mt-1 font-heading text-2xl font-bold text-[#1B4332]">{formatINR(earn.total_earnings)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderCard({ o, onStatus, showActions = true }) {
  const num = (o.address?.phone || "").replace(/[^\d]/g, "");
  const wa = num
    ? `https://wa.me/${num.length === 10 ? "91" + num : num}?text=${encodeURIComponent(`Hi ${o.user_name}, your Ambajogai Grocery order #${o.id.slice(-6).toUpperCase()} is on the way.`)}`
    : null;

  return (
    <div className="card-base p-5" data-testid={`delivery-order-${o.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs text-[#4A4A4A]">Order #{o.id.slice(-6).toUpperCase()}</div>
          <div className="mt-1 font-semibold">{o.user_name}</div>
          <a href={`tel:${o.address.phone}`} className="text-xs text-[#1B4332] hover:underline">
            <Phone className="mr-1 inline h-3 w-3" /> {o.address.phone}
          </a>
          <div className="mt-2 flex items-start gap-1 text-xs text-[#4A4A4A]">
            <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            {o.address.line1}{o.address.landmark ? `, ${o.address.landmark}` : ""}, {o.address.area}, {o.address.city} - {o.address.pincode}
          </div>
          <div className="mt-2 text-xs text-[#4A4A4A]">
            {o.items.length} item(s) · {o.payment_method} · Total {formatINR(o.total)} · Your earning {formatINR(o.delivery_boy_earning || 0)}
          </div>
        </div>
        <div className="text-right">
          <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">{o.status}</span>
          {showActions && (
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {o.status !== "Out For Delivery" && o.status !== "Delivered" && (
                <button
                  onClick={() => onStatus(o.id, "Out For Delivery")}
                  className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
                  data-testid={`dp-ofd-${o.id}`}
                >
                  <Truck className="h-3.5 w-3.5" /> Out for delivery
                </button>
              )}
              {o.status !== "Delivered" && (
                <button
                  onClick={() => onStatus(o.id, "Delivered")}
                  className="inline-flex items-center gap-1 rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                  data-testid={`dp-delivered-${o.id}`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark delivered
                </button>
              )}
              {o.status !== "Cancelled" && o.status !== "Delivered" && (
                <button
                  onClick={() => onStatus(o.id, "Cancelled")}
                  className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200"
                  data-testid={`dp-cancel-${o.id}`}
                >
                  <Ban className="h-3.5 w-3.5" /> Cancel
                </button>
              )}
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-[#25D366] px-3 py-1.5 text-xs font-semibold text-[#25D366] hover:bg-[#25D366]/10"
                  data-testid={`dp-wa-${o.id}`}
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Notify
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AssignedOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertMuted, setAlertMuted] = useState(() => localStorage.getItem("delivery_new_order_muted") === "1");
  const lastSeenAssignedAtRef = useRef(
    localStorage.getItem("delivery_last_seen_assigned_at") || ""
  );

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/delivery/orders");
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(formatApiError(e, "Unable to load assigned orders."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll for newly assigned orders and refresh the list every 15s
  useEffect(() => {
    let cancelled = false;
    let initialized = Boolean(lastSeenAssignedAtRef.current);

    const check = async () => {
      try {
        const { data } = await api.get("/delivery/new-count");
        if (cancelled) return;

        if (data.latest_assigned_at) {
          const isNewAssignment =
            initialized &&
            lastSeenAssignedAtRef.current &&
            data.latest_assigned_at !== lastSeenAssignedAtRef.current;

          if (isNewAssignment && !alertMuted) {
            playAlert();
            toast.success("New delivery assigned!", { duration: 6000 });
          }

          lastSeenAssignedAtRef.current = data.latest_assigned_at;
          localStorage.setItem(
            "delivery_last_seen_assigned_at",
            data.latest_assigned_at
          );
          initialized = true;
        }
      } catch { /* silent */ }

      if (!cancelled) {
        load();
      }
    };

    check();
    const t = setInterval(check, 15000);
    return () => { cancelled = true; clearInterval(t); };
  }, [alertMuted, load]);

  const toggleMute = () => {
    const next = !alertMuted;
    setAlertMuted(next);
    localStorage.setItem("delivery_new_order_muted", next ? "1" : "0");
    if (!next) playAlert();
  };

  const setStatus = async (id, status) => {
    try {
      await api.patch(`/delivery/orders/${id}/status`, { status });
      toast.success(`Marked ${status}`);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  return (
    <div className="space-y-4" data-testid="delivery-orders">
      <div className="flex justify-end">
        <button
          onClick={toggleMute}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            alertMuted
              ? "border-gray-300 bg-gray-100 text-gray-600 hover:bg-gray-200"
              : "border-[#1B4332] bg-[#1B4332]/5 text-[#1B4332] hover:bg-[#1B4332]/10"
          }`}
          data-testid="delivery-alert-toggle"
        >
          {alertMuted ? "🔕 Alert muted" : "🔔 Alert on"}
        </button>
      </div>
      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E5E5E5] p-10 text-center text-[#4A4A4A]">No active assignments right now.</div>
      ) : (
        orders.map((o) => <OrderCard key={o.id} o={o} onStatus={setStatus} />)
      )}
    </div>
  );
}

function HistoryList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/delivery/history").then(({ data }) => setOrders(data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;
  if (orders.length === 0) return <div className="rounded-2xl border border-dashed border-[#E5E5E5] p-10 text-center text-[#4A4A4A]">No delivery history yet.</div>;

  return (
    <div className="space-y-4" data-testid="delivery-history">
      {orders.map((o) => <OrderCard key={o.id} o={o} onStatus={() => {}} showActions={false} />)}
    </div>
  );
}
