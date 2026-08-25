import { playCheckoutBell } from "@/lib/audioAlert";
import Dashboard from "@/pages/Dashboard";
import VendorBottomNav from "@/components/VendorBottomNav";
import { useEffect, useState, useCallback, useRef } from "react";
import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import { api, formatINR, formatApiError } from "@/lib/api";
import { toast } from "sonner";
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
  Settings,
  Store,
  Palmtree,
} from "lucide-react";

const ORDER_STATUSES = [
  "Pending",
  "Accepted",
  "Preparing",
  "Packed",
  "Ready",
  "Out For Delivery",
  "Delivered",
  "Cancelled",
];

const vendorLinks = [
  {
    to: "/vendor",
    label: "Dashboard",
    icon: LayoutDashboard,
    end: true,
  },
  {
    to: "/vendor/catalogue",
    label: "Catalogue",
    icon: Package,
  },
  {
    to: "/vendor/orders",
    label: "Orders",
    icon: ShoppingBag,
  },
  {
    to: "/vendor/more",
    label: "More",
    icon: Settings,
  },
];

export default function VendorDashboard() {
  return (
    <div className="container-app py-8" data-testid="vendor-page">
      <h1 className="font-heading text-3xl font-bold sm:text-4xl">
        Vendor panel
      </h1>

      <p className="mt-2 text-sm text-[#4A4A4A]">
        Manage your catalogue, inventory, and orders
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
        {/* Desktop Sidebar */}
        <aside className="hidden space-y-1 lg:block">
          {vendorLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#1B4332] text-white"
                    : "text-[#4A4A4A] hover:bg-gray-50"
                }`
              }
              data-testid={`vendor-nav-${l.label.toLowerCase()}`}
            >
              <l.icon className="h-4 w-4" />
              {l.label}
            </NavLink>
          ))}
        </aside>

        {/* Main Content */}
        <div className="pb-20 lg:pb-0">
          <Routes>
            <Route index element={<Dashboard />} />

            {/* IMPORTANT:
                Catalogue now uses VProducts
                instead of the old Catalogue component.
            */}
            <Route path="catalogue" element={<VProducts />} />
            <Route path="products" element={<VProducts />} />

            <Route path="orders" element={<VOrders />} />
            <Route path="analytics" element={<VAnalytics />} />
            <Route path="settings" element={<VSettings />} />

            <Route
              path="*"
              element={<Navigate to="/vendor" replace />}
            />
          </Routes>
        </div>

        <VendorBottomNav />
      </div>
    </div>
  );
}

/* =========================================================
   VENDOR DASHBOARD
========================================================= */

function VDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api
      .get("/vendor/dashboard")
      .then(({ data }) => setData(data))
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />
    );
  }

  const stats = [
    {
      label: "Revenue",
      value: formatINR(data.revenue),
      color: "bg-[#1B4332]",
    },
    {
      label: "Total orders",
      value: data.total_orders,
      color: "bg-[#E07A5F]",
    },
    {
      label: "Pending items",
      value: data.pending_orders,
      color: "bg-[#F4A261]",
    },
    {
      label: "Products live",
      value: data.approved_products,
      color: "bg-[#8BA888]",
    },
  ];

  return (
    <div className="space-y-8" data-testid="vendor-dashboard">
      <div className="card-base p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#4A4A4A]">
              Signed in as
            </div>

            <div className="mt-1 font-heading text-2xl font-bold">
              {data.vendor.business_name}
            </div>

            <div className="text-sm text-[#4A4A4A]">
              {data.vendor.owner_email} · {data.vendor.phone}
            </div>
          </div>

          {data.vendor.vacation_mode ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700"
              data-testid="vacation-badge"
            >
              <Palmtree className="h-3.5 w-3.5" />
              Temporarily Closed
            </span>
          ) : data.vendor.open_now === false ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
              <Clock className="h-3.5 w-3.5" />
              Closed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Open now
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card-base p-5">
            <div className={`h-1.5 w-10 rounded-full ${s.color}`} />

            <div className="mt-4 text-xs uppercase tracking-wider text-[#4A4A4A]">
              {s.label}
            </div>

            <div className="mt-1 font-heading text-2xl font-bold">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {data.pending_products > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-[#F4A261] bg-[#F4A261]/10 p-4">
          <Clock className="mt-0.5 h-5 w-5 text-[#F4A261]" />

          <div className="text-sm text-[#1A1A1A]">
            <span className="font-semibold">
              {data.pending_products} product(s)
            </span>{" "}
            are pending admin approval. They'll go live automatically once
            approved.
          </div>
        </div>
      )}

      {data.low_stock.length > 0 && (
        <div className="card-base p-6">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#E07A5F]" />

            <h3 className="font-heading text-lg font-semibold">
              Low stock
            </h3>
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
                  <div className="text-sm font-semibold">{p.name}</div>

                  <div className="text-xs text-[#4A4A4A]">
                    {p.unit}
                  </div>
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

/* =========================================================
   PRODUCT HELPERS
========================================================= */

function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

/* =========================================================
   VENDOR PRODUCTS
========================================================= */

export function VProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [p, c] = await Promise.all([
        api.get("/vendor/products"),
        api.get("/categories"),
      ]);

      setProducts(p.data || []);
      setCategories(c.data || []);
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
      await api.delete(`/vendor/products/${id}`);

      toast.success("Product deleted");

      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  if (loading) {
    return (
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />
    );
  }

  return (
    <div data-testid="vendor-products">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-semibold">
            Products ({products.length})
          </h2>

          <p className="mt-1 text-sm text-[#4A4A4A]">
            Manage your products and inventory.
          </p>
        </div>

        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="btn-primary"
          data-testid="vendor-add-product"
        >
          <Plus className="h-4 w-4" />
          Add product
        </button>
      </div>

      {/* Empty State */}
      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E5E5E5] p-10 text-center text-[#4A4A4A]">
          <Package className="mx-auto mb-3 h-10 w-10 text-[#8BA888]" />

          <h3 className="font-semibold text-[#1A1A1A]">
            No products yet
          </h3>

          <p className="mt-1 text-sm">
            Add your first product. It goes live after admin approval.
          </p>

          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="btn-primary mt-5"
          >
            <Plus className="h-4 w-4" />
            Add your first product
          </button>
        </div>
      ) : (
        /* Products Table */
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
                  <tr
                    key={p.id}
                    className="border-t border-[#E5E5E5]"
                  >
                    {/* Product */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.name || ""}
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gray-100">
                            <Package className="h-5 w-5 text-gray-400" />
                          </div>
                        )}

                        <div>
                          <div className="font-semibold">
                            {p.name}
                          </div>

                          <div className="text-xs text-[#4A4A4A]">
                            {p.unit || "—"} · {p.category_slug || "—"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3 font-semibold">
                      {formatINR(p.price)}
                    </td>

                    {/* Stock */}
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          Number(p.stock) <= 5
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {p.stock}
                      </span>
                    </td>

                    {/* Approval Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          p.approval_status === "approved"
                            ? "bg-green-100 text-green-700"
                            : p.approval_status === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {p.approval_status || "pending"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setEditing(p);
                          setShowForm(true);
                        }}
                        className="mr-1 inline-grid h-8 w-8 place-items-center rounded-full text-[#1B4332] hover:bg-gray-100"
                        data-testid={`v-edit-${p.slug}`}
                        title="Edit product"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => del(p.id)}
                        className="inline-grid h-8 w-8 place-items-center rounded-full text-red-600 hover:bg-red-50"
                        data-testid={`v-delete-${p.slug}`}
                        title="Delete product"
                      >
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

      {/* Product Form */}
      {showForm && (
        <VProductForm
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

/* =========================================================
   PRODUCT FORM
========================================================= */

function VProductForm({
  initial,
  categories,
  onClose,
  onSaved,
}) {
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
  const [preview, setPreview] = useState(initial?.image || "");
  const [uploading, setUploading] = useState(false);

  /* -------------------------
     Update Form
  ------------------------- */

  const update = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  /* -------------------------
     Upload Image
  ------------------------- */

  const uploadImage = async (file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }

    const formData = new FormData();

    formData.append("file", file);

    try {
      setUploading(true);

      const res = await api.post(
        "/upload/image",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const imageUrl = res.data?.url;

      if (!imageUrl) {
        throw new Error("Image URL was not returned by server.");
      }

      update("image", imageUrl);
      setPreview(imageUrl);

      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Upload Error:", error);
      console.error(
        "Response:",
        error.response?.data
      );

      toast.error(
        error.response?.data?.detail ||
          "Image upload failed"
      );
    } finally {
      setUploading(false);
    }
  };

  /* -------------------------
     Save Product
  ------------------------- */

  const save = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error("Product name is required.");
      return;
    }

    if (!form.category_slug) {
      toast.error("Please select a category.");
      return;
    }

    if (!form.image) {
      toast.error("Please upload a product image.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...form,

        slug:
          form.slug?.trim() ||
          slugify(form.name),

        price: Number(form.price),

        mrp:
          form.mrp !== "" &&
          form.mrp !== null &&
          form.mrp !== undefined
            ? Number(form.mrp)
            : null,

        stock: Number(form.stock),
      };

      if (initial) {
        await api.put(
          `/vendor/products/${initial.id}`,
          payload
        );

        toast.success("Product updated successfully");
      } else {
        await api.post(
          "/vendor/products",
          payload
        );

        toast.success(
          "Product submitted for approval"
        );
      }

      onSaved();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="v-product-form"
    >
      <div className="card-base max-h-[90vh] w-full max-w-2xl overflow-auto p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-heading text-xl font-semibold">
              {initial
                ? "Edit product"
                : "New product"}
            </h3>

            <p className="mt-1 text-xs text-[#4A4A4A]">
              Add complete product information.
            </p>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={save}
          className="grid gap-4 sm:grid-cols-2"
        >
          {/* Name */}
          <FF
            label="Product name"
            value={form.name}
            onChange={(v) =>
              update("name", v)
            }
            placeholder="Fresh Tomato"
            required
          />

          {/* Slug */}
          <FF
            label="Slug"
            value={form.slug}
            onChange={(v) =>
              update("slug", v)
            }
            placeholder="auto from name"
          />

          {/* Description */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
              Description
            </label>

            <textarea
              value={form.description || ""}
              onChange={(e) =>
                update(
                  "description",
                  e.target.value
                )
              }
              rows={3}
              className="input-base resize-none"
              placeholder="Describe your product..."
            />
          </div>

          {/* Price */}
          <FF
            label="Price (₹)"
            type="number"
            min="0"
            value={form.price}
            onChange={(v) =>
              update("price", v)
            }
            required
          />

          {/* MRP */}
          <FF
            label="MRP (₹)"
            type="number"
            min="0"
            value={form.mrp || ""}
            onChange={(v) =>
              update("mrp", v)
            }
            placeholder="Optional"
          />

          {/* Unit */}
          <FF
            label="Unit"
            value={form.unit}
            onChange={(v) =>
              update("unit", v)
            }
            placeholder="500g / 1kg / 1 pcs"
          />

          {/* Category */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
              Category
            </label>

            <select
              value={form.category_slug || ""}
              onChange={(e) =>
                update(
                  "category_slug",
                  e.target.value
                )
              }
              className="input-base"
              required
            >
              <option value="">
                Select category
              </option>

              {categories.map((c) => (
                <option
                  key={c.slug}
                  value={c.slug}
                >
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Product Image */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
              Product Image
            </label>

            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                uploadImage(
                  e.target.files?.[0]
                )
              }
              className="input-base"
              disabled={uploading}
            />

            {uploading && (
              <div className="mt-2 flex items-center gap-2 text-sm text-[#1B4332]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading image...
              </div>
            )}

            {preview ? (
              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold text-[#4A4A4A]">
                  Image preview
                </p>

                <img
                  src={preview}
                  alt="Product preview"
                  className="h-32 w-32 rounded-xl border border-[#E5E5E5] object-cover"
                />
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-[#E5E5E5] p-5 text-center text-sm text-[#4A4A4A]">
                No image selected
              </div>
            )}
          </div>

          {/* Stock */}
          <FF
            label="Stock"
            type="number"
            min="0"
            value={form.stock}
            onChange={(v) =>
              update("stock", v)
            }
            required
          />

          {/* Buttons */}
          <div className="flex items-end justify-end gap-3 sm:col-span-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={saving || uploading}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving || uploading}
              className="btn-primary"
              data-testid="v-save-product"
            >
              {saving && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}

              {initial
                ? "Update product"
                : "Save product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   FORM FIELD
========================================================= */

function FF({
  label,
  type = "text",
  value,
  onChange,
  ...rest
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
        {label}
      </label>

      <input
        type={type}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="input-base"
        {...rest}
      />
    </div>
  );
}

/* =========================================================
   VENDOR ORDERS
========================================================= */

function VOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
    const knownOrdersRef = useRef(new Set());
  const audioRef = useRef(null);

  const playNewOrderSound = useCallback(() => {
    playCheckoutBell();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const { data } =
        await api.get("/vendor/orders");

      setOrders(data || []);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

    useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let mounted = true;

    const checkNewOrders = async () => {
      try {
        const { data } = await api.get("/vendor/orders");

        if (!mounted || !Array.isArray(data)) return;

        const currentIds = new Set(
          data.map((order) => String(order.id))
        );

        // First load: only remember existing orders.
        // Do NOT play ringtone for old orders.
        if (knownOrdersRef.current.size === 0) {
          knownOrdersRef.current = currentIds;
          return;
        }

        let newOrderFound = false;

        for (const order of data) {
          const id = String(order.id);

          if (!knownOrdersRef.current.has(id)) {
            newOrderFound = true;

            toast.success("🔔 New order received!", {
              description: `Order #${id.slice(-6).toUpperCase()}`,
              duration: 5000,
            });
          }
        }

        if (newOrderFound) {
          playNewOrderSound();
        }

        knownOrdersRef.current = currentIds;
        setOrders(data);
      } catch (error) {
        // Silent polling error.
      }
    };

    const interval = setInterval(checkNewOrders, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [playNewOrderSound]);

  const setStatus = async (
    id,
    status
  ) => {
    try {
      await api.patch(
        `/vendor/orders/${id}/line-status`,
        { status }
      );

      toast.success(`Marked ${status}`);

      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  if (loading) {
    return (
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E5E5E5] p-10 text-center text-[#4A4A4A]">
        No orders yet.
      </div>
    );
  }

  return (
    <div
      className="space-y-4"
      data-testid="vendor-orders"
    >
      {orders.map((o) => (
        <div
          key={o.id}
          className="card-base p-5"
          data-testid={`vendor-order-${o.id}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs text-[#4A4A4A]">
                Order #
                {o.id
                  .slice(-6)
                  .toUpperCase()}
              </div>

              <div className="mt-1 font-semibold">
                {o.customer_name} ·{" "}
                {o.customer_phone}
              </div>

              <div className="text-xs text-[#4A4A4A]">
                {o.address?.line1},{" "}
                {o.address?.area},{" "}
                {o.address?.city} -{" "}
                {o.address?.pincode}
              </div>

              <div className="mt-2 text-xs text-[#4A4A4A]">
                {o.items?.length || 0} item(s) ·{" "}
                {o.payment_method} ·{" "}
                {new Date(
                  o.created_at
                ).toLocaleString("en-IN", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </div>
            </div>

            <div className="text-right">
              <div className="font-heading text-xl font-bold text-[#1B4332]">
                {formatINR(
                  o.my_subtotal
                )}
              </div>

              <div className="mt-2">
                <select
                  value={
                    o.my_status === "Mixed"
                      ? "Pending"
                      : o.my_status
                  }
                  onChange={(e) =>
                    setStatus(
                      o.id,
                      e.target.value
                    )
                  }
                  className="input-base w-44 text-sm"
                  data-testid={`v-status-${o.id}`}
                >
                  {ORDER_STATUSES.map(
                    (s) => (
                      <option
                        key={s}
                        value={s}
                      >
                        {s}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="mt-1 text-xs text-[#4A4A4A]">
                Overall:{" "}
                {o.overall_status}
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-2 text-sm">
            {(o.items || []).map(
              (it, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3"
                >
                  {it.image ? (
                    <img
                      src={it.image}
                      alt={it.name || ""}
                      className="h-8 w-8 rounded object-cover"
                    />
                  ) : (
                    <div className="grid h-8 w-8 place-items-center rounded bg-gray-100">
                      <Package className="h-4 w-4 text-gray-400" />
                    </div>
                  )}

                  <span className="flex-1">
                    {it.name}{" "}
                    <span className="text-xs text-[#4A4A4A]">
                      ({it.unit})
                    </span>
                  </span>

                  <span className="text-[#4A4A4A]">
                    ×{it.quantity}
                  </span>

                  <span className="font-semibold">
                    {formatINR(
                      it.price *
                        it.quantity
                    )}
                  </span>

                  {it.line_status &&
                    it.line_status !==
                      o.my_status && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-[#4A4A4A]">
                        {it.line_status}
                      </span>
                    )}
                </div>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   ANALYTICS
========================================================= */

function VAnalytics() {
  const [data, setData] =
    useState(null);

  useEffect(() => {
    api
      .get("/vendor/analytics")
      .then(({ data }) =>
        setData(data)
      )
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />
    );
  }

  const kpis = [
    {
      label: "Today's orders",
      value: data.today_orders,
    },
    {
      label: "This week",
      value: data.week_orders,
    },
    {
      label: "This month (₹)",
      value: `₹${data.month_revenue}`,
    },
    {
      label: "Total revenue (₹)",
      value: `₹${data.total_revenue}`,
    },
  ];

  const earningsRow = [
    {
      label: "Gross sales",
      value: `₹${data.total_revenue}`,
      color: "text-[#1B4332]",
    },
    {
      label: `Commission (${data.commission_pct}%)`,
      value: `- ₹${data.commission_deducted}`,
      color: "text-[#E07A5F]",
    },
    {
      label: "Net earnings",
      value: `₹${data.net_earnings}`,
      color: "text-[#1B4332]",
    },
    {
      label: "Pending payment",
      value: `₹${data.pending_payment}`,
      color: "text-[#F4A261]",
    },
  ];

  return (
    <div
      className="space-y-8"
      data-testid="vendor-analytics"
    >
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="card-base p-5"
          >
            <div className="text-xs uppercase tracking-wider text-[#4A4A4A]">
              {k.label}
            </div>

            <div className="mt-1 font-heading text-2xl font-bold">
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Earnings */}
      <div
        className="card-base p-6"
        data-testid="earnings-breakdown"
      >
        <h3 className="font-heading text-lg font-semibold">
          Earnings breakdown
        </h3>

        <p className="mt-1 text-xs text-[#4A4A4A]">
          Based on your delivered orders.
          Payouts are settled by the admin.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {earningsRow.map((r) => (
            <div
              key={r.label}
              className="rounded-xl border border-[#E5E5E5] p-4"
            >
              <div className="text-xs uppercase tracking-wider text-[#4A4A4A]">
                {r.label}
              </div>

              <div
                className={`mt-1 font-heading text-xl font-bold ${r.color}`}
              >
                {r.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Best Sellers + Recent Orders */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-base p-6">
          <h3 className="font-heading text-lg font-semibold">
            Best-selling products
          </h3>

          {data.best_sellers?.length ===
          0 ? (
            <p className="mt-3 text-sm text-[#4A4A4A]">
              No delivered orders yet.
              Sales will appear here once
              you fulfil orders.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {(data.best_sellers || []).map(
                (s) => (
                  <div
                    key={s.product_id}
                    className="flex items-center gap-3"
                    data-testid={`best-seller-${s.product_id}`}
                  >
                    {s.image ? (
                      <img
                        src={s.image}
                        alt={s.name || ""}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-gray-100">
                        <Package className="h-5 w-5 text-gray-400" />
                      </div>
                    )}

                    <div className="flex-1">
                      <div className="text-sm font-semibold">
                        {s.name}
                      </div>

                      <div className="text-xs text-[#4A4A4A]">
                        {s.unit} · sold{" "}
                        {s.qty}
                      </div>
                    </div>

                    <div className="text-sm font-semibold text-[#1B4332]">
                      ₹{s.revenue}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <div className="card-base p-6">
          <h3 className="font-heading text-lg font-semibold">
            Recent orders
          </h3>

          {data.recent_orders?.length ===
          0 ? (
            <p className="mt-3 text-sm text-[#4A4A4A]">
              No orders yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {(data.recent_orders || []).map(
                (o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between border-b border-dashed pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <div className="text-sm font-semibold">
                        #
                        {o.id
                          .slice(-6)
                          .toUpperCase()}
                      </div>

                      <div className="text-xs text-[#4A4A4A]">
                        {o.customer_name} ·{" "}
                        {o.items_count} item(s)
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-semibold text-[#1B4332]">
                        ₹{o.my_subtotal}
                      </div>

                      <div className="text-xs text-[#4A4A4A]">
                        {o.overall_status}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Low Stock */}
      {data.low_stock?.length > 0 && (
        <div className="card-base p-6">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#E07A5F]" />

            <h3 className="font-heading text-lg font-semibold">
              Low stock
            </h3>
          </div>

          <div className="space-y-3">
            {data.low_stock.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3"
              >
                {p.image && (
                  <img
                    src={p.image}
                    alt={p.name || ""}
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                )}

                <div className="flex-1">
                  <p className="font-medium">
                    {p.name}
                  </p>

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

/* =========================================================
   SHOP SETTINGS
========================================================= */

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
  const [saving, setSaving] =
    useState(false);

  useEffect(() => {
    api
      .get("/vendor/settings")
      .then(({ data }) =>
        setV(data)
      )
      .catch(() => {});
  }, []);

  if (!v) {
    return (
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />
    );
  }

  const up = (key, value) => {
    setV((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const upHour = (
    day,
    value
  ) => {
    setV((prev) => ({
      ...prev,
      business_hours: {
        ...(prev.business_hours || {}),
        [day]: value,
      },
    }));
  };

  const save = async (e) => {
    e.preventDefault();

    setSaving(true);

    try {
      const { data } =
        await api.patch(
          "/vendor/settings",
          {
            business_name:
              v.business_name,

            business_description:
              v.business_description,

            business_address:
              v.business_address,

            business_pincode:
              v.business_pincode,

            shop_phone:
              v.shop_phone,

            shop_whatsapp:
              v.shop_whatsapp,

            shop_logo:
              v.shop_logo,

            banner_image:
              v.banner_image,

            business_hours:
              v.business_hours || {},

            open_now:
              !!v.open_now,

            vacation_mode:
              !!v.vacation_mode,

            vacation_message:
              v.vacation_message || "",

            delivery_radius_km:
              v.delivery_radius_km ===
                "" ||
              v.delivery_radius_km ==
                null
                ? 0
                : Number(
                    v.delivery_radius_km
                  ),

            min_order_amount:
              v.min_order_amount ===
                "" ||
              v.min_order_amount ==
                null
                ? 0
                : Number(
                    v.min_order_amount
                  ),

            estimated_delivery_min:
              v.estimated_delivery_min ===
                "" ||
              v.estimated_delivery_min ==
                null
                ? 0
                : Number(
                    v.estimated_delivery_min
                  ),
          }
        );

      setV(data);

      toast.success(
        "Shop settings saved"
      );
    } catch (e) {
      toast.error(
        formatApiError(e)
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={save}
      className="space-y-8"
      data-testid="vendor-settings"
    >
      {/* Shop Status */}
      <section className="card-base p-6">
        <div className="mb-4 flex items-center gap-2">
          <Store className="h-5 w-5 text-[#1B4332]" />

          <h2 className="font-heading text-lg font-semibold">
            Shop status
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Open */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E5E5E5] p-4 hover:border-[#8BA888]">
            <input
              type="checkbox"
              checked={!!v.open_now}
              onChange={(e) =>
                up(
                  "open_now",
                  e.target.checked
                )
              }
              className="mt-1"
              data-testid="toggle-open"
            />

            <div>
              <div className="font-semibold">
                Open now
              </div>

              <div className="text-xs text-[#4A4A4A]">
                Turn off temporarily
                during rush / short
                break.
              </div>
            </div>
          </label>

          {/* Vacation */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E5E5E5] p-4 hover:border-[#8BA888]">
            <input
              type="checkbox"
              checked={
                !!v.vacation_mode
              }
              onChange={(e) =>
                up(
                  "vacation_mode",
                  e.target.checked
                )
              }
              className="mt-1"
              data-testid="toggle-vacation"
            />

            <div>
              <div className="font-semibold">
                Vacation mode
              </div>

              <div className="text-xs text-[#4A4A4A]">
                Products stay visible
                with a "Temporarily
                closed" badge.
                Customers cannot place
                new orders.
              </div>
            </div>
          </label>

          {/* Vacation Message */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
              Vacation message
              (optional)
            </label>

            <input
              value={
                v.vacation_message ||
                ""
              }
              onChange={(e) =>
                up(
                  "vacation_message",
                  e.target.value
                )
              }
              placeholder="Closed for Diwali until Nov 5"
              className="input-base"
              data-testid="vacation-message"
            />
          </div>
        </div>
      </section>

      {/* Business Profile */}
      <section className="card-base p-6">
        <h2 className="font-heading text-lg font-semibold">
          Business profile
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FF
            label="Business name"
            value={
              v.business_name
            }
            onChange={(x) =>
              up(
                "business_name",
                x
              )
            }
            required
          />

          <FF
            label="Pincode"
            value={
              v.business_pincode ||
              ""
            }
            onChange={(x) =>
              up(
                "business_pincode",
                x
              )
            }
          />

          <div className="sm:col-span-2">
            <FF
              label="Address"
              value={
                v.business_address ||
                ""
              }
              onChange={(x) =>
                up(
                  "business_address",
                  x
                )
              }
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
              About your business
            </label>

            <textarea
              value={
                v.business_description ||
                ""
              }
              onChange={(e) =>
                up(
                  "business_description",
                  e.target.value
                )
              }
              rows={3}
              className="input-base resize-none"
            />
          </div>

          <FF
            label="Shop phone"
            value={
              v.shop_phone || ""
            }
            onChange={(x) =>
              up(
                "shop_phone",
                x
              )
            }
            placeholder="+91..."
          />

          <FF
            label="Shop WhatsApp"
            value={
              v.shop_whatsapp || ""
            }
            onChange={(x) =>
              up(
                "shop_whatsapp",
                x
              )
            }
            placeholder="+91..."
          />

          <FF
            label="Shop logo URL"
            value={
              v.shop_logo || ""
            }
            onChange={(x) =>
              up(
                "shop_logo",
                x
              )
            }
          />

          <FF
            label="Banner image URL"
            value={
              v.banner_image || ""
            }
            onChange={(x) =>
              up(
                "banner_image",
                x
              )
            }
          />
        </div>
      </section>

      {/* Operations */}
      <section className="card-base p-6">
        <h2 className="font-heading text-lg font-semibold">
          Operations
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <FF
            label="Delivery radius (km)"
            type="number"
            min="0"
            value={
              v.delivery_radius_km ||
              ""
            }
            onChange={(x) =>
              up(
                "delivery_radius_km",
                x
              )
            }
          />

          <FF
            label="Min order amount (₹)"
            type="number"
            min="0"
            value={
              v.min_order_amount ||
              ""
            }
            onChange={(x) =>
              up(
                "min_order_amount",
                x
              )
            }
          />

          <FF
            label="Estimated delivery (min)"
            type="number"
            min="0"
            value={
              v.estimated_delivery_min ||
              ""
            }
            onChange={(x) =>
              up(
                "estimated_delivery_min",
                x
              )
            }
          />
        </div>
      </section>

      {/* Business Hours */}
      <section className="card-base p-6">
        <h2 className="font-heading text-lg font-semibold">
          Business hours
        </h2>

        <p className="mt-1 text-xs text-[#4A4A4A]">
          Use format like
          "08:00-21:00" or type
          "Closed".
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {DAYS.map((d) => (
            <div
              key={d.key}
              className="flex items-center gap-3"
            >
              <div className="w-14 text-sm font-semibold">
                {d.label}
              </div>

              <input
                value={
                  v.business_hours?.[
                    d.key
                  ] || ""
                }
                onChange={(e) =>
                  upHour(
                    d.key,
                    e.target.value
                  )
                }
                placeholder="08:00-21:00"
                className="input-base"
                data-testid={`hours-${d.key}`}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Verification */}
      <section className="card-base p-6">
        <h2 className="font-heading text-lg font-semibold">
          Verification
        </h2>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              v.status === "Approved"
                ? "bg-green-100 text-green-700"
                : v.status === "Rejected"
                ? "bg-red-100 text-red-700"
                : v.status ===
                  "Suspended"
                ? "bg-gray-200 text-gray-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {v.status}
          </span>

          {v.verified && (
            <span className="rounded-full bg-[#8BA888]/20 px-3 py-1 text-xs font-semibold text-[#1B4332]">
              Verified badge active
            </span>
          )}

          <span className="text-xs text-[#4A4A4A]">
            Documents were submitted
            at registration and
            reviewed by admin.
          </span>
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary"
          data-testid="save-settings"
        >
          {saving && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}

          Save settings
        </button>
      </div>
    </form>
  );
}