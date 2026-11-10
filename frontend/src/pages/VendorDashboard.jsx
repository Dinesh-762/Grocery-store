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

const VENDOR_ORDER_STATUSES = [
  "Pending",
  "Accepted",
  "Preparing",
  "Packed",
  "Ready",
];
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
      <p className="mt-2 text-sm text-[#4A4A4A]">
        Manage your catalogue, inventory, and orders
      </p>

      <div className="mt-6 flex flex-col gap-6 sm:mt-8 lg:grid lg:grid-cols-[220px_1fr] lg:items-start lg:gap-8">
        <aside className="sticky-sidebar hidden space-y-1 lg:block">
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
    api
      .get("/vendor/dashboard")
      .then(({ data }) => setData(data))
      .catch(() => {});
  }, []);
  if (!data)
    return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  const stats = [
    { label: "Revenue", value: formatINR(data.revenue), color: "bg-[#1B4332]" },
    { label: "Total orders", value: data.total_orders, color: "bg-[#E07A5F]" },
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
            are pending admin approval. They&apos;ll go live automatically once
            approved.
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
                <img
                  src={p.image}
                  alt=""
                  className="h-10 w-10 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-[#4A4A4A]">{p.unit}</div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.stock === 0 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}
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

function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}


function VendorCategoryManager({ categories, onChanged }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const customCategories = categories.filter((c) => c.is_vendor_category);

  const reset = () => {
    setName("");
    setDescription("");
    setImage("");
    setEditing(null);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Enter a category name");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        image: image.trim(),
      };

      if (editing) {
        await api.put(`/vendor/categories/${editing.id}`, payload);
        toast.success("Category updated");
      } else {
        await api.post("/vendor/categories", payload);
        toast.success("Category created");
      }

      reset();
      await onChanged();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (category) => {
    if (!window.confirm(`Delete "${category.name}"? Products assigned to it must be moved first.`)) return;

    try {
      await api.delete(`/vendor/categories/${category.id}`);
      toast.success("Category deleted");
      if (editing?.id === category.id) reset();
      await onChanged();
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  return (
    <section className="mb-8 rounded-2xl border border-[#E5E5E5] bg-white p-5 sm:p-6" data-testid="vendor-category-manager">
      <div className="mb-4">
        <h3 className="font-heading text-lg font-bold text-[#1B4332]">Manage Categories</h3>
        <p className="mt-1 text-sm text-[#68756B]">
          Create your own product categories. Each category belongs only to your store.
        </p>
      </div>

      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name"
          maxLength={60}
          className="rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm"
          required
        />
        <input
          value={image}
          onChange={(e) => setImage(e.target.value)}
          placeholder="Category image URL (optional)"
          className="rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="rounded-xl border border-[#E5E5E5] px-4 py-3 text-sm sm:col-span-2"
        />
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editing ? "Update category" : "Create category"}
          </button>
          {editing && (
            <button type="button" onClick={reset} className="rounded-xl border px-4 py-2 text-sm">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="mt-5 space-y-2">
        {customCategories.length === 0 ? (
          <p className="rounded-xl bg-gray-50 p-4 text-sm text-[#68756B]">
            You haven't created any custom categories yet.
          </p>
        ) : customCategories.map((category) => (
          <div key={category.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5E5E5] p-3">
            <div className="min-w-0">
              <p className="font-semibold text-[#20392A]">{category.name}</p>
              <p className="text-xs text-[#68756B]">{category.product_count || 0} products · {category.slug}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(category);
                  setName(category.name);
                  setDescription(category.description || "");
                  setImage(category.image || "");
                }}
                className="rounded-lg p-2 text-[#1B4332] hover:bg-gray-100"
                aria-label="Edit category"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => remove(category)}
                className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                aria-label="Delete category"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function VProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [shopTypeLabel, setShopTypeLabel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // EXCEL_VENDOR_IMPORT_UI_V1
  const importFileRef = useRef(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importPreview, setImportPreview] = useState(null);


  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      // Categories come from the backend already filtered to this vendor's shop type.
      const [p, c] = await Promise.all([
        api.get("/vendor/products"),
        api.get("/vendor/categories"),
      ]);
      setProducts(p.data);
      setCategories(c.data?.categories || []);
      setShopTypeLabel(c.data?.shop_type_label || null);
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
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };


  const downloadImportTemplate = async () => {
    try {
      setImportBusy(true);
      const response = await api.get(
        "/vendor/products/import/template",
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = "Ambajogai-Vendor-Product-Template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Excel template downloaded.");
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setImportBusy(false);
    }
  };

  const uploadImportExcel = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Please select an .xlsx Excel file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setImportBusy(true);
      setImportPreview(null);
      const response = await api.post(
        "/vendor/products/import/preview",
        formData
      );
      setImportPreview(response.data);
      if (response.data.valid) {
        toast.success("Excel validated. Review the preview before importing.");
      } else {
        toast.error("Excel has validation errors. Correct them and upload again.");
      }
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setImportBusy(false);
    }
  };

  const confirmExcelImport = async () => {
    if (!importPreview?.valid || !importPreview?.token) return;

    if (!window.confirm(
      `Import ${importPreview.product_count} new products? Existing products will not be changed.`
    )) return;

    try {
      setImportBusy(true);
      const response = await api.post(
        "/vendor/products/import/confirm",
        { token: importPreview.token }
      );
      toast.success(response.data.message || "Products imported.");
      setImportPreview(null);
      await load();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setImportBusy(false);
    }
  };

    const openPriceEditor = (product) => {
    setPriceEditing(product);

    setPriceVariants(
      (product.variants || []).map((variant) => ({
        ...variant,
        price: variant.price ?? "",
        mrp: variant.mrp ?? "",
      })),
    );

    setPriceError("");
  };

  const saveVariantPrices = async () => {
    if (!priceEditing) return;

    if (priceVariants.length === 0) {
      setPriceError("This product has no variants to edit.");
      return;
    }

    for (const variant of priceVariants) {
      if (
        variant.price === "" ||
        !Number.isFinite(Number(variant.price)) ||
        Number(variant.price) < 0
      ) {
        setPriceError("Enter a valid selling price for every variant.");
        return;
      }

      if (
        variant.mrp !== "" &&
        (!Number.isFinite(Number(variant.mrp)) ||
          Number(variant.mrp) < 0)
      ) {
        setPriceError("Enter a valid MRP for every variant.");
        return;
      }
    }

    setSavingPrices(true);
    setPriceError("");

    try {
      await api.patch(
        `/vendor/products/${priceEditing.id}/variant-prices`,
        {
          variants: priceVariants.map((variant) => ({
            label: variant.label,
            price: Number(variant.price),
            mrp: variant.mrp === "" ? null : Number(variant.mrp),
          })),
        },
      );

      toast.success("Variant prices updated successfully.");

      setPriceEditing(null);
      setPriceVariants([]);

      await load();
    } catch (e) {
      setPriceError(
        e.response?.data?.detail ||
          "Unable to update variant prices.",
      );
    } finally {
      setSavingPrices(false);
    }
  };

  if (loading)
    return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  return (
    <div data-testid="vendor-products">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-heading text-2xl font-semibold">
          Products ({products.length})
          {refreshing && (
            <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-[#8BA888]" />
          )}
        </h2>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="btn-primary"
          disabled={!loading && categories.length === 0}
          data-testid="vendor-add-product"
        >
          <Plus className="h-4 w-4" /> Add product
        </button>
      </div>


      {/* EXCEL_VENDOR_IMPORT_UI_V1 */}
      <section className="mb-6 rounded-2xl border border-[#DCE8DF] bg-[#F7FAF7] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-[#1B4332]">Bulk Product Import (Excel)</h3>
            <p className="mt-1 text-xs text-[#68756B]">
              Download the template, fill it in Excel, then upload and review before importing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadImportTemplate}
              disabled={importBusy}
              className="rounded-xl border border-[#1B4332] px-4 py-2 text-sm font-semibold text-[#1B4332] disabled:opacity-50"
            >
              Download Template
            </button>
            <button
              type="button"
              onClick={() => importFileRef.current?.click()}
              disabled={importBusy}
              className="btn-primary disabled:opacity-50"
            >
              {importBusy ? "Please wait..." : "Upload Excel"}
            </button>
            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={uploadImportExcel}
            />
          </div>
        </div>
      </section>

      {importPreview && (
        <section className="mb-6 rounded-2xl border border-[#E5E5E5] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-heading text-lg font-bold text-[#1B4332]">
              Excel Import Preview
            </h3>
            <button
              type="button"
              onClick={() => setImportPreview(null)}
              className="rounded-lg border px-3 py-1.5 text-sm"
              disabled={importBusy}
            >
              Close
            </button>
          </div>

          <p className="mt-2 text-sm text-[#4A4A4A]">
            Rows: {importPreview.row_count || 0} ? Products: {importPreview.product_count || 0}
          </p>

          {importPreview.errors?.length > 0 && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="font-semibold text-red-700">Please correct these errors:</p>
              <ul className="mt-2 max-h-52 list-disc space-y-1 overflow-auto pl-5 text-sm text-red-700">
                {importPreview.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {importPreview.products?.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Pack Sizes</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.products.map((product, index) => (
                    <tr key={`${product.name}-${index}`} className="border-t">
                      <td className="px-3 py-2 font-medium">{product.name}</td>
                      <td className="px-3 py-2">{product.category}</td>
                      <td className="px-3 py-2">
                        {product.variant_count}
                        {product.variants?.length
                          ? ` (${product.variants.map((v) => v.label).join(", ")})`
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {importPreview.valid && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-green-700">
                Validation successful. No products have been saved yet.
              </p>
              <button
                type="button"
                onClick={confirmExcelImport}
                disabled={importBusy}
                className="btn-primary disabled:opacity-50"
              >
                {importBusy ? "Importing..." : "Confirm Import"}
              </button>
            </div>
          )}
        </section>
      )}

      {!loading && !shopTypeLabel && (
        <div className="mb-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900" data-testid="vendor-shop-type-missing">
          Your shop type has not been set yet, so no categories are available. Please contact the store admin to
          set it before adding products.
        </div>
      )}
      {!loading && shopTypeLabel && (
        <p className="mb-4 text-xs text-[#4A4A4A]" data-testid="vendor-shop-type-note">
          Shop type: <span className="font-semibold text-[#1B4332]">{shopTypeLabel}</span> — only matching
          categories are available for your products.
        </p>
      )}

      {!loading && shopTypeLabel && (
        <VendorCategoryManager categories={categories} onChanged={() => load()} />
      )}

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E5E5E5] p-10 text-center text-[#4A4A4A]">
          No products yet. Add your first product — it goes live after admin
          approval.
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
                        <img
                          src={p.image}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                        <div>
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-xs text-[#4A4A4A]">
                            {p.unit} · {p.category_slug}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 font-semibold"
                      title="Your price per unit"
                    >
                      {formatINR(p.base_price ?? p.price)}
                      <span className="ml-1 text-[10px] font-normal text-[#4A4A4A]">
                        base
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.stock <= 5 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
                      >
                        {p.stock}
                      </span>
                    </td>
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
                        {p.approval_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setEditing(p);
                          setShowForm(true);
                        }}
                        className="inline-grid h-8 w-8 place-items-center rounded-full text-[#1B4332] hover:bg-gray-100"
                        data-testid={`v-edit-${p.slug}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => del(p.id)}
                        className="inline-grid h-8 w-8 place-items-center rounded-full text-red-600 hover:bg-red-50"
                        data-testid={`v-delete-${p.slug}`}
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



function VProductForm({ initial, categories, onClose, onSaved }) {
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
    },
  );
  // A legacy product may sit in a category outside the vendor's shop type; keep it visible
  // (and unchanged) instead of silently switching it to the first available category.
  const categoryChoices =
    initial?.category_slug && !categories.some((c) => c.slug === initial.category_slug)
      ? [{ slug: initial.category_slug, name: `${initial.category_slug} (current)` }, ...categories]
      : categories;
  const [saving, setSaving] = useState(false);
  const [variants, setVariants] = useState(
    (initial?.variants || []).map((v) => ({
      label: v.label || "",
      price: v.price ?? 0,
      mrp: v.mrp ?? "",
      unit: v.unit || "",
      stock: v.stock ?? 0,
    })),
  );

  const updateVariant = (index, key, value) => {
    setVariants((current) =>
      current.map((variant, i) =>
        i === index ? { ...variant, [key]: value } : variant,
      ),
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

  const update = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.image?.trim()) {
      toast.error(
        "Please add a product image (upload a file or paste an image URL).",
      );
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
        variants: variants
          .map((v) => ({
            label: v.label.trim(),
            price: Number(v.price),
            mrp: v.mrp === "" ? null : Number(v.mrp),
            unit: v.unit.trim(),
            stock: Number(v.stock),
          }))
          .filter((v) => v.label),
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="v-product-form"
    >
      <div className="card-base max-h-[90vh] w-full max-w-2xl overflow-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-xl font-semibold">
            {initial ? "Edit product" : "New product"}
          </h3>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <FF
            label="Name"
            value={form.name}
            onChange={(v) => update("name", v)}
            required
          />
          <FF
            label="Slug"
            value={form.slug}
            onChange={(v) => update("slug", v)}
            placeholder="auto from name"
          />
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={2}
              className="input-base resize-none"
            />
          </div>
          <FF
            label="Base price (₹)"
            type="number"
            value={form.price}
            onChange={(v) => update("price", v)}
            required
          />
          <p className="sm:col-span-2 -mt-2 text-xs text-[#4A4A4A]">
            Set the price you want to receive for this product. This is what you
            will see on orders and payouts.
          </p>
          <FF
            label="MRP (₹)"
            type="number"
            value={form.mrp || ""}
            onChange={(v) => update("mrp", v)}
          />
          <FF
            label="Unit (250g/500g/1kg)"
            value={form.unit}
            onChange={(v) => update("unit", v)}
            placeholder="1 kg"
          />
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
              Category
            </label>
            <select
              value={form.category_slug}
              onChange={(e) => update("category_slug", e.target.value)}
              className="input-base"
            >
              {categoryChoices.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
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
          <div className="sm:col-span-2 rounded-xl border border-[#E5E5E5] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold">Product Variants</h4>
                <p className="mt-1 text-xs text-[#4A4A4A]">
                  Add different sizes, prices, MRP and stock.
                </p>
              </div>

              <button
                type="button"
                className="btn-secondary whitespace-nowrap"
                onClick={addVariant}
              >
                + Add Variant
              </button>
            </div>

            {variants.length === 0 ? (
              <p className="text-sm text-[#4A4A4A]">No variants added.</p>
            ) : (
              <div className="space-y-3">
                {variants.map((v, i) => (
                  <div
                    key={i}
                    className="grid gap-3 rounded-xl bg-gray-50 p-3 sm:grid-cols-2 lg:grid-cols-5"
                  >
                    <FF
                      label="Label"
                      value={v.label}
                      onChange={(value) => updateVariant(i, "label", value)}
                      placeholder="500g"
                    />

                    <FF
                      label="Price (₹)"
                      type="number"
                      min="0"
                      step="0.01"
                      value={v.price}
                      onChange={(value) => updateVariant(i, "price", value)}
                    />

                    <FF
                      label="MRP (₹)"
                      type="number"
                      min="0"
                      step="0.01"
                      value={v.mrp}
                      onChange={(value) => updateVariant(i, "mrp", value)}
                      placeholder="25"
                    />

                    <FF
                      label="Unit"
                      value={v.unit}
                      onChange={(value) => updateVariant(i, "unit", value)}
                      placeholder="500g"
                    />

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
                        Stock
                      </label>

                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={v.stock}
                          onChange={(e) =>
                            updateVariant(i, "stock", Number(e.target.value))
                          }
                          className="input-base min-w-0 flex-1"
                        />

                        <button
                          type="button"
                          onClick={() => removeVariant(i)}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-red-600 hover:bg-red-50"
                          aria-label={`Remove variant ${i + 1}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <FF
            label="Stock"
            type="number"
            value={form.stock}
            onChange={(v) => update("stock", v)}
            required
          />
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
              data-testid="v-save-product"
            >
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
      <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-base"
        {...rest}
      />
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
          (order) => !previousOrderIds.current.has(order.id),
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
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  if (loading)
    return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;
  if (orders.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-[#E5E5E5] p-10 text-center text-[#4A4A4A]">
        No orders yet.
      </div>
    );

  return (
    <div className="space-y-4" data-testid="vendor-orders">
      {orders.map((o) => {
        const currentStatus = o.my_status === "Mixed" ? "Pending" : o.my_status;
        const vendorLocked = RIDER_ADMIN_STATUSES.includes(currentStatus);
        const orderTotal = vendorOrderTotal(o.items);
        return (
          <div
            key={o.id}
            className="card-base p-5"
            data-testid={`vendor-order-${o.id}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs text-[#4A4A4A]">
                  Order #{o.id.slice(-6).toUpperCase()}
                </div>
                <div className="mt-1 font-semibold" data-testid={`vendor-order-customer-${o.id}`}>
                  Customer: {o.customer_name || "Customer"}
                </div>
                <div className="mt-2 text-xs text-[#4A4A4A]">
                  {o.items.length} ordered item(s) · {new Date(o.created_at).toLocaleString("en-IN", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </div>
              </div>
              <div className="text-right">
                <div className="font-heading text-xl font-bold text-[#1B4332]">
                  {formatINR(orderTotal)}
                </div>
                <div className="text-[10px] text-[#4A4A4A]">
                  Your amount (base price)
                </div>
                <div className="mt-2">
                  {vendorLocked ? (
                    <span className="inline-block rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-[#4A4A4A]">
                      {currentStatus} · handled by rider/admin
                    </span>
                  ) : (
                    <select
                      value={
                        VENDOR_ORDER_STATUSES.includes(currentStatus)
                          ? currentStatus
                          : "Pending"
                      }
                      onChange={(e) => setStatus(o.id, e.target.value)}
                      className="input-base w-44 text-sm"
                      data-testid={`v-status-${o.id}`}
                    >
                      {VENDOR_ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="mt-1 text-xs text-[#4A4A4A]">
                  Overall: {o.overall_status}
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {o.items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <img
                    src={it.image}
                    alt=""
                    className="h-8 w-8 rounded object-cover"
                  />
                  <span className="flex-1">
                    {it.name}{" "}
                    <span className="text-xs text-[#4A4A4A]">({it.unit})</span>
                  </span>
                  <span className="text-[#4A4A4A]">×{it.quantity}</span>
                  <span className="font-semibold">
                    {formatINR(vendorLineTotal(it))}
                  </span>
                  {it.line_status && it.line_status !== o.my_status && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-[#4A4A4A]">
                      {it.line_status}
                    </span>
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
    api
      .get("/vendor/analytics")
      .then(({ data }) => setData(data))
      .catch(() => {});
  }, []);

  if (!data)
    return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  const totalSales = data.total_sales ?? data.total_revenue ?? 0;
  const totalPayoutDue =
    (data.wallet?.available_balance ?? 0) + (data.wallet?.pending_balance ?? 0);
  const payoutDue =
    totalPayoutDue > 0 ? totalPayoutDue : (data.pending_payment ?? 0);

  const kpis = [
    { label: "Today's orders", value: data.today_orders },
    { label: "This week", value: data.week_orders },
    {
      label: "This month (₹)",
      value: formatINR(data.month_sales ?? data.month_revenue ?? 0),
    },
    { label: "Total sales (₹)", value: formatINR(totalSales) },
  ];

  const earningsRow = [
    {
      label: "Your sales",
      value: formatINR(totalSales),
      color: "text-[#1B4332]",
    },
    {
      label: "Your payout",
      value: formatINR(payoutDue),
      color: "text-[#F4A261]",
    },
  ];

  return (
    <div className="space-y-8" data-testid="vendor-analytics">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card-base p-5">
            <div className="text-xs uppercase tracking-wider text-[#4A4A4A]">
              {k.label}
            </div>
            <div className="mt-1 font-heading text-2xl font-bold">
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <div className="card-base p-6" data-testid="earnings-breakdown">
        <h3 className="font-heading text-lg font-semibold">
          Earnings breakdown
        </h3>
        <p className="mt-1 text-xs text-[#4A4A4A]">
          Full product earnings on delivered orders — no platform fee deducted.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {earningsRow.map((r) => (
            <div
              key={r.label}
              className="rounded-xl border border-[#E5E5E5] p-4"
            >
              <div className="text-xs uppercase tracking-wider text-[#4A4A4A]">
                {r.label}
              </div>
              <div className={`mt-1 font-heading text-xl font-bold ${r.color}`}>
                {r.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-base p-6">
          <h3 className="font-heading text-lg font-semibold">
            Best-selling products
          </h3>
          {data.best_sellers.length === 0 ? (
            <p className="mt-3 text-sm text-[#4A4A4A]">
              No delivered orders yet. Sales will appear here once you fulfil
              orders.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {data.best_sellers.map((s) => (
                <div
                  key={s.product_id}
                  className="flex items-center gap-3"
                  data-testid={`best-seller-${s.product_id}`}
                >
                  <img
                    src={s.image}
                    alt=""
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{s.name}</div>
                    <div className="text-xs text-[#4A4A4A]">
                      {s.unit} · sold {s.qty}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-[#1B4332]">
                    {formatINR(s.revenue)}
                  </div>
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
                <div
                  key={o.id}
                  className="flex items-center justify-between border-b border-dashed pb-2 last:border-0 last:pb-0"
                >
                  <div>
                    <div className="text-sm font-semibold">
                      #{o.id.slice(-6).toUpperCase()}
                    </div>
                    <div className="text-xs text-[#4A4A4A]">
                      {o.customer_name} ·{" "}
                      {o.items_count ?? o.items?.length ?? 0} item(s)
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-[#1B4332]">
                      {formatINR(vendorOrderTotal(o.items ?? []))}
                    </div>
                    <div className="text-xs text-[#4A4A4A]">
                      {o.overall_status}
                    </div>
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
                  <p className="text-sm text-gray-500">{p.stock} left</p>
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
  const [locationSaving, setLocationSaving] = useState(false);

  useEffect(() => {
    api
      .get("/vendor/settings")
      .then(({ data }) => setV(data))
      .catch(() => {});
  }, []);

  if (!v)
    return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  const up = (k, val) => setV((prev) => ({ ...prev, [k]: val }));
  const upHour = (day, val) =>
    setV((prev) => ({
      ...prev,
      business_hours: { ...(prev.business_hours || {}), [day]: val },
    }));

    const saveShopLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Your browser does not support GPS location.");
      return;
    }

    setLocationSaving(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const latitude = Number(position.coords.latitude);
          const longitude = Number(position.coords.longitude);

          const { data } = await api.patch("/vendor/settings", {
            business_latitude: latitude,
            business_longitude: longitude,
          });

          setV((prev) => ({
            ...prev,
            ...data,
          }));

          toast.success("Shop location saved successfully!");
        } catch (error) {
          toast.error(formatApiError(error));
        } finally {
          setLocationSaving(false);
        }
      },
      (error) => {
        setLocationSaving(false);

        if (error.code === error.PERMISSION_DENIED) {
          toast.error("Please allow location access in your browser.");
        } else if (error.code === error.TIMEOUT) {
          toast.error("Location request timed out. Please try again.");
        } else {
          toast.error("Unable to get your location. Please try again.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  };

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
        delivery_radius_km:
          v.delivery_radius_km === "" || v.delivery_radius_km == null
            ? 0
            : Number(v.delivery_radius_km),
        min_order_amount:
          v.min_order_amount === "" || v.min_order_amount == null
            ? 0
            : Number(v.min_order_amount),
        estimated_delivery_min:
          v.estimated_delivery_min === "" || v.estimated_delivery_min == null
            ? 0
            : Number(v.estimated_delivery_min),
      });
      setV(data);
      toast.success("Shop settings saved");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
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
              <div className="text-xs text-[#4A4A4A]">
                Turn off temporarily during rush / short break.
              </div>
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
              <div className="text-xs text-[#4A4A4A]">
                Products stay visible with a &ldquo;Temporarily closed&rdquo;
                badge. Customers cannot place new orders.
              </div>
            </div>
          </label>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
              Vacation message (optional)
            </label>
            <input
              value={v.vacation_message || ""}
              onChange={(e) => up("vacation_message", e.target.value)}
              placeholder="Closed for Diwali until Nov 5"
              className="input-base"
              data-testid="vacation-message"
            />
          </div>
        </div>
      </section>

      {/* Profile */}
      <section className="card-base p-6">
        <h2 className="font-heading text-lg font-semibold">Business profile</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FF
            label="Business name"
            value={v.business_name}
            onChange={(x) => up("business_name", x)}
            required
          />
          <FF
            label="Pincode"
            value={v.business_pincode || ""}
            onChange={(x) => up("business_pincode", x)}
          />
          <div className="sm:col-span-2">
            <FF
              label="Address"
              value={v.business_address || ""}
              onChange={(x) => up("business_address", x)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">

            <div className="sm:col-span-2 rounded-xl border border-[#E5E5E5] p-4">
  <div className="font-semibold">Shop GPS Location</div>

  <p className="mt-1 text-sm text-[#4A4A4A]">
    Save your shop's actual location for delivery distance calculation.
  </p>

  {v.business_latitude != null && v.business_longitude != null && (
    <p className="mt-2 text-sm text-green-700">
      ✓ Location saved: {Number(v.business_latitude).toFixed(6)},{" "}
      {Number(v.business_longitude).toFixed(6)}
    </p>
  )}

  <button
    type="button"
    onClick={saveShopLocation}
    disabled={locationSaving}
    className="mt-3 rounded-lg bg-[#1B4332] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
  >
    {locationSaving ? "Getting location..." : "Use My Location"}
  </button>
</div>
              About your business
            </label>
            <textarea
              value={v.business_description || ""}
              onChange={(e) => up("business_description", e.target.value)}
              rows={3}
              className="input-base resize-none"
            />
          </div>
          <FF
            label="Shop phone"
            value={v.shop_phone || ""}
            onChange={(x) => up("shop_phone", x)}
            placeholder="+91..."
          />
          <FF
            label="Shop WhatsApp"
            value={v.shop_whatsapp || ""}
            onChange={(x) => up("shop_whatsapp", x)}
            placeholder="+91..."
          />

          <ImageSourcePicker

  label="Shop logo"
  value={v.shop_logo || ""}
  onChange={(url) => up("shop_logo", url)}
  testIdPrefix="shop-logo"
/>

<ImageSourcePicker
  label="Banner image"
  value={v.banner_image || ""}
  onChange={(url) => up("banner_image", url)}
  testIdPrefix="banner-image"
/>
        </div>
      </section>

      {/* Operations */}
      <section className="card-base p-6">
        <h2 className="font-heading text-lg font-semibold">Operations</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <FF
            label="Delivery radius (km)"
            type="number"
            value={v.delivery_radius_km || ""}
            onChange={(x) => up("delivery_radius_km", x)}
          />
          <FF
            label="Min order amount (₹)"
            type="number"
            value={v.min_order_amount || ""}
            onChange={(x) => up("min_order_amount", x)}
          />
          <FF
            label="Estimated delivery (min)"
            type="number"
            value={v.estimated_delivery_min || ""}
            onChange={(x) => up("estimated_delivery_min", x)}
          />
        </div>
      </section>

      {/* Hours */}
      <section className="card-base p-6">
        <h2 className="font-heading text-lg font-semibold">Business hours</h2>
        <p className="mt-1 text-xs text-[#4A4A4A]">
          Use format like &ldquo;08:00-21:00&rdquo; or type
          &ldquo;Closed&rdquo;.
        </p>
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
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              v.status === "Approved"
                ? "bg-green-100 text-green-700"
                : v.status === "Rejected"
                  ? "bg-red-100 text-red-700"
                  : v.status === "Suspended"
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
            Documents were submitted at registration and reviewed by admin.
          </span>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary"
          data-testid="save-settings"
        >
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
    {
      to: "/vendor/analytics",
      title: "Analytics",
      body: "Sales trends, best-sellers, earnings breakdown",
      available: true,
      icon: BarChart3,
      color: "bg-[#1B4332]",
    },
    {
      to: "/vendor/settings",
      title: "Shop Settings",
      body: "Business profile, hours, vacation mode, delivery radius",
      available: true,
      icon: Settings,
      color: "bg-[#E07A5F]",
    },
    {
      to: "/vendor/bank",
      title: "Bank Details",
      body: "Payout account for earnings transfer",
      available: true,
      icon: Landmark,
      color: "bg-[#F4A261]",
    },
    {
      to: "/vendor/payouts",
      title: "Payouts",
      body: "Request and track payout transfers",
      available: true,
      icon: Banknote,
      color: "bg-[#8BA888]",
    },
    {
      to: "/vendor/refer",
      title: "Refer & Earn",
      body: "Invite vendors and earn referral rewards",
      available: true,
      icon: Gift,
      color: "bg-[#E07A5F]",
    },
    {
      to: "/vendor/notifications",
      title: "Notifications",
      body: "Orders, payouts, and account updates",
      available: true,
      icon: Bell,
      color: "bg-[#1B4332]",
    },
    {
      to: "/vendor/support",
      title: "Support",
      body: "Need help? Contact the Ambajogai vendor team",
      available: true,
      icon: LifeBuoy,
      color: "bg-[#8BA888]",
    },
    {
      to: "/vendor/analytics",
      title: "Sales & Earnings",
      body: "Track your sales and payment status",
      available: true,
      icon: BarChart3,
      color: "bg-[#1B4332]",
    },
  ];
  const { logout } = useAuth();
  return (
    <div className="space-y-6" data-testid="vendor-more">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => {
          const inner = (
            <div
              className={`card-base h-full p-5 ${!t.available ? "opacity-60" : "hover:border-[#8BA888]"}`}
            >
              <div
                className={`grid h-10 w-10 place-items-center rounded-xl ${t.color} text-white`}
              >
                <t.icon className="h-5 w-5" />
              </div>
              <div className="mt-4 font-heading text-lg font-semibold">
                {t.title}
              </div>
              <div className="mt-1 text-xs text-[#4A4A4A]">{t.body}</div>
              {!t.available && (
                <div className="mt-2 inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-800">
                  Coming soon
                </div>
              )}
            </div>
          );
          return t.available && t.to ? (
            <NavLink
              key={t.title}
              to={t.to}
              data-testid={`more-tile-${t.title.toLowerCase().replace(/\s/g, "-")}`}
            >
              {inner}
            </NavLink>
          ) : (
            <div key={t.title}>{inner}</div>
          );
        })}
      </div>
      <button
        onClick={logout}
        className="btn-secondary"
        data-testid="more-logout"
      >
        Log out
      </button>
    </div>
  );
}
