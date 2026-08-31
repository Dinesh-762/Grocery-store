import { useEffect, useState, useCallback, useRef } from "react";
import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import { api, formatINR, formatApiError } from "@/lib/api";
import { ExportMenu } from "@/components/ExportMenu";
import { ImageSourcePicker } from "@/components/ImageSourcePicker";
import { toast } from "sonner";
import { playAlert } from "@/lib/audioAlert";

/* Order status flow — strict forward-only progression (enforced by backend too) */
const STATUS_FLOW = ["Pending", "Accepted", "Preparing", "Packed", "Ready", "Out For Delivery", "Delivered"];

function slugify(s) {
  return String(s || "").toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
}

function urlB64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function allowedNextStatuses(current) {
  if (current === "Cancelled" || current === "Delivered") return [current];
  const idx = STATUS_FLOW.indexOf(current);
  const next = idx >= 0 && idx < STATUS_FLOW.length - 1 ? [STATUS_FLOW[idx + 1]] : [];
  return [current, ...next, "Cancelled"];
}
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Tag,
  TrendingUp,
  AlertTriangle,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  Store,
  Ticket,
  Check,
  Ban,
  ExternalLink,
  Truck,
  BarChart3,
  Award,
  Megaphone,
  DollarSign,
  Banknote,
} from "lucide-react";
import AdminPricing from "@/pages/admin/AdminPricing";
import AdminPayouts from "@/pages/admin/AdminPayouts";

const adminLinks = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/vendors", label: "Vendors", icon: Store },
  { to: "/admin/pricing", label: "Pricing", icon: DollarSign },
  { to: "/admin/payouts", label: "Payouts", icon: Banknote },
  { to: "/admin/delivery", label: "Delivery Boys", icon: Truck },
  { to: "/admin/coupons", label: "Coupons", icon: Ticket },
  { to: "/admin/offers", label: "Offers", icon: Megaphone },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/categories", label: "Categories", icon: Tag },
];

