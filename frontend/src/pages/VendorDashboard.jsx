import Dashboard from "@/pages/Dashboard";
import Catalogue from "@/pages/Catalogue";
import VendorBottomNav from "@/components/VendorBottomNav";
import { VendorGate } from "@/pages/VendorVerification";
import VendorWallet from "@/pages/VendorWallet";
import VendorPayouts from "@/pages/VendorPayouts";
import VendorBank from "@/pages/VendorBank";
import VendorRefer from "@/pages/VendorRefer";
import VendorNotifications from "@/pages/VendorNotifications";
import VendorSupport from "@/pages/VendorSupport";
import { useEffect, useState, useCallback, useRef } from "react";
import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import { api, formatINR, formatApiError } from "@/lib/api";
import { vendorLineTotal, vendorOrderTotal } from "@/lib/vendorPricing";
import { toast } from "sonner";
import { playAlert } from "@/lib/audioAlert";
import { ImageSourcePicker } from "@/components/ImageSourcePicker";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  Clock,
  CheckCircle2,
  BarChart3,
  Settings,
  Store,
  Palmtree,
  Wallet,
  Banknote,
  Gift,
  Bell,
  Landmark,
  LifeBuoy,
} from "lucide-react";

const VENDOR_ORDER_STATUSES = ["Pending", "Accepted", "Preparing", "Packed", "Ready"];
const RIDER_ADMIN_STATUSES = ["Out For Delivery", "Delivered", "Cancelled"];

