import { useEffect, useState, useCallback } from "react";
import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import { api, formatINR, formatApiError } from "@/lib/api";
import { toast } from "sonner";
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
} from "lucide-react";

const adminLinks = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/vendors", label: "Vendors", icon: Store },
  { to: "/admin/delivery", label: "Delivery Boys", icon: Truck },
  { to: "/admin/coupons", label: "Coupons", icon: Ticket },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/categories", label: "Categories", icon: Tag },
];

export default function Admin() {
  return (
    <div className="container-app py-8" data-testid="admin-page">
      <h1 className="font-heading text-3xl font-bold sm:text-4xl">Admin panel</h1>
      <p className="mt-2 text-sm text-[#4A4A4A]">Manage products, orders, and store operations</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-1">
          {adminLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
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

        <div>
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="products" element={<ProductsAdmin />} />
            <Route path="orders" element={<OrdersAdmin />} />
            <Route path="vendors" element={<VendorsAdmin />} />
            <Route path="delivery" element={<DeliveryAdmin />} />
            <Route path="coupons" element={<CouponsAdmin />} />
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

  useEffect(() => {
    api.get("/admin/dashboard").then(({ data }) => setData(data)).catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B4332]" />
      </div>
    );
  }

  const stats = [
    { label: "Revenue (delivered)", value: formatINR(data.revenue), icon: TrendingUp, color: "bg-[#1B4332]" },
    { label: "Orders", value: data.total_orders, icon: ShoppingBag, color: "bg-[#E07A5F]" },
    { label: "Approved vendors", value: data.total_vendors ?? 0, icon: Store, color: "bg-[#F4A261]" },
    { label: "Customers", value: data.total_users, icon: Users, color: "bg-[#8BA888]" },
  ];

  return (
    <div className="space-y-8" data-testid="dashboard">
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
    const [p, c] = await Promise.all([api.get("/admin/products"), api.get("/categories")]);
    setProducts(p.data);
    setCategories(c.data);
    setLoading(false);
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
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-heading text-2xl font-semibold">Products ({products.length})</h2>
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

      <div className="card-base overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-[#4A4A4A]">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Approval</th>
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
                  <td className="px-4 py-3 text-[#4A4A4A]">
                    {p.vendor_name || <span className="italic text-gray-400">Store</span>}
                  </td>
                  <td className="px-4 py-3 font-semibold">{formatINR(p.price)}</td>
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
              ))}
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
    }
  );

  const [variants, setVariants] = useState(initial?.variants || []);
  const [saving, setSaving] = useState(false);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        slug: form.slug || slugify(form.name),
        price: Number(form.price),
        mrp: form.mrp ? Number(form.mrp) : null,
        stock: Number(form.stock),
        variants: variants,
      };
      if (initial) await api.put(`/products/${initial.id}`, payload);
      else await api.post("/products", payload);
      toast.success("Saved");
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="product-form-modal">
      <div className="card-base max-h-[90vh] w-full max-w-2xl overflow-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-xl font-semibold">{initial ? "Edit product" : "New product"}</h3>
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
          <FField label="Price (₹)" type="number" value={form.price} onChange={(v) => update("price", v)} required data-testid="product-price" />
          <FField label="MRP (₹)" type="number" value={form.mrp || ""} onChange={(v) => update("mrp", v)} data-testid="product-mrp" />
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
            <FField label="Image URL" value={form.image} onChange={(v) => update("image", v)} required data-testid="product-image" />
          </div>
          <FField label="Stock" type="number" value={form.stock} onChange={(v) => update("stock", v)} required data-testid="product-stock" />
           <FField
  label="Stock"
  type="number"
  value={form.stock}
  onChange={(v) => update("stock", v)}
  required
  data-testid="product-stock"
/>

<div className="sm:col-span-2">
  <label className="mb-2 block text-xs font-semibold text-[#4A4A4A]">
    Product Variants
  </label>

  {variants.map((v, i) => (
    <div key={i} className="mb-2 flex gap-2">
      <input
        className="input-base flex-1"
        placeholder="Label (500g)"
        value={v.label}
        onChange={(e) => {
          const copy = [...variants];
          copy[i].label = e.target.value;
          setVariants(copy);
        }}
      />

      <input
        className="input-base w-28"
        type="number"
        placeholder="Price"
        value={v.price}
        onChange={(e) => {
          const copy = [...variants];
          copy[i].price = Number(e.target.value);
          setVariants(copy);
        }}
      />

      <input
        className="input-base w-28"
        placeholder="Unit"
        value={v.unit}
        onChange={(e) => {
          const copy = [...variants];
          copy[i].unit = e.target.value;
          setVariants(copy);
        }}
      />

      <button
        type="button"
        className="btn-secondary"
        onClick={() => setVariants(variants.filter((_, idx) => idx !== i))}
      >
        ✕
      </button>
    </div>
  ))}

  <button
    type="button"
    className="btn-secondary mt-2"
    onClick={() =>
      setVariants([
        ...variants,
        { label: "", price: 0, unit: "" },
      ])
    }
  >
    + Add Variant
  </button>
</div>