export default function Admin() {
  return (
    <div className="container-app py-8" data-testid="admin-page">
      <div className="lg:hidden">
        <h1 className="font-heading text-3xl font-bold sm:text-4xl">Admin panel</h1>
        <p className="mt-2 text-sm text-[#4A4A4A]">Manage products, orders, and store operations</p>
      </div>

      <div className="mt-6 lg:mt-0 lg:grid lg:grid-cols-[220px_1fr] lg:items-start lg:gap-8">
        <div className="panel-rail no-scrollbar">
          <div className="hidden lg:block">
            <h1 className="font-heading text-3xl font-bold sm:text-4xl">Admin panel</h1>
            <p className="mt-2 text-sm text-[#4A4A4A]">Manage products, orders, and store operations</p>
          </div>

          <aside className="panel-nav-mobile no-scrollbar mt-0 pb-1 lg:mt-6">
            {adminLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors lg:gap-3 ${
                    isActive ? "bg-[#1B4332] text-white" : "text-[#4A4A4A] hover:bg-gray-50"
                  }`
                }
                data-testid={`admin-nav-${l.label.toLowerCase()}`}
              >
                <l.icon className="h-4 w-4" />
                {l.label}
              </NavLink>
            ))}
          </aside>
        </div>

        <div className="min-w-0 mt-6 lg:mt-0">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="products" element={<ProductsAdmin />} />
            <Route path="orders" element={<OrdersAdmin />} />
            <Route path="vendors" element={<VendorsAdmin />} />
            <Route path="pricing" element={<AdminPricing />} />
            <Route path="payouts" element={<AdminPayouts />} />
            <Route path="delivery" element={<DeliveryAdmin />} />
            <Route path="coupons" element={<CouponsAdmin />} />
            <Route path="offers" element={<OffersAdmin />} />
            <Route path="customers" element={<Customers />} />
            <Route path="categories" element={<Categories />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

/* ================= DASHBOARD ================= */
function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");

    api
      .get("/admin/dashboard")
      .then(({ data: dashboard }) => {
        setData(dashboard);
      })
      .catch((err) => {
        setData(null);
        setError(formatApiError(err, "Unable to load admin dashboard."));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B4332]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-base p-8 text-center" data-testid="dashboard-error">
        <p className="text-sm text-red-700">{error}</p>
        <button type="button" onClick={load} className="btn-primary mt-4">
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const stats = [
    { label: "Revenue (delivered)", value: formatINR(data.revenue), icon: TrendingUp, color: "bg-[#1B4332]" },
    { label: "Orders", value: data.total_orders, icon: ShoppingBag, color: "bg-[#E07A5F]" },
    { label: "Approved vendors", value: data.total_vendors ?? 0, icon: Store, color: "bg-[#F4A261]" },
    { label: "Customers", value: data.total_users, icon: Users, color: "bg-[#8BA888]" },
  ];

  return (
    <div className="space-y-8" data-testid="dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-2xl font-semibold">Overview</h2>
        <ExportMenu
          exports={[
            {
              label: "Dashboard summary",
              filename: "dashboard-summary.csv",
              title: "Dashboard Summary",
              rows: [
                { metric: "Revenue (delivered)", value: data.revenue },
                { metric: "Total orders", value: data.total_orders },
                { metric: "Approved vendors", value: data.total_vendors ?? 0 },
                { metric: "Customers", value: data.total_users },
                { metric: "Pending vendors", value: data.pending_vendors ?? 0 },
                { metric: "Pending products", value: data.pending_products ?? 0 },
              ],
              columns: [
                { key: "metric", label: "Metric" },
                { key: "value", label: "Value" },
              ],
            },
            {
              label: "Low stock",
              filename: "low-stock.csv",
              title: "Low Stock Products",
              rows: data.low_stock,
              columns: [
                { key: "name", label: "Product" },
                { key: "unit", label: "Unit" },
                { key: "stock", label: "Stock" },
              ],
            },
            {
              label: "Recent orders",
              filename: "recent-orders.csv",
              title: "Recent Orders",
              rows: data.recent_orders.map((o) => ({
                id: o.id,
                customer: o.user_name,
                total: o.total,
                status: o.status,
                items: o.items?.length ?? 0,
              })),
              columns: [
                { key: "id", label: "Order ID" },
                { key: "customer", label: "Customer" },
                { key: "total", label: "Total" },
                { key: "status", label: "Status" },
                { key: "items", label: "Items" },
              ],
            },
          ]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card-base p-5">
            <div className={`grid h-10 w-10 place-items-center rounded-xl ${s.color} text-white`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div className="mt-4 text-xs uppercase tracking-wider text-[#4A4A4A]">{s.label}</div>
            <div className="mt-1 font-heading text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Action-required callouts */}
      {(data.pending_vendors > 0 || data.pending_products > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.pending_vendors > 0 && (
            <NavLink to="/admin/vendors" className="card-base flex items-center gap-3 p-5 hover:border-[#F4A261]" data-testid="pending-vendors-card">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#F4A261] text-white">
                <Store className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">{data.pending_vendors} vendor(s) awaiting approval</div>
                <div className="text-xs text-[#4A4A4A]">Review documents and approve or reject</div>
              </div>
              <ExternalLink className="h-4 w-4 text-[#4A4A4A]" />
            </NavLink>
          )}
          {data.pending_products > 0 && (
            <NavLink to="/admin/products" className="card-base flex items-center gap-3 p-5 hover:border-[#E07A5F]" data-testid="pending-products-card">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#E07A5F] text-white">
                <Package className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">{data.pending_products} product(s) awaiting approval</div>
                <div className="text-xs text-[#4A4A4A]">Approve to make them live for customers</div>
              </div>
              <ExternalLink className="h-4 w-4 text-[#4A4A4A]" />
            </NavLink>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-base p-6" data-testid="low-stock">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#E07A5F]" />
            <h3 className="font-heading text-lg font-semibold">Low stock alerts</h3>
          </div>
          <div className="mt-4 space-y-3">
            {data.low_stock.length === 0 && <p className="text-sm text-[#4A4A4A]">All good — no items below 5 units.</p>}
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

        <div className="card-base p-6">
          <h3 className="font-heading text-lg font-semibold">Recent orders</h3>
          <div className="mt-4 space-y-3">
            {data.recent_orders.length === 0 && <p className="text-sm text-[#4A4A4A]">No orders yet.</p>}
            {data.recent_orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between border-b border-dashed pb-3 last:border-0 last:pb-0">
                <div>
                  <div className="text-sm font-semibold">#{o.id.slice(-6).toUpperCase()}</div>
                  <div className="text-xs text-[#4A4A4A]">{o.user_name} — {o.items.length} items</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-[#1B4332]">{formatINR(o.total)}</div>
                  <div className="text-xs text-[#4A4A4A]">{o.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= PRODUCTS ADMIN ================= */
function ProductsAdmin() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        api.get("/admin/products"),
        api.get("/categories"),
      ]);
      setProducts(p.data);
      setCategories(c.data);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const del = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const setApproval = async (id, status) => {
    try {
      await api.patch(`/admin/products/${id}/approval`, { status });
      toast.success(`Product ${status}`);
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  return (
    <div data-testid="products-admin">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Products ({products.length})</h2>
          <p className="mt-1 text-xs text-[#4A4A4A]">
            Manage pricing, variants, MRP and product commission.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            filename="products.csv"
            rows={products.map((p) => ({
              name: p.name,
              slug: p.slug,
              vendor: p.vendor_name || "Store",
              price: p.price,
              mrp: p.mrp ?? "",
              stock: p.stock,
              category: p.category_slug,
              approval: p.approval_status || "approved",
              commission_type: p.commission_type || "MRP",
              commission_value: p.commission_value ?? 0,
            }))}
            columns={[
              { key: "name", label: "Name" },
              { key: "slug", label: "Slug" },
              { key: "vendor", label: "Vendor" },
              { key: "price", label: "Price" },
              { key: "mrp", label: "MRP" },
              { key: "stock", label: "Stock" },
              { key: "category", label: "Category" },
              { key: "approval", label: "Approval" },
              { key: "commission_type", label: "Commission Type" },
              { key: "commission_value", label: "Commission Value" },
            ]}
          />
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="btn-primary"
            data-testid="admin-add-product"
          >
            <Plus className="h-4 w-4" /> Add product
          </button>
        </div>
      </div>

      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-[#4A4A4A]">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Commission</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Approval</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const commissionType = String(p.commission_type || "MRP").toUpperCase();
                const commissionValue = Number(p.commission_value || 0);

                return (
                  <tr key={p.id} className="border-t border-[#E5E5E5]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        <div>
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-xs text-[#4A4A4A]">
                            {p.unit} · {p.category_slug}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#4A4A4A]">
                      {p.vendor_name || <span className="italic text-gray-400">Store</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatINR(p.price)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <span className="rounded-full bg-[#E8F3EC] px-2.5 py-1 text-xs font-semibold text-[#1B4332]">
                          {commissionType === "CUSTOM"
                            ? `Custom ${formatINR(commissionValue)}`
                            : `${commissionValue}% of MRP`}
                        </span>
                        {Array.isArray(p.variants) && p.variants.length > 0 && (
                          <span className="text-[11px] text-[#4A4A4A]">
                            {p.variants.length} variant{p.variants.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
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
                        {p.approval_status || "approved"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(p.approval_status || "approved") !== "approved" && (
                        <button
                          onClick={() => setApproval(p.id, "approved")}
                          className="mr-1 inline-flex items-center gap-1 rounded-full bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700"
                          data-testid={`approve-product-${p.slug}`}
                        >
                          <Check className="h-3 w-3" /> Approve
                        </button>
                      )}
                      {(p.approval_status || "approved") !== "rejected" && (
                        <button
                          onClick={() => setApproval(p.id, "rejected")}
                          className="mr-1 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-200"
                          data-testid={`reject-product-${p.slug}`}
                        >
                          <Ban className="h-3 w-3" /> Reject
                        </button>
                      )}
                      <button onClick={() => { setEditing(p); setShowForm(true); }} className="inline-grid h-8 w-8 place-items-center rounded-full text-[#1B4332] hover:bg-gray-100" data-testid={`edit-${p.slug}`}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => del(p.id)} className="inline-grid h-8 w-8 place-items-center rounded-full text-red-600 hover:bg-red-50" data-testid={`delete-${p.slug}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <ProductForm
          initial={editing}
          categories={categories}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function ProductForm({ initial, categories, onClose, onSaved }) {
  const [form, setForm] = useState(
    initial || {
      name: "",
      slug: "",
      description: "",
      price: 0,
      mrp: 0,
      unit: "1 kg",
      category_slug: categories[0]?.slug || "",
      image: "",
      stock: 0,
      featured: false,
      popular: false,
      commission_type: "MRP",
      commission_value: 0,
    }
  );

  const [variants, setVariants] = useState(
    (initial?.variants || []).map((v) => ({
      label: v.label || "",
      price: Number(v.price || 0),
      mrp: v.mrp === null || v.mrp === undefined ? "" : Number(v.mrp),
      unit: v.unit || "",
      stock: Number(v.stock || 0),
    }))
  );
  const [saving, setSaving] = useState(false);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const updateVariant = (index, key, value) => {
    setVariants((current) =>
      current.map((variant, i) =>
        i === index ? { ...variant, [key]: value } : variant
      )
    );
  };

  const addVariant = () => {
    setVariants((current) => [
      ...current,
      { label: "", price: 0, mrp: "", unit: "", stock: 0 },
    ]);
  };

  const removeVariant = (index) => {
    setVariants((current) => current.filter((_, i) => i !== index));
  };

  const save = async (e) => {
    e.preventDefault();

    const commissionType = String(form.commission_type || "MRP").toUpperCase();
    const commissionValue = Number(form.commission_value || 0);

    if (!Number.isFinite(commissionValue) || commissionValue < 0) {
      toast.error("Commission value cannot be negative.");
      return;
    }

    if (commissionType === "MRP" && commissionValue > 100) {
      toast.error("MRP commission cannot exceed 100%.");
      return;
    }

    if (!String(form.image || "").trim()) {
      toast.error("Product image is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        slug: form.slug || slugify(form.name),
        price: Number(form.price),
        mrp: form.mrp === "" || form.mrp === null ? null : Number(form.mrp),
        stock: Number(form.stock),
        commission_type: commissionType,
        commission_value: commissionValue,
        variants: variants.map((v) => ({
          label: String(v.label || "").trim(),
          price: Number(v.price || 0),
          mrp: v.mrp === "" || v.mrp === null ? null : Number(v.mrp),
          unit: String(v.unit || "").trim(),
          stock: Number(v.stock || 0),
        })),
      };

      if (initial) {
        await api.put(`/products/${initial.id}`, payload);
      } else {
        await api.post("/products", payload);
      }

      toast.success("Product saved");
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="product-form-modal">
      <div className="card-base max-h-[90vh] w-full max-w-3xl overflow-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-heading text-xl font-semibold">{initial ? "Edit product" : "New product"}</h3>
            <p className="mt-1 text-xs text-[#4A4A4A]">Configure pricing, variants and commission.</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <FField label="Name" value={form.name} onChange={(v) => update("name", v)} required data-testid="product-name" />
          <FField label="Slug" value={form.slug} onChange={(v) => update("slug", v)} placeholder="auto from name" data-testid="product-slug" />

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Description</label>
            <textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={2} className="input-base resize-none" data-testid="product-description" />
          </div>

          <FField label="Price (₹)" type="number" min="0" step="0.01" value={form.price} onChange={(v) => update("price", v)} required data-testid="product-price" />
          <FField label="MRP (₹)" type="number" min="0" step="0.01" value={form.mrp ?? ""} onChange={(v) => update("mrp", v)} data-testid="product-mrp" />
          <FField label="Unit" value={form.unit} onChange={(v) => update("unit", v)} placeholder="1 kg" data-testid="product-unit" />

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Category</label>
            <select value={form.category_slug} onChange={(e) => update("category_slug", e.target.value)} className="input-base" data-testid="product-category">
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <ImageSourcePicker
              label="Product image"
              value={form.image}
              onChange={(v) => update("image", v)}
              required
              testIdPrefix="product-image"
            />
          </div>

          <FField label="Stock" type="number" min="0" step="1" value={form.stock} onChange={(v) => update("stock", v)} required data-testid="product-stock" />

          {/* Commission */}
          <div className="sm:col-span-2 rounded-2xl border border-[#D9E8DE] bg-[#F7FBF8] p-4">
            <div className="mb-3">
              <h4 className="font-heading text-base font-semibold text-[#1B4332]">Product Commission</h4>
              <p className="mt-1 text-xs text-[#4A4A4A]">
                MRP Commission uses a percentage of the applicable MRP. Custom Commission uses a fixed amount.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Commission Type</label>
                <select
                  value={form.commission_type || "MRP"}
                  onChange={(e) => update("commission_type", e.target.value)}
                  className="input-base"
                  data-testid="product-commission-type"
                >
                  <option value="MRP">MRP Commission</option>
                  <option value="CUSTOM">Custom Commission</option>
                </select>
              </div>

              <FField
                label={form.commission_type === "CUSTOM" ? "Custom Commission (₹)" : "Commission Rate (%)"}
                type="number"
                min="0"
                max={form.commission_type === "MRP" ? "100" : undefined}
                step="0.01"
                value={form.commission_value ?? 0}
                onChange={(v) => update("commission_value", v)}
                required
                data-testid="product-commission-value"
              />
            </div>
          </div>

          {/* Variants */}
          <div className="sm:col-span-2 rounded-2xl border border-[#E5E5E5] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h4 className="font-heading text-base font-semibold">Product Variants</h4>
                <p className="mt-1 text-xs text-[#4A4A4A]">Add variant price and MRP. Variant MRP is used for MRP commission.</p>
              </div>
              <button type="button" className="btn-secondary whitespace-nowrap" onClick={addVariant}>
                + Add Variant
              </button>
            </div>

            {variants.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#E5E5E5] p-4 text-center text-xs text-[#4A4A4A]">
                No variants added.
              </p>
            ) : (
              <div className="space-y-3">
                {variants.map((v, i) => (
                  <div key={i} className="rounded-xl border border-[#E5E5E5] p-3">
                    <div className="grid gap-3 sm:grid-cols-5">
                      <FField label="Label" value={v.label} onChange={(value) => updateVariant(i, "label", value)} placeholder="500g" />
                      <FField label="Price (₹)" type="number" min="0" step="0.01" value={v.price} onChange={(value) => updateVariant(i, "price", Number(value))} />
                      <FField label="MRP (₹)" type="number" min="0" step="0.01" value={v.mrp} onChange={(value) => updateVariant(i, "mrp", value)} placeholder="25" />
                      <FField label="Unit" value={v.unit} onChange={(value) => updateVariant(i, "unit", value)} placeholder="500g" />
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Stock</label>
                        <div className="flex gap-2">
                          <input type="number" min="0" step="1" value={v.stock} onChange={(e) => updateVariant(i, "stock", Number(e.target.value))} className="input-base min-w-0 flex-1" />
                          <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-red-600 hover:bg-red-50" onClick={() => removeVariant(i)} aria-label={`Remove variant ${i + 1}`}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sm:col-span-2 flex items-center gap-5 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={Boolean(form.featured)} onChange={(e) => update("featured", e.target.checked)} />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={Boolean(form.popular)} onChange={(e) => update("popular", e.target.checked)} />
              Popular
            </label>
          </div>

          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary" data-testid="save-product">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {initial ? "Save changes" : "Save product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FField({ label, type = "text", value, onChange, ...rest }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="input-base" {...rest} />
    </div>
  );
}

/* ================= ORDERS ADMIN ================= */
const ALL_STATUSES = ["Pending", "Accepted", "Preparing", "Packed", "Ready", "Out For Delivery", "Delivered", "Cancelled"];

function OrdersAdmin() {
  const [orders, setOrders] = useState([]);
  const [dps, setDps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [alertMuted, setAlertMuted] = useState(() => localStorage.getItem("admin_new_order_muted") === "1");
  const lastSeenIdRef = useRef(localStorage.getItem("admin_last_seen_order_id") || "");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, d] = await Promise.all([
        api.get(`/admin/orders${filter ? `?status_filter=${encodeURIComponent(filter)}` : ""}`),
        api.get("/admin/delivery-partners"),
      ]);
      setOrders(o.data);
      setDps(d.data.filter((x) => x.active));
    } catch (e) {
      toast.error(formatApiError(e, "Unable to load orders."));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll for new pending orders and refresh the list every 15s
  useEffect(() => {
    let cancelled = false;
    let initialized = Boolean(lastSeenIdRef.current);

    const check = async () => {
      try {
        const { data } = await api.get("/admin/orders/pending-count");
        if (cancelled) return;

        if (data.latest_id) {
          const isNewPending =
            initialized &&
            lastSeenIdRef.current &&
            data.latest_id !== lastSeenIdRef.current;

          if (isNewPending) {
            if (!alertMuted) {
              playAlert();
              toast.success(`New order received! ${data.count} pending`, { duration: 6000 });
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                try {
                  new Notification("Ambajogai — New order", {
                    body: `You have ${data.count} pending order${data.count === 1 ? "" : "s"}. Tap to review.`,
                    tag: "ambajogai-new-order",
                    icon: "/favicon.ico",
                  });
                } catch { /* ignore */ }
              }
            }
          }

          lastSeenIdRef.current = data.latest_id;
          localStorage.setItem("admin_last_seen_order_id", data.latest_id);
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

  const toggleMute = async () => {
    const next = !alertMuted;
    setAlertMuted(next);
    localStorage.setItem("admin_new_order_muted", next ? "1" : "0");
    if (!next) {
      playAlert(); // preview when unmuting
      // Ask for browser-notification permission on first unmute
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        try { await Notification.requestPermission(); } catch { /* ignore */ }
      }
      // Register service worker + subscribe to Web Push (VAPID)
      if ("serviceWorker" in navigator && "PushManager" in window && Notification.permission === "granted") {
        try {
          const reg = await navigator.serviceWorker.register("/sw.js");
          await navigator.serviceWorker.ready;
          const { data } = await api.get("/push/vapid-public-key");
          if (data.public_key) {
            const existing = await reg.pushManager.getSubscription();
            const sub = existing || await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlB64ToUint8Array(data.public_key),
            });
            const json = sub.toJSON();
            await api.post("/push/subscribe", { endpoint: json.endpoint, keys: json.keys });
            toast.success("Background alerts enabled");
          }
        } catch (e) {
          console.warn("Push setup failed", e);
        }
      }
    }
  };

  const setStatus = async (id, status) => {
  try {
    await api.patch(`/admin/orders/${id}/status`, { status });

    toast.success(`Marked ${status}`);

    load();
  } catch (e) {
    toast.error(formatApiError(e));
  }
};

  const assignDp = async (id, dpId) => {
    if (!dpId) return;
    try {
      await api.patch(`/admin/orders/${id}/assign`, { delivery_partner_id: dpId });
      toast.success("Delivery partner assigned");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const notify = async (id, event) => {
    try {
      const { data } = await api.post("/notify/order-whatsapp", { order_id: id, event });
      window.open(data.url, "_blank");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div data-testid="orders-admin">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-2xl font-semibold">Orders</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            filename="orders.csv"
            rows={orders.map((o) => ({
              id: o.id,
              customer: o.user_name,
              phone: o.address?.phone ?? "",
              address: [o.address?.line1, o.address?.area, o.address?.city, o.address?.pincode].filter(Boolean).join(", "),
              total: o.total,
              status: o.status,
              payment: o.payment_method,
              delivery_partner: o.delivery_partner_name || "",
              items: o.items?.length ?? 0,
              created_at: o.created_at,
            }))}
            columns={[
              { key: "id", label: "Order ID" },
              { key: "customer", label: "Customer" },
              { key: "phone", label: "Phone" },
              { key: "address", label: "Address" },
              { key: "total", label: "Total" },
              { key: "status", label: "Status" },
              { key: "payment", label: "Payment" },
              { key: "delivery_partner", label: "Delivery Partner" },
              { key: "items", label: "Items" },
              { key: "created_at", label: "Created At" },
            ]}
          />
          <button
            onClick={toggleMute}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              alertMuted
                ? "border-gray-300 bg-gray-100 text-gray-600 hover:bg-gray-200"
                : "border-[#1B4332] bg-[#1B4332]/5 text-[#1B4332] hover:bg-[#1B4332]/10"
            }`}
            data-testid="new-order-alert-toggle"
            title="Toggle new-order sound alert"
          >
            {alertMuted ? "🔕 Alert muted" : "🔔 Alert on"}
          </button>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input-base w-48">
            <option value="">All</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E5E5E5] p-10 text-center text-[#4A4A4A]">No orders yet.</div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="card-base p-5" data-testid={`admin-order-${o.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-[#4A4A4A]">Order #{o.id.slice(-6).toUpperCase()}</div>
                  <div className="mt-1 font-semibold">{o.user_name} · {o.address.phone}</div>
                  <div className="text-xs text-[#4A4A4A]">
                    {o.address.line1}, {o.address.area}, {o.address.city} - {o.address.pincode}
                  </div>
                  <div className="mt-2 text-xs text-[#4A4A4A]">
                    {o.items.length} items · {o.payment_method} · {new Date(o.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-heading text-xl font-bold text-[#1B4332]">{formatINR(o.total)}</div>
                  <div className="mt-2">
                    <select
                      value={o.status}
                      onChange={(e) => setStatus(o.id, e.target.value)}
                      className="input-base w-44 text-sm"
                      data-testid={`status-select-${o.id}`}
                    >
                      {allowedNextStatuses(o.status).map((s) => (
                        <option key={s} value={s}>{s}{s === o.status ? " (current)" : ""}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-[#1B4332] hover:text-[#E07A5F]">View items</summary>
                <div className="mt-3 space-y-2">
                  {o.items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <img src={it.image} alt="" className="h-8 w-8 rounded object-cover" />
                      <span className="flex-1">{it.name}</span>
                      <span className="text-[#4A4A4A]">×{it.quantity}</span>
                      <span className="font-semibold">{formatINR(it.price * it.quantity)}</span>
                    </div>
                  ))}
                </div>
              </details>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed pt-3 text-xs">
                <span className="font-semibold text-[#4A4A4A]">Delivery:</span>
                {o.delivery_partner_name ? (
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800" data-testid={`dp-assigned-${o.id}`}>
                    {o.delivery_partner_name} · ₹{o.delivery_boy_earning || 0}
                  </span>
                ) : (
                  <span className="text-[#4A4A4A]">Not assigned</span>
                )}
                <select
                  onChange={(e) => { assignDp(o.id, e.target.value); e.target.value = ""; }}
                  defaultValue=""
                  className="input-base w-40 py-1.5 text-xs"
                  data-testid={`assign-dp-${o.id}`}
                >
                  <option value="">{o.delivery_partner_name ? "Reassign…" : "Assign to…"}</option>
                  {dps.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <span className="mx-2 text-[#4A4A4A]">·</span>
                <span className="font-semibold text-[#4A4A4A]">WhatsApp:</span>
                {["accepted", "dispatched", "delivered"].map((ev) => (
                  <button
                    key={ev}
                    onClick={() => notify(o.id, ev)}
                    className="rounded-full border border-[#25D366] px-2.5 py-0.5 text-xs font-semibold text-[#25D366] hover:bg-[#25D366]/10"
                    data-testid={`wa-${ev}-${o.id}`}
                  >
                    {ev}
                  </button>
                ))}
                {o.status === "Delivered" && (
                  <button
                    onClick={() => notify(o.id, "feedback")}
                    className="rounded-full border border-[#E07A5F] px-2.5 py-0.5 text-xs font-semibold text-[#E07A5F] hover:bg-[#E07A5F]/10"
                    data-testid={`wa-feedback-${o.id}`}
                  >
                    Ask feedback
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= CUSTOMERS ================= */
function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/customers").then(({ data }) => setCustomers(data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  return (
    <div data-testid="customers-admin">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-2xl font-semibold">Customers ({customers.length})</h2>
        <ExportMenu
          filename="customers.csv"
          rows={customers.map((c) => ({
            name: c.name,
            email: c.email,
            phone: c.phone || "",
            joined: c.created_at ? new Date(c.created_at).toLocaleDateString("en-IN") : "",
          }))}
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
            { key: "joined", label: "Joined" },
          ]}
        />
      </div>
      <div className="card-base overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-[#4A4A4A]">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t border-[#E5E5E5]">
                <td className="px-4 py-3 font-semibold">{c.name}</td>
                <td className="px-4 py-3 text-[#4A4A4A]">{c.email}</td>
                <td className="px-4 py-3 text-[#4A4A4A]">{c.phone || "—"}</td>
                <td className="px-4 py-3 text-[#4A4A4A]">
                  {c.created_at ? new Date(c.created_at).toLocaleDateString("en-IN") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= CATEGORIES ================= */
function Categories() {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", slug: "", image: "", description: "" });
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get("/categories");
    setCats(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, slug: form.slug || slugify(form.name) };
      if (editing) {
        await api.put(`/categories/${editing.id}`, payload);
        toast.success("Category updated");
      } else {
        await api.post("/categories", payload);
        toast.success("Category created");
      }
      setForm({ name: "", slug: "", image: "", description: "" });
      setEditing(null);
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const startEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, slug: c.slug, image: c.image || "", description: c.description || "" });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ name: "", slug: "", image: "", description: "" });
  };

  const del = async (id) => {
    if (!window.confirm("Delete this category?")) return;
    await api.delete(`/categories/${id}`);
    load();
  };

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  return (
    <div data-testid="categories-admin">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-2xl font-semibold">Categories ({cats.length})</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            filename="categories.csv"
            rows={cats}
            columns={[
              { key: "name", label: "Name" },
              { key: "slug", label: "Slug" },
              { key: "description", label: "Description" },
              { key: "image", label: "Image URL" },
            ]}
          />
          <button
            onClick={() => {
              setEditing(null);
              setForm({ name: "", slug: "", image: "", description: "" });
              setShowForm((v) => !v);
            }}
            className="btn-primary"
            data-testid="new-category"
          >
            <Plus className="h-4 w-4" /> Add category
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="card-base mb-6 grid gap-4 p-6 sm:grid-cols-2">
          <p className="sm:col-span-2 text-sm font-semibold text-[#1B4332]">
            {editing ? "Edit category" : "New category"}
          </p>
          <FField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required data-testid="category-name" />
          <FField label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} placeholder="auto from name" data-testid="category-slug" />
          <div className="sm:col-span-2">
            <ImageSourcePicker
              label="Category image"
              value={form.image}
              onChange={(v) => setForm({ ...form, image: v })}
              testIdPrefix="category-image"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-3">
            <button type="button" onClick={cancelForm} className="btn-secondary">Cancel</button>
            <button className="btn-primary" data-testid="save-category">{editing ? "Update" : "Save"}</button>
          </div>
        </form>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {cats.map((c) => (
          <div key={c.id} className="card-base flex items-center gap-4 p-4">
            {c.image && <img src={c.image} alt="" className="h-12 w-12 rounded-lg object-cover" />}
            <div className="flex-1">
              <div className="font-semibold">{c.name}</div>
              <div className="text-xs text-[#4A4A4A]">{c.slug}</div>
            </div>
            <button onClick={() => startEdit(c)} className="text-[#1B4332] hover:text-[#E07A5F]" aria-label="Edit category">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={() => del(c.id)} className="text-red-600 hover:text-red-800">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}


/* ================= VENDORS ADMIN ================= */
function VendorsAdmin() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get(`/admin/vendors${filter ? `?status_filter=${filter}` : ""}`);
    setVendors(data);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status, reason = "") => {
    try {
      await api.patch(`/admin/vendors/${id}/status`, { status, reason });
      toast.success(`Vendor ${status.toLowerCase()}`);
      setSelected(null);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  return (
    <div data-testid="vendors-admin">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-2xl font-semibold">Vendors ({vendors.length})</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            filename="vendors.csv"
            rows={vendors.map((v) => ({
              business_name: v.business_name,
              owner_name: v.owner_name,
              email: v.owner_email,
              phone: v.phone,
              status: v.status,
              pincode: v.business_pincode,
              address: v.business_address,
            }))}
            columns={[
              { key: "business_name", label: "Business" },
              { key: "owner_name", label: "Owner" },
              { key: "email", label: "Email" },
              { key: "phone", label: "Phone" },
              { key: "status", label: "Status" },
              { key: "pincode", label: "Pincode" },
              { key: "address", label: "Address" },
            ]}
          />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input-base w-48">
            <option value="">All statuses</option>
            {["Pending", "Under Review", "Approved", "Rejected", "Suspended", "Blocked"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {vendors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E5E5E5] p-10 text-center text-[#4A4A4A]">No vendors match.</div>
      ) : (
        <div className="space-y-4">
          {vendors.map((v) => (
            <div key={v.id} className="card-base p-5" data-testid={`admin-vendor-${v.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-heading text-lg font-semibold">{v.business_name}</div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      v.status === "Approved" ? "bg-green-100 text-green-700" :
                      v.status === "Rejected" ? "bg-red-100 text-red-700" :
                      v.status === "Suspended" ? "bg-gray-200 text-gray-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>{v.status}</span>
                  </div>
                  <div className="mt-1 text-sm text-[#4A4A4A]">{v.owner_name} · {v.owner_email} · {v.phone}</div>
                  <div className="text-xs text-[#4A4A4A]">{v.business_address} - {v.business_pincode}</div>
                  {v.business_description && <div className="mt-1 text-xs italic text-[#4A4A4A]">&ldquo;{v.business_description}&rdquo;</div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelected(v)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#1B4332] px-3 py-1.5 text-xs font-semibold text-[#1B4332] hover:bg-[#1B4332]/10"
                    data-testid={`view-docs-${v.id}`}
                  >
                    View docs
                  </button>
                  {v.status !== "Approved" && (
                    <button onClick={() => setStatus(v.id, "Approved")} className="inline-flex items-center gap-1 rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700" data-testid={`approve-${v.id}`}>
                      <Check className="h-3.5 w-3.5" /> Approve
                    </button>
                  )}
                  {v.status === "Approved" && (
                    <button onClick={() => setStatus(v.id, "Suspended")} className="inline-flex items-center gap-1 rounded-full bg-gray-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700" data-testid={`suspend-${v.id}`}>
                      <Ban className="h-3.5 w-3.5" /> Suspend
                    </button>
                  )}
                  {v.status !== "Rejected" && v.status !== "Approved" && (
                    <button
                      onClick={() => {
                        const reason = window.prompt("Reason for rejection?");
                        if (reason !== null) setStatus(v.id, "Rejected", reason);
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                      data-testid={`reject-${v.id}`}
                    >
                      <Ban className="h-3.5 w-3.5" /> Reject
                    </button>
                  )}
                </div>
              </div>
              {v.status === "Rejected" && v.rejection_reason && (
                <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-800">
                  Rejection reason: {v.rejection_reason}
                </div>
              )}

              {v.status === "Approved" && (
                <div className="mt-3 border-t border-dashed pt-3 text-xs text-[#4A4A4A]">
                  Vendors receive 100% of product earnings — no platform fee deducted from payouts.
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="vendor-docs-modal">
          <div className="card-base max-h-[90vh] w-full max-w-2xl overflow-auto p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-heading text-xl font-semibold">Documents · {selected.business_name}</h3>
              <button onClick={() => setSelected(null)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 text-sm">
              {["aadhar_url", "gst_url", "shop_license_url"].map((k) => (
                <div key={k}>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#4A4A4A]">{k.replace(/_url$/, "").replace(/_/g, " ")}</div>
                  {selected.docs?.[k] ? (
                    <a href={selected.docs[k]} target="_blank" rel="noopener noreferrer" className="break-all text-[#1B4332] underline">
                      {selected.docs[k]}
                    </a>
                  ) : (
                    <div className="text-gray-400">Not provided</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= COUPONS ADMIN ================= */
function CouponsAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState({ code: "", discount_pct: 10, min_amount: 0, active: true, expires_at: "" });

  const emptyForm = { code: "", discount_pct: 10, min_amount: 0, active: true, expires_at: "" };

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get("/admin/coupons");
    setItems(data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setF(emptyForm);
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setF({
      code: c.code,
      discount_pct: c.discount_pct,
      min_amount: c.min_amount || 0,
      active: !!c.active,
      expires_at: c.expires_at ? c.expires_at.slice(0, 10) : "",
    });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        code: f.code.trim(),
        discount_pct: Number(f.discount_pct),
        min_amount: Number(f.min_amount),
        active: !!f.active,
        expires_at: f.expires_at ? new Date(f.expires_at).toISOString() : null,
      };
      if (editing) {
        await api.put(`/admin/coupons/${editing.id}`, payload);
        toast.success("Coupon updated");
      } else {
        await api.post("/admin/coupons", payload);
        toast.success("Coupon created");
      }
      setShowForm(false);
      setEditing(null);
      setF(emptyForm);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const toggleActive = async (c) => {
    try {
      await api.put(`/admin/coupons/${c.id}`, {
        code: c.code,
        discount_pct: c.discount_pct,
        min_amount: c.min_amount || 0,
        active: !c.active,
        expires_at: c.expires_at || null,
      });
      toast.success(c.active ? "Coupon deactivated" : "Coupon activated");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this coupon?")) return;
    await api.delete(`/admin/coupons/${id}`);
    load();
  };

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  return (
    <div data-testid="coupons-admin">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-2xl font-semibold">Coupons ({items.length})</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            filename="coupons.csv"
            rows={items.map((c) => ({
              code: c.code,
              discount_pct: c.discount_pct,
              min_amount: c.min_amount || 0,
              active: c.active ? "Yes" : "No",
              expires_at: c.expires_at ? new Date(c.expires_at).toLocaleDateString("en-IN") : "",
            }))}
            columns={[
              { key: "code", label: "Code" },
              { key: "discount_pct", label: "Discount %" },
              { key: "min_amount", label: "Min Order" },
              { key: "active", label: "Active" },
              { key: "expires_at", label: "Expires" },
            ]}
          />
          <button onClick={openCreate} className="btn-primary" data-testid="new-coupon">
            <Plus className="h-4 w-4" /> New coupon
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="card-base mb-6 grid gap-4 p-6 sm:grid-cols-2">
          <p className="sm:col-span-2 text-sm font-semibold text-[#1B4332]">
            {editing ? `Edit coupon · ${editing.code}` : "New coupon"}
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Code</label>
            <input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} required className="input-base" data-testid="coupon-code" placeholder="WELCOME10" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Discount %</label>
            <input type="number" min="1" max="90" value={f.discount_pct} onChange={(e) => setF({ ...f, discount_pct: e.target.value })} required className="input-base" data-testid="coupon-pct" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Min order amount (₹)</label>
            <input type="number" min="0" value={f.min_amount} onChange={(e) => setF({ ...f, min_amount: e.target.value })} className="input-base" data-testid="coupon-min" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Expires on (optional)</label>
            <input type="date" value={f.expires_at} onChange={(e) => setF({ ...f, expires_at: e.target.value })} className="input-base" data-testid="coupon-expiry" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            Active
          </label>
          <div className="sm:col-span-2 flex justify-end gap-3">
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary">Cancel</button>
            <button className="btn-primary" data-testid="save-coupon">{editing ? "Update" : "Save"}</button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E5E5E5] p-10 text-center text-[#4A4A4A]">No coupons yet.</div>
      ) : (
        <div className="card-base overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-[#4A4A4A]">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Min order</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-[#E5E5E5]" data-testid={`coupon-row-${c.code}`}>
                  <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
                  <td className="px-4 py-3">{c.discount_pct}%</td>
                  <td className="px-4 py-3">{formatINR(c.min_amount || 0)}</td>
                  <td className="px-4 py-3 text-[#4A4A4A]">
                    {c.expires_at ? new Date(c.expires_at).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {c.active ? <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Yes</span> : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">No</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(c)} className="mr-2 inline-grid h-8 w-8 place-items-center rounded-full text-[#1B4332] hover:bg-gray-100" aria-label="Edit coupon">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => toggleActive(c)} className="mr-2 rounded-full border border-[#1B4332] px-2 py-0.5 text-xs font-semibold text-[#1B4332] hover:bg-[#1B4332]/10">
                      {c.active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => del(c.id)} className="text-red-600 hover:text-red-800">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================= SALES ANALYTICS ADMIN ================= */
function Analytics() {
  const [data, setData] = useState(null);
  const [perf, setPerf] = useState([]);
  const [days, setDays] = useState(14);

  useEffect(() => {
    api.get(`/admin/analytics?days=${days}`).then(({ data }) => setData(data)).catch(() => {});
    api.get("/admin/vendors/performance").then(({ data }) => setPerf(data)).catch(() => {});
  }, [days]);

  if (!data) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  const maxRev = Math.max(1, ...data.daily_trend.map((d) => d.revenue));
  const kpis = [
    { label: "Total revenue", value: formatINR(data.total_revenue), color: "bg-[#1B4332]" },
    { label: "Delivered orders", value: data.delivered_orders, color: "bg-[#E07A5F]" },
    { label: "Vendor payout", value: formatINR(data.total_vendor_payout), color: "bg-[#8BA888]" },
    { label: "Cancelled orders", value: data.cancelled_orders, color: "bg-red-600" },
  ];

  return (
    <div className="space-y-8" data-testid="admin-analytics">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-2xl font-semibold">Sales analytics</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            testId="analytics-export"
            exports={[
              {
                label: "Daily trend",
                filename: "analytics-daily-trend.csv",
                title: "Daily Revenue Trend",
                rows: data.daily_trend,
                columns: [
                  { key: "date", label: "Date" },
                  { key: "revenue", label: "Revenue" },
                  { key: "orders", label: "Orders" },
                ],
              },
              {
                label: "Top vendors",
                filename: "analytics-top-vendors.csv",
                title: "Top Vendors",
                rows: data.top_vendors,
                columns: [
                  { key: "vendor_name", label: "Vendor" },
                  { key: "gross", label: "Gross" },
                  { key: "net_payout", label: "Vendor Payout" },
                  { key: "delivered_items", label: "Items" },
                ],
              },
              {
                label: "Top products",
                filename: "analytics-top-products.csv",
                title: "Top Products",
                rows: data.top_products,
                columns: [
                  { key: "name", label: "Product" },
                  { key: "qty", label: "Qty Sold" },
                  { key: "revenue", label: "Revenue" },
                ],
              },
              {
                label: "Vendor performance",
                filename: "vendor-performance.csv",
                title: "Vendor Performance",
                rows: perf,
                columns: [
                  { key: "business_name", label: "Vendor" },
                  { key: "avg_rating", label: "Rating" },
                  { key: "total_orders", label: "Orders" },
                  { key: "delivered_orders", label: "Delivered" },
                  { key: "cancelled_orders", label: "Cancelled" },
                  { key: "completion_rate", label: "Completion %" },
                  { key: "gross_sales", label: "Gross Sales" },
                ],
              },
            ]}
          />
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="input-base w-40 text-sm">
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card-base p-5">
            <div className={`h-1.5 w-10 rounded-full ${k.color}`} />
            <div className="mt-3 text-xs uppercase tracking-wider text-[#4A4A4A]">{k.label}</div>
            <div className="mt-1 font-heading text-2xl font-bold">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="card-base p-6" data-testid="trend-chart">
        <h3 className="font-heading text-lg font-semibold">Revenue trend</h3>
        <div className="mt-6 flex h-48 items-stretch gap-1">
          {data.daily_trend.map((d) => {
            const h = maxRev > 0 ? (d.revenue / maxRev) * 100 : 0;
            return (
              <div key={d.date} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div className="relative w-full flex-1">
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-t bg-[#1B4332]/70 transition-all group-hover:bg-[#1B4332]"
                    style={{ height: `${Math.max(2, h)}%` }}
                  />
                  <div className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                    {formatINR(d.revenue)} · {d.orders} orders
                  </div>
                </div>
                <div className="text-[10px] text-[#4A4A4A]">{d.date.slice(5)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-base p-6">
          <h3 className="font-heading text-lg font-semibold">Top vendors</h3>
          {data.top_vendors.length === 0 ? (
            <p className="mt-3 text-sm text-[#4A4A4A]">No delivered vendor items yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {data.top_vendors.map((v) => (
                <div key={v.vendor_id} className="flex items-center justify-between border-b border-dashed pb-2 last:border-0" data-testid={`top-vendor-${v.vendor_id}`}>
                  <div>
                    <div className="text-sm font-semibold">{v.vendor_name}</div>
                    <div className="text-xs text-[#4A4A4A]">{v.delivered_items} items delivered</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#1B4332]">{formatINR(v.net_payout)}</div>
                    <div className="text-xs text-[#4A4A4A]">Full vendor earnings</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card-base p-6">
          <h3 className="font-heading text-lg font-semibold">Top products</h3>
          {data.top_products.length === 0 ? (
            <p className="mt-3 text-sm text-[#4A4A4A]">No delivered products yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {data.top_products.map((p) => (
                <div key={p.product_id} className="flex items-center gap-3">
                  <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-[#4A4A4A]">sold {p.qty}</div>
                  </div>
                  <div className="text-sm font-bold text-[#1B4332]">{formatINR(p.revenue)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Vendor performance */}
      <div className="card-base p-6" data-testid="vendor-performance">
        <div className="mb-4 flex items-center gap-2">
          <Award className="h-5 w-5 text-[#E07A5F]" />
          <h3 className="font-heading text-lg font-semibold">Vendor performance</h3>
        </div>
        {perf.length === 0 ? (
          <p className="text-sm text-[#4A4A4A]">No approved vendors yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-[#4A4A4A]">
                <tr>
                  <th className="px-4 py-2">Vendor</th>
                  <th className="px-4 py-2">Rating</th>
                  <th className="px-4 py-2">Orders</th>
                  <th className="px-4 py-2">Completion %</th>
                  <th className="px-4 py-2">Gross sales</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {perf.map((v) => (
                  <tr key={v.vendor_id} className="border-t border-[#E5E5E5]" data-testid={`perf-row-${v.vendor_id}`}>
                    <td className="px-4 py-2 font-semibold">{v.business_name}</td>
                    <td className="px-4 py-2 text-[#4A4A4A]">{v.avg_rating != null ? `${v.avg_rating} ★ (${v.review_count})` : "—"}</td>
                    <td className="px-4 py-2 text-[#4A4A4A]">{v.total_orders} · ✓{v.delivered_orders} · ✕{v.cancelled_orders}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${v.completion_rate >= 80 ? "bg-green-100 text-green-700" : v.completion_rate >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                        {v.completion_rate}%
                      </span>
                    </td>
                    <td className="px-4 py-2 font-semibold">{formatINR(v.gross_sales)}</td>
                    <td className="px-4 py-2">
                      {v.vacation_mode ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Vacation</span> :
                       !v.open_now ? <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">Closed</span> :
                       <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Open</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= DELIVERY BOYS ADMIN ================= */
function DeliveryAdmin() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState({ name: "", email: "", password: "", phone: "", vehicle: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get("/admin/delivery-partners");
    setList(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/delivery-partners", { ...f });
      toast.success("Delivery partner added");
      setShowForm(false);
      setF({ name: "", email: "", password: "", phone: "", vehicle: "" });
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const toggle = async (id, active) => {
    try {
      await api.patch(`/admin/delivery-partners/${id}`, { active });
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this delivery partner?")) return;
    await api.delete(`/admin/delivery-partners/${id}`);
    load();
  };

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  return (
    <div data-testid="delivery-admin">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-2xl font-semibold">Delivery boys ({list.length})</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            filename="delivery-partners.csv"
            rows={list.map((d) => ({
              name: d.name,
              email: d.email,
              phone: d.phone,
              vehicle: d.vehicle || "",
              active: d.active ? "Yes" : "No",
            }))}
            columns={[
              { key: "name", label: "Name" },
              { key: "email", label: "Email" },
              { key: "phone", label: "Phone" },
              { key: "vehicle", label: "Vehicle" },
              { key: "active", label: "Active" },
            ]}
          />
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary" data-testid="new-delivery-boy">
            <Plus className="h-4 w-4" /> Add delivery boy
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="card-base mb-6 grid gap-4 p-6 sm:grid-cols-2">
          <FField label="Name" value={f.name} onChange={(v) => setF({ ...f, name: v })} required />
          <FField label="Phone" value={f.phone} onChange={(v) => setF({ ...f, phone: v })} required placeholder="+91..." />
          <FField label="Email" type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} required />
          <FField label="Password" type="password" value={f.password} onChange={(v) => setF({ ...f, password: v })} required placeholder="Min 6 chars" />
          <div className="sm:col-span-2">
            <FField label="Vehicle (optional)" value={f.vehicle} onChange={(v) => setF({ ...f, vehicle: v })} placeholder="Honda Activa (MH14-AB-1234)" />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" data-testid="save-delivery-boy">Save</button>
          </div>
        </form>
      )}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E5E5E5] p-10 text-center text-[#4A4A4A]">
          No delivery boys yet. Add one so you can assign deliveries from the Orders tab.
        </div>
      ) : (
        <div className="card-base overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-[#4A4A4A]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} className="border-t border-[#E5E5E5]" data-testid={`dp-row-${d.id}`}>
                  <td className="px-4 py-3 font-semibold">{d.name}</td>
                  <td className="px-4 py-3 text-[#4A4A4A]">{d.email} · {d.phone}</td>
                  <td className="px-4 py-3 text-[#4A4A4A]">{d.vehicle || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"}`}>
                      {d.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toggle(d.id, !d.active)} className="mr-2 rounded-full border border-[#1B4332] px-2 py-0.5 text-xs font-semibold text-[#1B4332] hover:bg-[#1B4332]/10" data-testid={`dp-toggle-${d.id}`}>
                      {d.active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => del(d.id)} className="text-red-600 hover:text-red-800"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================= OFFERS ADMIN ================= */
const OFFER_COLORS = [
  { label: "Forest green", value: "#1B4332" },
  { label: "Coral", value: "#E07A5F" },
  { label: "Sage", value: "#8BA888" },
  { label: "Amber", value: "#F4A261" },
  { label: "Navy", value: "#1D3557" },
  { label: "Plum", value: "#6D4C7D" },
];

function OffersAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState({
    title: "",
    subtitle: "",
    bg_color: "#1B4332",
    link: "",
    active: true,
    sort_order: 0,
  });

  const emptyForm = {
    title: "",
    subtitle: "",
    bg_color: "#1B4332",
    link: "",
    active: true,
    sort_order: 0,
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/offers");
      setItems(data);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setF({ ...emptyForm, sort_order: items.length });
    setShowForm(true);
  };

  const openEdit = (o) => {
    setEditing(o);
    setF({
      title: o.title,
      subtitle: o.subtitle || "",
      bg_color: o.bg_color || "#1B4332",
      link: o.link || "",
      active: !!o.active,
      sort_order: o.sort_order ?? 0,
    });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!f.title.trim()) {
      toast.error("Title is required");
      return;
    }
    try {
      const payload = {
        title: f.title.trim(),
        subtitle: f.subtitle.trim(),
        bg_color: f.bg_color,
        link: f.link.trim() || null,
        active: !!f.active,
        sort_order: Number(f.sort_order) || 0,
      };
      if (editing) {
        await api.put(`/admin/offers/${editing.id}`, payload);
        toast.success("Offer updated");
      } else {
        await api.post("/admin/offers", payload);
        toast.success("Offer created");
      }
      setShowForm(false);
      setEditing(null);
      setF(emptyForm);
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const toggleActive = async (o) => {
    try {
      await api.put(`/admin/offers/${o.id}`, {
        title: o.title,
        subtitle: o.subtitle || "",
        bg_color: o.bg_color || "#1B4332",
        link: o.link || null,
        active: !o.active,
        sort_order: o.sort_order ?? 0,
      });
      toast.success(o.active ? "Offer hidden from homepage" : "Offer published");
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this offer?")) return;
    try {
      await api.delete(`/admin/offers/${id}`);
      toast.success("Offer deleted");
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  return (
    <div data-testid="offers-admin">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Homepage offers ({items.length})</h2>
          <p className="mt-1 text-xs text-[#4A4A4A]">
            Control promotional banners shown on the homepage. Active offers appear in order.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            filename="offers.csv"
            rows={items.map((o) => ({
              title: o.title,
              subtitle: o.subtitle,
              bg_color: o.bg_color,
              link: o.link || "",
              active: o.active ? "Yes" : "No",
              sort_order: o.sort_order ?? 0,
            }))}
            columns={[
              { key: "title", label: "Title" },
              { key: "subtitle", label: "Subtitle" },
              { key: "bg_color", label: "Background" },
              { key: "link", label: "Link" },
              { key: "active", label: "Active" },
              { key: "sort_order", label: "Sort Order" },
            ]}
          />
          <button onClick={openCreate} className="btn-primary" data-testid="new-offer">
            <Plus className="h-4 w-4" /> New offer
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="card-base mb-6 grid gap-4 p-6 sm:grid-cols-2">
          <p className="sm:col-span-2 text-sm font-semibold text-[#1B4332]">
            {editing ? "Edit offer" : "New offer"}
          </p>
          <FField label="Title" value={f.title} onChange={(v) => setF({ ...f, title: v })} required placeholder="10% off" data-testid="offer-title" />
          <FField label="Subtitle" value={f.subtitle} onChange={(v) => setF({ ...f, subtitle: v })} placeholder="on your first order" data-testid="offer-subtitle" />
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Banner color</label>
            <select value={f.bg_color} onChange={(e) => setF({ ...f, bg_color: e.target.value })} className="input-base" data-testid="offer-color">
              {OFFER_COLORS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <FField label="Sort order" type="number" min="0" value={f.sort_order} onChange={(v) => setF({ ...f, sort_order: v })} data-testid="offer-sort" />
          <div className="sm:col-span-2">
            <FField label="Link (optional)" value={f.link} onChange={(v) => setF({ ...f, link: v })} placeholder="/products or https://…" data-testid="offer-link" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            Active (visible on homepage)
          </label>
          <div className="sm:col-span-2 rounded-2xl p-5 text-white" style={{ backgroundColor: f.bg_color }}>
            <div className="font-heading text-xl font-bold">{f.title || "Preview title"}</div>
            <div className="mt-1 text-sm opacity-90">{f.subtitle || "Preview subtitle"}</div>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-3">
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary">Cancel</button>
            <button className="btn-primary" data-testid="save-offer">{editing ? "Update offer" : "Create offer"}</button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E5E5E5] p-10 text-center text-[#4A4A4A]">
          No offers yet. Create one to show on the homepage.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((o) => (
            <div key={o.id} className="card-base overflow-hidden" data-testid={`offer-card-${o.id}`}>
              <div className="p-5 text-white" style={{ backgroundColor: o.bg_color || "#1B4332" }}>
                <div className="font-heading text-xl font-bold">{o.title}</div>
                <div className="mt-1 text-sm opacity-90">{o.subtitle}</div>
              </div>
              <div className="space-y-2 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[#4A4A4A]">Status</span>
                  {o.active ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Active</span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">Hidden</span>
                  )}
                </div>
                {o.link && (
                  <div className="truncate text-xs text-[#4A4A4A]">Link: {o.link}</div>
                )}
                <div className="text-xs text-[#4A4A4A]">Order: {o.sort_order ?? 0}</div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button onClick={() => openEdit(o)} className="inline-flex items-center gap-1 rounded-full border border-[#1B4332] px-3 py-1 text-xs font-semibold text-[#1B4332] hover:bg-[#1B4332]/10">
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button onClick={() => toggleActive(o)} className="rounded-full border border-gray-300 px-3 py-1 text-xs font-semibold text-[#4A4A4A] hover:bg-gray-50">
                    {o.active ? "Hide" : "Publish"}
                  </button>
                  <button onClick={() => del(o.id)} className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