const vendorLinks = [
  { to: "/vendor", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/vendor/catalogue", label: "Catalogue", icon: Package },
  { to: "/vendor/orders", label: "Orders", icon: ShoppingBag },
  { to: "/vendor/wallet", label: "Wallet", icon: Wallet },
  { to: "/vendor/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/vendor/support", label: "Support", icon: LifeBuoy },
  { to: "/vendor/more", label: "More", icon: Settings },
];

export default function VendorDashboard() {
  return (
    <div className="container-app py-6 sm:py-8" data-testid="vendor-page">
      <h1 className="page-title">Vendor panel</h1>
      <p className="mt-2 text-sm text-[#4A4A4A]">Manage your catalogue, inventory, and orders</p>

      <div className="mt-6 flex flex-col gap-6 sm:mt-8 lg:grid lg:grid-cols-[220px_1fr] lg:items-start lg:gap-8">
        <aside className="sticky-sidebar hidden space-y-1 lg:block">
          {vendorLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-[#1B4332] text-white" : "text-[#4A4A4A] hover:bg-gray-50"
                }`
              }
              data-testid={`vendor-nav-${l.label.toLowerCase()}`}
            >
              <l.icon className="h-4 w-4" />
              {l.label}
            </NavLink>
          ))}
        </aside>

        <div className="min-w-0 pb-20 lg:pb-0">
          <VendorGate>
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="catalogue" element={<Catalogue />} />
              <Route path="products" element={<Catalogue />} />
              <Route path="orders" element={<VOrders />} />
              <Route path="analytics" element={<VAnalytics />} />
              <Route path="wallet" element={<VendorWallet />} />
              <Route path="payouts" element={<VendorPayouts />} />
              <Route path="bank" element={<VendorBank />} />
              <Route path="refer" element={<VendorRefer />} />
              <Route path="notifications" element={<VendorNotifications />} />
              <Route path="support" element={<VendorSupport />} />
              <Route path="settings" element={<VSettings />} />
              <Route path="more" element={<VMore />} />
              <Route path="*" element={<Navigate to="/vendor" replace />} />
            </Routes>
          </VendorGate>
        </div>
        <VendorBottomNav />
      </div>
    </div>
  );
}

function VDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get("/vendor/dashboard").then(({ data }) => setData(data)).catch(() => {});
  }, []);
  if (!data) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  const stats = [
    { label: "Revenue", value: formatINR(data.revenue), color: "bg-[#1B4332]" },
    { label: "Total orders", value: data.total_orders, color: "bg-[#E07A5F]" },
    { label: "Pending items", value: data.pending_orders, color: "bg-[#F4A261]" },
    { label: "Products live", value: data.approved_products, color: "bg-[#8BA888]" },
  ];

  return (
    <div className="space-y-8" data-testid="vendor-dashboard">
      <div className="card-base p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#4A4A4A]">Signed in as</div>
            <div className="mt-1 font-heading text-2xl font-bold">{data.vendor.business_name}</div>
            <div className="text-sm text-[#4A4A4A]">{data.vendor.owner_email} · {data.vendor.phone}</div>
          </div>
          {data.vendor.vacation_mode ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700" data-testid="vacation-badge">
              <Palmtree className="h-3.5 w-3.5" /> Temporarily Closed
            </span>
          ) : data.vendor.open_now === false ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
              <Clock className="h-3.5 w-3.5" /> Closed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Open now
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card-base p-5">
            <div className={`h-1.5 w-10 rounded-full ${s.color}`} />
            <div className="mt-4 text-xs uppercase tracking-wider text-[#4A4A4A]">{s.label}</div>
            <div className="mt-1 font-heading text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {data.pending_products > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-[#F4A261] bg-[#F4A261]/10 p-4">
          <Clock className="mt-0.5 h-5 w-5 text-[#F4A261]" />
          <div className="text-sm text-[#1A1A1A]">
            <span className="font-semibold">{data.pending_products} product(s)</span> are pending admin approval.
            They&apos;ll go live automatically once approved.
          </div>
        </div>
      )}

      {data.low_stock.length > 0 && (
        <div className="card-base p-6">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#E07A5F]" />
            <h3 className="font-heading text-lg font-semibold">Low stock</h3>
          </div>
          <div className="space-y-3">
            {data.low_stock.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                <div className="flex-1">
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-[#4A4A4A]">{p.unit}</div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.stock === 0 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                  {p.stock} left
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
}

export function VProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [p, c] = await Promise.all([api.get("/vendor/products"), api.get("/categories")]);
      setProducts(p.data);
      setCategories(c.data);
    } catch {
      // Keep existing list visible during background refresh failures
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll for new products, but never interrupt an open add/edit form
  useEffect(() => {
    if (showForm) return undefined;
    const interval = setInterval(() => load({ silent: true }), 10000);
    return () => clearInterval(interval);
  }, [load, showForm]);

  const del = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await api.delete(`/vendor/products/${id}`);
      toast.success("Deleted");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  return (
    <div data-testid="vendor-products">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-heading text-2xl font-semibold">
          Products ({products.length})
          {refreshing && <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-[#8BA888]" />}
        </h2>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary" data-testid="vendor-add-product">
          <Plus className="h-4 w-4" /> Add product
        </button>
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E5E5E5] p-10 text-center text-[#4A4A4A]">
          No products yet. Add your first product — it goes live after admin approval.
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-[#4A4A4A]">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-[#E5E5E5]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        <div>
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-xs text-[#4A4A4A]">{p.unit} · {p.category_slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold" title="Your price per unit">
                      {formatINR(p.base_price ?? p.price)}
                      <span className="ml-1 text-[10px] font-normal text-[#4A4A4A]">base</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.stock <= 5 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        p.approval_status === "approved" ? "bg-green-100 text-green-700" :
                        p.approval_status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {p.approval_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => { setEditing(p); setShowForm(true); }} className="inline-grid h-8 w-8 place-items-center rounded-full text-[#1B4332] hover:bg-gray-100" data-testid={`v-edit-${p.slug}`}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => del(p.id)} className="inline-grid h-8 w-8 place-items-center rounded-full text-red-600 hover:bg-red-50" data-testid={`v-delete-${p.slug}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <VProductForm
          initial={editing}
          categories={categories}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function VProductForm({ initial, categories, onClose, onSaved }) {
  const [form, setForm] = useState(
    initial || {
      name: "", slug: "", description: "", price: 0, mrp: 0, unit: "1 kg",
      category_slug: categories[0]?.slug || "", image: "", stock: 0, featured: false, popular: false,
    }
  );
  const [saving, setSaving] = useState(false);

  const update = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.image?.trim()) {
      toast.error("Please add a product image (upload a file or paste an image URL).");
      return;
    }
    setSaving(true);

  try {
    const payload = {
      ...form,
      slug: form.slug || slugify(form.name),
      price: Number(form.price),
      mrp: form.mrp ? Number(form.mrp) : null,
      stock: Number(form.stock),
    };

    if (initial) {
      await api.put(`/vendor/products/${initial.id}`, payload);
    } else {
      await api.post("/vendor/products", payload);
    }

    toast.success(initial ? "Updated" : "Submitted for approval");
    onSaved();
  } catch (e) {
    toast.error(formatApiError(e));
  } finally {
    setSaving(false);
  }
};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="v-product-form">
      <div className="card-base max-h-[90vh] w-full max-w-2xl overflow-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-xl font-semibold">{initial ? "Edit product" : "New product"}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <FF label="Name" value={form.name} onChange={(v) => update("name", v)} required />
          <FF label="Slug" value={form.slug} onChange={(v) => update("slug", v)} placeholder="auto from name" />
          <div className="sm:col-span-2">
      
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Description</label>
            <textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={2} className="input-base resize-none" />
          </div>
          <FF label="Base price (₹)" type="number" value={form.price} onChange={(v) => update("price", v)} required />
          <p className="sm:col-span-2 -mt-2 text-xs text-[#4A4A4A]">
            Set the price you want to receive for this product. This is what you will see on orders and payouts.
          </p>
          <FF label="MRP (₹)" type="number" value={form.mrp || ""} onChange={(v) => update("mrp", v)} />
          <FF label="Unit (250g/500g/1kg)" value={form.unit} onChange={(v) => update("unit", v)} placeholder="1 kg" />
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Category</label>
            <select value={form.category_slug} onChange={(e) => update("category_slug", e.target.value)} className="input-base">
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <ImageSourcePicker
              label="Product image"
              value={form.image}
              onChange={(url) => update("image", url)}
              required
              testIdPrefix="v-product-image"
            />
          </div>
          <FF label="Stock" type="number" value={form.stock} onChange={(v) => update("stock", v)} required />
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary" data-testid="v-save-product">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FF({ label, type = "text", value, onChange, ...rest }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="input-base" {...rest} />
    </div>
  );
}

function VOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const previousOrderIds = useRef(new Set());
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/vendor/orders");

      const currentOrderIds = new Set(data.map((order) => order.id));

      if (hasLoadedOnce.current) {
        const hasNewOrder = data.some(
          (order) => !previousOrderIds.current.has(order.id)
        );

        if (hasNewOrder) {
          playAlert();
          toast.success("New order received!");
        }
      }

      previousOrderIds.current = currentOrderIds;
      hasLoadedOnce.current = true;
      setOrders(data);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
  load();
  const interval = setInterval(load, 10000);
  return () => clearInterval(interval);
}, [load]);

  const setStatus = async (id, status) => {
    try {
      await api.patch(`/vendor/orders/${id}/line-status`, { status });
      toast.success(`Marked ${status}`);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;
  if (orders.length === 0) return <div className="rounded-2xl border border-dashed border-[#E5E5E5] p-10 text-center text-[#4A4A4A]">No orders yet.</div>;

  return (
    <div className="space-y-4" data-testid="vendor-orders">
      {orders.map((o) => {
        const currentStatus = o.my_status === "Mixed" ? "Pending" : o.my_status;
        const vendorLocked = RIDER_ADMIN_STATUSES.includes(currentStatus);
        const orderTotal = vendorOrderTotal(o.items);
        return (
        <div key={o.id} className="card-base p-5" data-testid={`vendor-order-${o.id}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs text-[#4A4A4A]">Order #{o.id.slice(-6).toUpperCase()}</div>
              <div className="mt-1 font-semibold">{o.customer_name} · {o.customer_phone}</div>
              <div className="text-xs text-[#4A4A4A]">
                {o.address.line1}, {o.address.area}, {o.address.city} - {o.address.pincode}
              </div>
              <div className="mt-2 text-xs text-[#4A4A4A]">
                {o.items.length} item(s) · {o.payment_method} · {new Date(o.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
              </div>
            </div>
            <div className="text-right">
              <div className="font-heading text-xl font-bold text-[#1B4332]">{formatINR(orderTotal)}</div>
              <div className="text-[10px] text-[#4A4A4A]">Your amount (base price)</div>
              <div className="mt-2">
                {vendorLocked ? (
                  <span className="inline-block rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-[#4A4A4A]">
                    {currentStatus} · handled by rider/admin
                  </span>
                ) : (
                  <select
                    value={VENDOR_ORDER_STATUSES.includes(currentStatus) ? currentStatus : "Pending"}
                    onChange={(e) => setStatus(o.id, e.target.value)}
                    className="input-base w-44 text-sm"
                    data-testid={`v-status-${o.id}`}
                  >
                    {VENDOR_ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
              <div className="mt-1 text-xs text-[#4A4A4A]">Overall: {o.overall_status}</div>
            </div>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            {o.items.map((it, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <img src={it.image} alt="" className="h-8 w-8 rounded object-cover" />
                <span className="flex-1">{it.name} <span className="text-xs text-[#4A4A4A]">({it.unit})</span></span>
                <span className="text-[#4A4A4A]">×{it.quantity}</span>
                <span className="font-semibold">{formatINR(vendorLineTotal(it))}</span>
                {it.line_status && it.line_status !== o.my_status && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-[#4A4A4A]">{it.line_status}</span>
                )}
              </div>
            ))}
          </div>
        </div>
        );
      })}
    </div>
  );
}

/* ================= ANALYTICS ================= */
function VAnalytics() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get("/vendor/analytics").then(({ data }) => setData(data)).catch(() => {});
  }, []);

  if (!data) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  const kpis = [
    { label: "Today's orders", value: data.today_orders },
    { label: "This week", value: data.week_orders },
    { label: "This month (₹)", value: formatINR(data.month_sales ?? data.month_revenue ?? 0) },
    { label: "Total sales (₹)", value: formatINR(data.total_sales ?? data.total_revenue ?? 0) },
  ];

  const earningsRow = [
    { label: "Your sales", value: formatINR(data.total_sales ?? data.total_revenue ?? 0), color: "text-[#1B4332]" },
    { label: "Pending payment", value: formatINR(data.pending_payment ?? 0), color: "text-[#F4A261]" },
  ];

  return (
    <div className="space-y-8" data-testid="vendor-analytics">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card-base p-5">
            <div className="text-xs uppercase tracking-wider text-[#4A4A4A]">{k.label}</div>
            <div className="mt-1 font-heading text-2xl font-bold">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="card-base p-6" data-testid="earnings-breakdown">
        <h3 className="font-heading text-lg font-semibold">Earnings breakdown</h3>
        <p className="mt-1 text-xs text-[#4A4A4A]">Your product prices on delivered orders only.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {earningsRow.map((r) => (
            <div key={r.label} className="rounded-xl border border-[#E5E5E5] p-4">
              <div className="text-xs uppercase tracking-wider text-[#4A4A4A]">{r.label}</div>
              <div className={`mt-1 font-heading text-xl font-bold ${r.color}`}>{r.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-base p-6">
          <h3 className="font-heading text-lg font-semibold">Best-selling products</h3>
          {data.best_sellers.length === 0 ? (
            <p className="mt-3 text-sm text-[#4A4A4A]">No delivered orders yet. Sales will appear here once you fulfil orders.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {data.best_sellers.map((s) => (
                <div key={s.product_id} className="flex items-center gap-3" data-testid={`best-seller-${s.product_id}`}>
                  <img src={s.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{s.name}</div>
                    <div className="text-xs text-[#4A4A4A]">{s.unit} · sold {s.qty}</div>
                  </div>
                  <div className="text-sm font-semibold text-[#1B4332]">{formatINR(s.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-base p-6">
          <h3 className="font-heading text-lg font-semibold">Recent orders</h3>
          {data.recent_orders.length === 0 ? (
            <p className="mt-3 text-sm text-[#4A4A4A]">No orders yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {data.recent_orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between border-b border-dashed pb-2 last:border-0 last:pb-0">
                  <div>
                    <div className="text-sm font-semibold">#{o.id.slice(-6).toUpperCase()}</div>
                    <div className="text-xs text-[#4A4A4A]">{o.customer_name} · {o.items_count ?? o.items?.length ?? 0} item(s)</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-[#1B4332]">{formatINR(vendorOrderTotal(o.items ?? []))}</div>
                    <div className="text-xs text-[#4A4A4A]">{o.overall_status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {data.low_stock.length > 0 && (
        <div className="card-base p-6">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#E07A5F]" />
            <h3 className="font-heading text-lg font-semibold">Low stock</h3>
          </div>
          <div className="space-y-3">
 {data.low_stock.map((p) => (
  <div key={p.id} className="flex items-center gap-3">

    {p.image && (
      <img
        src={p.image}
        alt={p.name || ""}
        className="h-10 w-10 rounded-lg object-cover"
      />
    )}

    <div className="flex-1">
      <p className="font-medium">{p.name}</p>
      <p className="text-sm text-gray-500">
        {p.stock} left
      </p>
    </div>

    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        p.stock === 0
          ? "bg-red-100 text-red-700"
          : "bg-yellow-100 text-yellow-700"
      }`}
    >
      {p.stock} left
    </span>

  </div>
))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= SHOP SETTINGS ================= */
const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

function VSettings() {
  const [v, setV] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/vendor/settings").then(({ data }) => setV(data)).catch(() => {});
  }, []);

  if (!v) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  const up = (k, val) => setV((prev) => ({ ...prev, [k]: val }));
  const upHour = (day, val) => setV((prev) => ({ ...prev, business_hours: { ...(prev.business_hours || {}), [day]: val } }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.patch("/vendor/settings", {
        business_name: v.business_name,
        business_description: v.business_description,
        business_address: v.business_address,
        business_pincode: v.business_pincode,
        shop_phone: v.shop_phone,
        shop_whatsapp: v.shop_whatsapp,
        shop_logo: v.shop_logo,
        banner_image: v.banner_image,
        business_hours: v.business_hours || {},
        open_now: !!v.open_now,
        vacation_mode: !!v.vacation_mode,
        vacation_message: v.vacation_message || "",
        // Send 0 (not null) when cleared so backend actually persists the reset
        delivery_radius_km: v.delivery_radius_km === "" || v.delivery_radius_km == null ? 0 : Number(v.delivery_radius_km),
        min_order_amount: v.min_order_amount === "" || v.min_order_amount == null ? 0 : Number(v.min_order_amount),
        estimated_delivery_min: v.estimated_delivery_min === "" || v.estimated_delivery_min == null ? 0 : Number(v.estimated_delivery_min),
      });
      setV(data);
      toast.success("Shop settings saved");
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="space-y-8" data-testid="vendor-settings">
      {/* Status */}
      <section className="card-base p-6">
        <div className="mb-4 flex items-center gap-2">
          <Store className="h-5 w-5 text-[#1B4332]" />
          <h2 className="font-heading text-lg font-semibold">Shop status</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E5E5E5] p-4 hover:border-[#8BA888]">
            <input
              type="checkbox"
              checked={!!v.open_now}
              onChange={(e) => up("open_now", e.target.checked)}
              className="mt-1"
              data-testid="toggle-open"
            />
            <div>
              <div className="font-semibold">Open now</div>
              <div className="text-xs text-[#4A4A4A]">Turn off temporarily during rush / short break.</div>
            </div>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E5E5E5] p-4 hover:border-[#8BA888]">
            <input
              type="checkbox"
              checked={!!v.vacation_mode}
              onChange={(e) => up("vacation_mode", e.target.checked)}
              className="mt-1"
              data-testid="toggle-vacation"
            />
            <div>
              <div className="font-semibold">Vacation mode</div>
              <div className="text-xs text-[#4A4A4A]">Products stay visible with a &ldquo;Temporarily closed&rdquo; badge. Customers cannot place new orders.</div>
            </div>
          </label>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Vacation message (optional)</label>
            <input value={v.vacation_message || ""} onChange={(e) => up("vacation_message", e.target.value)} placeholder="Closed for Diwali until Nov 5" className="input-base" data-testid="vacation-message" />
          </div>
        </div>
      </section>

      {/* Profile */}
      <section className="card-base p-6">
        <h2 className="font-heading text-lg font-semibold">Business profile</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FF label="Business name" value={v.business_name} onChange={(x) => up("business_name", x)} required />
          <FF label="Pincode" value={v.business_pincode || ""} onChange={(x) => up("business_pincode", x)} />
          <div className="sm:col-span-2">
            <FF label="Address" value={v.business_address || ""} onChange={(x) => up("business_address", x)} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">About your business</label>
            <textarea value={v.business_description || ""} onChange={(e) => up("business_description", e.target.value)} rows={3} className="input-base resize-none" />
          </div>
          <FF label="Shop phone" value={v.shop_phone || ""} onChange={(x) => up("shop_phone", x)} placeholder="+91..." />
          <FF label="Shop WhatsApp" value={v.shop_whatsapp || ""} onChange={(x) => up("shop_whatsapp", x)} placeholder="+91..." />
          <FF label="Shop logo URL" value={v.shop_logo || ""} onChange={(x) => up("shop_logo", x)} />
          <FF label="Banner image URL" value={v.banner_image || ""} onChange={(x) => up("banner_image", x)} />
        </div>
      </section>

      {/* Operations */}
      <section className="card-base p-6">
        <h2 className="font-heading text-lg font-semibold">Operations</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <FF label="Delivery radius (km)" type="number" value={v.delivery_radius_km || ""} onChange={(x) => up("delivery_radius_km", x)} />
          <FF label="Min order amount (₹)" type="number" value={v.min_order_amount || ""} onChange={(x) => up("min_order_amount", x)} />
          <FF label="Estimated delivery (min)" type="number" value={v.estimated_delivery_min || ""} onChange={(x) => up("estimated_delivery_min", x)} />
        </div>
      </section>

      {/* Hours */}
      <section className="card-base p-6">
        <h2 className="font-heading text-lg font-semibold">Business hours</h2>
        <p className="mt-1 text-xs text-[#4A4A4A]">Use format like &ldquo;08:00-21:00&rdquo; or type &ldquo;Closed&rdquo;.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {DAYS.map((d) => (
            <div key={d.key} className="flex items-center gap-3">
              <div className="w-14 text-sm font-semibold">{d.label}</div>
              <input
                value={v.business_hours?.[d.key] || ""}
                onChange={(e) => upHour(d.key, e.target.value)}
                placeholder="08:00-21:00"
                className="input-base"
                data-testid={`hours-${d.key}`}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Verification (read-only summary) */}
      <section className="card-base p-6">
        <h2 className="font-heading text-lg font-semibold">Verification</h2>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
            v.status === "Approved" ? "bg-green-100 text-green-700" :
            v.status === "Rejected" ? "bg-red-100 text-red-700" :
            v.status === "Suspended" ? "bg-gray-200 text-gray-700" :
            "bg-yellow-100 text-yellow-700"
          }`}>{v.status}</span>
          {v.verified && <span className="rounded-full bg-[#8BA888]/20 px-3 py-1 text-xs font-semibold text-[#1B4332]">Verified badge active</span>}
          <span className="text-xs text-[#4A4A4A]">Documents were submitted at registration and reviewed by admin.</span>
        </div>
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="btn-primary" data-testid="save-settings">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save settings
        </button>
      </div>
    </form>
  );
}


/* ================= MORE (consolidates business links) ================= */
function VMore() {
  const tiles = [
    { to: "/vendor/analytics", title: "Analytics", body: "Sales trends, best-sellers, earnings breakdown", available: true, icon: BarChart3, color: "bg-[#1B4332]" },
    { to: "/vendor/settings", title: "Shop Settings", body: "Business profile, hours, vacation mode, delivery radius", available: true, icon: Settings, color: "bg-[#E07A5F]" },
    { to: "/vendor/bank", title: "Bank Details", body: "Payout account for earnings transfer", available: true, icon: Landmark, color: "bg-[#F4A261]" },
    { to: "/vendor/payouts", title: "Payouts", body: "Request and track payout transfers", available: true, icon: Banknote, color: "bg-[#8BA888]" },
    { to: "/vendor/refer", title: "Refer & Earn", body: "Invite vendors and earn referral rewards", available: true, icon: Gift, color: "bg-[#E07A5F]" },
    { to: "/vendor/notifications", title: "Notifications", body: "Orders, payouts, and account updates", available: true, icon: Bell, color: "bg-[#1B4332]" },
    { to: "/vendor/support", title: "Support", body: "Need help? Contact the Ambajogai vendor team", available: true, icon: LifeBuoy, color: "bg-[#8BA888]" },
    { to: "/vendor/analytics", title: "Sales & Earnings", body: "Track your sales and payment status", available: true, icon: BarChart3, color: "bg-[#1B4332]" },
  ];
  const { logout } = useAuth();
  return (
    <div className="space-y-6" data-testid="vendor-more">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => {
          const inner = (
            <div className={`card-base h-full p-5 ${!t.available ? "opacity-60" : "hover:border-[#8BA888]"}`}>
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${t.color} text-white`}>
                <t.icon className="h-5 w-5" />
              </div>
              <div className="mt-4 font-heading text-lg font-semibold">{t.title}</div>
              <div className="mt-1 text-xs text-[#4A4A4A]">{t.body}</div>
              {!t.available && <div className="mt-2 inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-800">Coming soon</div>}
            </div>
          );
          return t.available && t.to ? (
            <NavLink key={t.title} to={t.to} data-testid={`more-tile-${t.title.toLowerCase().replace(/\s/g, "-")}`}>{inner}</NavLink>
          ) : (
            <div key={t.title}>{inner}</div>
          );
        })}
      </div>
      <button onClick={logout} className="btn-secondary" data-testid="more-logout">Log out</button>
    </div>
  );
}







