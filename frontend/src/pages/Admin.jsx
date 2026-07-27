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
} from "lucide-react";

const adminLinks = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
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
            <Route path="products" element={<ProductsAdmin />} />
            <Route path="orders" element={<OrdersAdmin />} />
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
    { label: "Revenue", value: formatINR(data.revenue), icon: TrendingUp, color: "bg-[#1B4332]" },
    { label: "Orders", value: data.total_orders, icon: ShoppingBag, color: "bg-[#E07A5F]" },
    { label: "Products", value: data.total_products, icon: Package, color: "bg-[#8BA888]" },
    { label: "Customers", value: data.total_users, icon: Users, color: "bg-[#F4A261]" },
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
    const [p, c] = await Promise.all([api.get("/products?limit=500"), api.get("/categories")]);
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
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
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
                        <div className="text-xs text-[#4A4A4A]">{p.unit}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#4A4A4A]">{p.category_slug}</td>
                  <td className="px-4 py-3 font-semibold">{formatINR(p.price)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.stock <= 5 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
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

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
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
          <FField label="Name" value={form.name} onChange={(v) => update("name", v)} required />
          <FField label="Slug" value={form.slug} onChange={(v) => update("slug", v)} placeholder="auto from name" />
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Description</label>
            <textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={2} className="input-base resize-none" />
          </div>
          <FField label="Price (₹)" type="number" value={form.price} onChange={(v) => update("price", v)} required />
          <FField label="MRP (₹)" type="number" value={form.mrp || ""} onChange={(v) => update("mrp", v)} />
          <FField label="Unit" value={form.unit} onChange={(v) => update("unit", v)} placeholder="1 kg" />
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Category</label>
            <select value={form.category_slug} onChange={(e) => update("category_slug", e.target.value)} className="input-base">
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <FField label="Image URL" value={form.image} onChange={(v) => update("image", v)} required />
          </div>
          <FField label="Stock" type="number" value={form.stock} onChange={(v) => update("stock", v)} required />
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
const ALL_STATUSES = ["Pending", "Confirmed", "Packed", "Out For Delivery", "Delivered", "Cancelled"];

function OrdersAdmin() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get(`/admin/orders${filter ? `?status=${encodeURIComponent(filter)}` : ""}`);
    setOrders(data);
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