<div className="flex items-center gap-4 pt-6">
  <label className="flex items-center gap-2 text-sm">
    <input
      type="checkbox"
      checked={form.featured}
      onChange={(e) => update("featured", e.target.checked)}
    />
    Featured
  </label>

  <label className="flex items-center gap-2 text-sm">
    <input
      type="checkbox"
      checked={form.popular}
      onChange={(e) => update("popular", e.target.checked)}
    />
    Popular
  </label>
</div> 
           <div className="flex items-center gap-4 pt-6">
  ...
</div>
          <div className="flex items-center gap-4 pt-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.featured} onChange={(e) => update("featured", e.target.checked)} />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.popular} onChange={(e) => update("popular", e.target.checked)} />
              Popular
            </label>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary" data-testid="save-product">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
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

  const load = useCallback(async () => {
    setLoading(true);
    const [o, d] = await Promise.all([
      api.get(`/admin/orders${filter ? `?status=${encodeURIComponent(filter)}` : ""}`),
      api.get("/admin/delivery-partners"),
    ]);
    setOrders(o.data);
    setDps(d.data.filter((x) => x.active));
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

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
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-heading text-2xl font-semibold">Orders</h2>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input-base w-48">
          <option value="">All</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
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
                      {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
      <h2 className="mb-6 font-heading text-2xl font-semibold">Customers ({customers.length})</h2>
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
      await api.post("/categories", { ...form, slug: form.slug || slugify(form.name) });
      toast.success("Category created");
      setForm({ name: "", slug: "", image: "", description: "" });
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this category?")) return;
    await api.delete(`/categories/${id}`);
    load();
  };

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  return (
    <div data-testid="categories-admin">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-heading text-2xl font-semibold">Categories ({cats.length})</h2>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
          <Plus className="h-4 w-4" /> Add category
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="card-base mb-6 grid gap-4 p-6 sm:grid-cols-2">
          <FField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <FField label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} placeholder="auto from name" />
          <div className="sm:col-span-2">
            <FField label="Image URL" value={form.image} onChange={(v) => setForm({ ...form, image: v })} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button className="btn-primary">Save</button>
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
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-heading text-2xl font-semibold">Vendors ({vendors.length})</h2>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input-base w-48">
          <option value="">All statuses</option>
          {["Pending", "Approved", "Rejected", "Suspended"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
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
                  {v.business_description && <div className="mt-1 text-xs italic text-[#4A4A4A]">"{v.business_description}"</div>}
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
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed pt-3 text-xs">
                  <span className="font-semibold text-[#4A4A4A]">Commission %:</span>
                  <input
                    type="number"
                    min="0"
                    max="90"
                    defaultValue={v.commission_pct ?? 10}
                    onBlur={async (e) => {
                      const pct = Number(e.target.value);
                      if (isNaN(pct) || pct === (v.commission_pct ?? 10)) return;
                      try {
                        await api.patch(`/admin/vendors/${v.id}/commission`, { commission_pct: pct });
                        toast.success(`Commission set to ${pct}%`);
                        load();
                      } catch (err) { toast.error(formatApiError(err)); }
                    }}
                    className="input-base w-20 py-1 text-xs"
                    data-testid={`commission-input-${v.id}`}
                  />
                  <span className="text-[#4A4A4A]">applied to delivered items</span>
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
  const [f, setF] = useState({ code: "", discount_pct: 10, min_amount: 0, active: true, expires_at: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get("/admin/coupons");
    setItems(data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/coupons", {
        code: f.code.trim(),
        discount_pct: Number(f.discount_pct),
        min_amount: Number(f.min_amount),
        active: !!f.active,
        expires_at: f.expires_at ? new Date(f.expires_at).toISOString() : null,
      });
      toast.success("Coupon created");
      setShowForm(false);
      setF({ code: "", discount_pct: 10, min_amount: 0, active: true, expires_at: "" });
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
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-heading text-2xl font-semibold">Coupons ({items.length})</h2>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary" data-testid="new-coupon">
          <Plus className="h-4 w-4" /> New coupon
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="card-base mb-6 grid gap-4 p-6 sm:grid-cols-2">
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
          <div className="sm:col-span-2 flex justify-end">
            <button className="btn-primary" data-testid="save-coupon">Save</button>
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
    { label: "Platform commission", value: formatINR(data.platform_commission_earned), color: "bg-[#E07A5F]" },
    { label: "Vendor payout", value: formatINR(data.total_vendor_payout), color: "bg-[#8BA888]" },
    { label: "Cancelled orders", value: data.cancelled_orders, color: "bg-red-600" },
  ];

  return (
    <div className="space-y-8" data-testid="admin-analytics">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-semibold">Sales analytics</h2>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="input-base w-40 text-sm">
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
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
                    <div className="text-xs text-[#4A4A4A]">{v.delivered_items} items · commission {formatINR(v.commission)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#1B4332]">{formatINR(v.gross)}</div>
                    <div className="text-xs text-[#4A4A4A]">Net payout {formatINR(v.net_payout)}</div>
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
                  <th className="px-4 py-2">Commission</th>
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
                    <td className="px-4 py-2 text-[#4A4A4A]">{v.commission_pct}%</td>
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
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-heading text-2xl font-semibold">Delivery boys ({list.length})</h2>
        <button onClick={() => setShowForm((v) => !v)} className="btn-primary" data-testid="new-delivery-boy">
          <Plus className="h-4 w-4" /> Add delivery boy
        </button>
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

