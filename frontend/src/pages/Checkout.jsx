import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { api, formatINR, formatApiError } from "@/lib/api";
import { CreditCard, Truck, MapPin, Loader2, MessageCircle, Tag, X, Home as HomeIcon, Briefcase, MapPinned, Trash2, Plus, Locate } from "lucide-react";
import { haversineKm, reverseGeocode } from "@/lib/geo";

export default function Checkout() {
  const { items, subtotal, deliveryFee, total: cartTotal, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [store, setStore] = useState({ upi_id: "ambajogai@upi", upi_name: "Ambajogai Grocery Store", whatsapp: "+918237214975", upi_qr: "/assets/upi-qr.jpeg" });
  const [payment, setPayment] = useState("UPI");
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState(null); // {code, discount_pct, discount}
  const [couponBusy, setCouponBusy] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddrId, setSelectedAddrId] = useState(null);
  const [saveThisAddress, setSaveThisAddress] = useState(false);
  const [addrLabel, setAddrLabel] = useState("Home");
  const [locating, setLocating] = useState(false);

  const detectMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported by your browser");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const addr = await reverseGeocode(latitude, longitude);
          const centerLat = store?.delivery?.center_lat ?? 18.735994;
          const centerLng = store?.delivery?.center_lng ?? 76.3891403;
          const distKm = haversineKm(centerLat, centerLng, latitude, longitude);
          setForm((prev) => ({
            ...prev,
            line1: addr.line1 || prev.line1,
            area: addr.area || prev.area,
            pincode: addr.pincode || prev.pincode,
            distance_km: distKm <= 1.5 ? "1.0" : distKm <= 3 ? "3.0" : distKm <= 5 ? "5.0" : distKm <= 7 ? "7.0" : "10.0",
          }));
          setSelectedAddrId(null);
          toast.success(`Location detected · ~${distKm.toFixed(2)} km from store`);
        } catch (err) {
          toast.error("Could not resolve your address. Please fill it manually.");
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        toast.error(err.code === 1 ? "Location permission denied" : "Unable to get your location");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };
  const [f, setForm] = useState({
    full_name: user?.name || "",
    phone: user?.phone || "",
    line1: "",
    landmark: "",
    area: "",
    pincode: "",
    notes: "",
    distance_km: "1.0",
  });
  const form = f;

  useEffect(() => {
    api.get("/store/info").then(({ data }) => setStore(data)).catch(() => {});
    api.get("/users/me/addresses").then(({ data }) => {
      setSavedAddresses(data);
      if (data.length > 0) {
        // auto-fill from first saved address
        pickAddress(data[0]);
      }
    }).catch(() => {});
  }, []);

  const pickAddress = (a) => {
    setSelectedAddrId(a.id);
    setForm((prev) => ({
      ...prev,
      full_name: a.full_name || prev.full_name,
      phone: a.phone || prev.phone,
      line1: a.line1 || "",
      landmark: a.landmark || "",
      area: a.area || "",
      pincode: a.pincode || "",
    }));
  };

  const deleteAddress = async (id) => {
    if (!window.confirm("Remove this saved address?")) return;
    try {
      await api.delete(`/users/me/addresses/${id}`);
      const next = savedAddresses.filter((a) => a.id !== id);
      setSavedAddresses(next);
      if (selectedAddrId === id) setSelectedAddrId(null);
      toast.success("Address removed");
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  useEffect(() => {
    if (items.length === 0 && !submitting && !placed) navigate("/cart");
  }, [items.length, submitting, placed, navigate]);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const req = ["full_name", "phone", "line1", "area", "pincode"];
    for (const k of req) if (!form[k].trim()) return `Please fill your ${k.replace("_", " ")}`;
    if (!/^\+?\d{10,15}$/.test(form.phone.replace(/\s/g, ""))) return "Enter a valid phone number";
    if (!/^\d{6}$/.test(form.pincode)) return "Enter a valid 6-digit pincode";
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) return toast.error(err);
    setSubmitting(true);
    try {
      const { data } = await api.post("/orders", {
        items: items.map((i) => ({
          product_id: i.product_id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          image: i.image,
          unit: i.unit,
          variant_label: i.variant_label || null,
          note: i.note || null,
        })),
        address: {
          full_name: form.full_name,
          phone: form.phone,
          line1: form.line1,
          landmark: form.landmark,
          area: form.area,
          city: "Ambajogai",
          pincode: form.pincode,
        },
        payment_method: payment,
        notes: form.notes,
        coupon_code: coupon?.code || null,
        distance_km: form.distance_km ? Number(form.distance_km) : null,
      });
      setPlaced(true);
      clearCart();
      toast.success("Order placed successfully!");

      // Save this address to user profile if requested
      if (saveThisAddress && !selectedAddrId) {
        try {
          await api.post("/users/me/addresses", {
            label: addrLabel || "Home",
            full_name: form.full_name,
            phone: form.phone,
            line1: form.line1,
            landmark: form.landmark || "",
            area: form.area,
            city: "Ambajogai",
            pincode: form.pincode,
          });
        } catch { /* non-blocking */ }
      }

      // 1) Store-facing notification with FULL order details (existing behavior — improved)
      const storeNum = store.whatsapp.replace(/[^\d]/g, "");
      const itemsBlock = data.items.map((it) =>
        `- ${it.name}${it.variant_label ? ` (${it.variant_label})` : ` (${it.unit})`} x ${it.quantity} @ ₹${it.price} = ₹${(it.price * it.quantity).toFixed(2)}${it.note ? `\n  Note: ${it.note}` : ""}`
      ).join("\n");
      const storeMsg = encodeURIComponent(
        `NEW ORDER #${data.id.slice(-6).toUpperCase()}\n\n${itemsBlock}\n\nSubtotal: ₹${data.subtotal}\nDelivery: ${data.delivery_fee === 0 ? "FREE" : "₹" + data.delivery_fee}${data.discount ? `\nDiscount: -₹${data.discount}` : ""}\nTotal: ₹${data.total}\nPayment: ${data.payment_method}\n\nCustomer: ${data.address.full_name}\nPhone: ${data.address.phone}\nAddress: ${data.address.line1}${data.address.landmark ? ", " + data.address.landmark : ""}, ${data.address.area}, ${data.address.pincode}`
      );
      window.open(`https://wa.me/${storeNum}?text=${storeMsg}`, "_blank");

      // 2) Customer-facing thank-you (server template with full details)
      try {
        const { data: notif } = await api.post("/notify/order-whatsapp", { order_id: data.id, event: "placed" });
        setTimeout(() => window.open(notif.url, "_blank"), 350);
      } catch { /* non-blocking */ }

      navigate(`/orders/${data.id}`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const removeCoupon = () => {
    setCoupon(null);
    setCouponInput("");
  };

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponBusy(true);
    try {
      const { data } = await api.get(`/coupons/${encodeURIComponent(code)}/validate?subtotal=${subtotal}`);
      setCoupon(data);
      toast.success(`Coupon ${data.code} applied — saved ${formatINR(data.discount)}`);
    } catch (e) {
      setCoupon(null);
      toast.error(formatApiError(e));
    } finally {
      setCouponBusy(false);
    }
  };

  const discount = coupon?.discount || 0;
  // Effective delivery fee: matches server formula from GET /store/info
  const distKm = Number(f.distance_km || 0);
  const effectiveDelivery = subtotal >= 499 ? 0 : (distKm <= 1.5 ? 15 : Math.round((15 + (distKm - 1.5) * 12) * 100) / 100);
  const total = Math.max(0, Math.round((subtotal + effectiveDelivery - discount) * 100) / 100);

  // UPI QR — use upi:// deep link encoded as QR via qrserver (no key needed)
  const upiUrl = `upi://pay?pa=${encodeURIComponent(store.upi_id)}&pn=${encodeURIComponent(store.upi_name)}&am=${total}&cu=INR&tn=${encodeURIComponent("Ambajogai Grocery Order")}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUrl)}`;

  return (
    <div className="container-app py-8" data-testid="checkout-page">
      <h1 className="font-heading text-3xl font-bold sm:text-4xl">Checkout</h1>
      <p className="mt-2 text-sm text-[#4A4A4A]">Review your delivery details and payment</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* Address */}
          <section className="card-base p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#1B4332]" />
                <h2 className="font-heading text-lg font-semibold">Delivery address</h2>
              </div>
              <button
                type="button"
                onClick={detectMyLocation}
                disabled={locating}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#1B4332] bg-[#1B4332]/5 px-3 py-1.5 text-xs font-semibold text-[#1B4332] hover:bg-[#1B4332]/10 disabled:opacity-60"
                data-testid="detect-location-btn"
              >
                {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Locate className="h-3.5 w-3.5" />}
                {locating ? "Detecting…" : "Use my current location"}
              </button>
            </div>

            {/* Saved addresses */}
            {savedAddresses.length > 0 && (
              <div className="mb-4" data-testid="saved-addresses">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#4A4A4A]">Saved addresses</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {savedAddresses.map((a) => {
                    const Icon = a.label === "Work" ? Briefcase : a.label === "Home" ? HomeIcon : MapPinned;
                    const selected = selectedAddrId === a.id;
                    return (
                      <div
                        key={a.id}
                        className={`relative cursor-pointer rounded-xl border p-3 transition-all ${
                          selected ? "border-[#1B4332] bg-[#1B4332]/5 ring-1 ring-[#1B4332]" : "border-[#E5E5E5] hover:border-[#8BA888]"
                        }`}
                        onClick={() => pickAddress(a)}
                        data-testid={`saved-addr-${a.id}`}
                      >
                        <div className="flex items-start gap-2 pr-6">
                          <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1B4332]" />
                          <div className="flex-1 text-xs">
                            <div className="font-semibold text-[#1A1A1A]">{a.label} · {a.full_name}</div>
                            <div className="text-[#4A4A4A]">
                              {a.line1}{a.landmark ? `, ${a.landmark}` : ""}, {a.area}, {a.pincode}
                            </div>
                            <div className="text-[#4A4A4A]">{a.phone}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); deleteAddress(a.id); }}
                          className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Remove"
                          data-testid={`delete-addr-${a.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAddrId(null);
                    setForm((prev) => ({ ...prev, line1: "", landmark: "", area: "", pincode: "" }));
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#1B4332] hover:text-[#E07A5F]"
                  data-testid="use-new-address"
                >
                  <Plus className="h-3.5 w-3.5" /> Use a new address
                </button>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" value={form.full_name} onChange={update("full_name")} testid="addr-name" />
              <Field label="Phone" value={form.phone} onChange={update("phone")} testid="addr-phone" placeholder="+91..." />
              <div className="sm:col-span-2">
                <Field label="Address line" value={form.line1} onChange={update("line1")} testid="addr-line" placeholder="House / flat no, street" />
              </div>
              <Field label="Landmark (optional)" value={form.landmark} onChange={update("landmark")} testid="addr-landmark" />
              <Field label="Area / Locality" value={form.area} onChange={update("area")} testid="addr-area" />
              <Field label="Pincode" value={form.pincode} onChange={update("pincode")} testid="addr-pincode" placeholder="431517" />
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Distance from store (km)</label>
                <select
                  value={f.distance_km}
                  onChange={(e) => setForm({ ...f, distance_km: e.target.value })}
                  className="input-base"
                  data-testid="distance-km"
                >
                  <option value="1.0">Within 1.5 km (₹15 delivery)</option>
                  <option value="3.0">3 km (₹33 delivery)</option>
                  <option value="5.0">5 km (₹57 delivery)</option>
                  <option value="7.0">7 km (₹81 delivery)</option>
                  <option value="10.0">10 km (₹117 delivery)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Delivery notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={update("notes")}
                  rows={2}
                  className="input-base resize-none"
                  placeholder="Ring the bell twice, leave at door, etc."
                  data-testid="addr-notes"
                />
              </div>

              {/* Save this address */}
              {!selectedAddrId && (
                <div className="sm:col-span-2 rounded-xl bg-[#8BA888]/10 p-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[#1A1A1A]" data-testid="save-address-toggle-label">
                    <input
                      type="checkbox"
                      checked={saveThisAddress}
                      onChange={(e) => setSaveThisAddress(e.target.checked)}
                      data-testid="save-address-toggle"
                    />
                    Save this address for next time
                  </label>
                  {saveThisAddress && (
                    <div className="mt-2 flex gap-2">
                      {["Home", "Work", "Other"].map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setAddrLabel(l)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            addrLabel === l ? "bg-[#1B4332] text-white" : "bg-white text-[#1B4332] ring-1 ring-[#1B4332]"
                          }`}
                          data-testid={`addr-label-${l.toLowerCase()}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Payment */}
          <section className="card-base p-6">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#1B4332]" />
              <h2 className="font-heading text-lg font-semibold">Payment method</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <PayOption
                selected={payment === "UPI"}
                onClick={() => setPayment("UPI")}
                title="UPI QR"
                sub="Pay via any UPI app"
                testid="pay-upi"
              />
              <PayOption
                selected={payment === "COD"}
                onClick={() => setPayment("COD")}
                title="Cash on Delivery"
                sub="Pay when you receive"
                testid="pay-cod"
              />
            </div>

            {payment === "UPI" && (
              <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#8BA888] bg-[#FDFBF7] p-6 text-center">
                <div className="text-sm font-semibold">Scan & pay {formatINR(total)}</div>
                <img
                  src={store.upi_qr || "/assets/upi-qr.jpeg"}
                  alt="UPI QR"
                  className="h-56 w-56 rounded-lg border border-[#E5E5E5] bg-white object-contain p-2"
                  data-testid="upi-qr"
                />
                <div className="text-xs font-semibold text-[#1B4332]">PhonePe · Google Pay · Paytm · any UPI app</div>
                <div className="text-xs text-[#4A4A4A]">Enter the amount <span className="font-mono font-semibold">{formatINR(total)}</span> in your UPI app after scanning.</div>
                <div className="text-xs text-[#4A4A4A]">After payment, place the order — we&apos;ll confirm on WhatsApp.</div>
              </div>
            )}
            {payment === "COD" && (
              <div className="mt-6 flex items-start gap-2 rounded-xl bg-[#8BA888]/10 p-4 text-sm text-[#1B4332]">
                <Truck className="mt-0.5 h-4 w-4" />
                <span>Please keep exact change ready. Cash on Delivery available across Ambajogai.</span>
              </div>
            )}
          </section>
        </div>

        {/* Summary */}
        <aside className="card-base sticky top-24 h-fit p-6" data-testid="checkout-summary">
          <h2 className="font-heading text-lg font-semibold">Order summary</h2>
          <div className="mt-4 max-h-64 space-y-3 overflow-auto pr-1">
            {items.map((it) => (
              <div key={it.product_id} className="flex gap-3">
                <img src={it.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <div className="flex-1 text-sm">
                  <div className="font-medium">{it.name}</div>
                  <div className="text-xs text-[#4A4A4A]">Qty {it.quantity} × {formatINR(it.price)}</div>
                </div>
                <div className="text-sm font-semibold">{formatINR(it.price * it.quantity)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2 border-t border-dashed pt-4 text-sm">
            <Row label="Subtotal" value={formatINR(subtotal)} />
            <Row label="Delivery" value={effectiveDelivery === 0 ? "FREE" : formatINR(effectiveDelivery)} />
            {discount > 0 && (
              <Row label={`Coupon (${coupon.code})`} value={`- ${formatINR(discount)}`} />
            )}
          </div>

          {/* Coupon */}
          <div className="mt-4 border-t border-dashed pt-4">
            {coupon ? (
              <div className="flex items-center justify-between rounded-xl bg-green-50 px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-green-700">
                  <Tag className="h-4 w-4" />
                  <span className="font-semibold">{coupon.code}</span>
                  <span className="text-xs">-{coupon.discount_pct}%</span>
                </span>
                <button onClick={removeCoupon} className="text-green-700 hover:text-green-900" data-testid="coupon-remove">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Coupon code"
                  className="input-base"
                  data-testid="coupon-input"
                />
                <button
                  onClick={applyCoupon}
                  disabled={couponBusy || !couponInput.trim()}
                  className="btn-secondary shrink-0 px-4 py-2 text-sm"
                  data-testid="coupon-apply"
                >
                  {couponBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                </button>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-dashed pt-3">
            <span className="text-sm font-semibold">Total</span>
            <span className="font-heading text-2xl font-bold text-[#1B4332]" data-testid="checkout-total">{formatINR(total)}</span>
          </div>
          <button
            onClick={submit}
            disabled={submitting}
            className="btn-primary mt-6 w-full"
            data-testid="place-order-btn"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            {submitting ? "Placing order…" : "Place order"}
          </button>
          <p className="mt-3 text-center text-xs text-[#4A4A4A]">
            We&apos;ll send order confirmation via WhatsApp.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, testid, placeholder }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">{label}</label>
      <input value={value} onChange={onChange} placeholder={placeholder} className="input-base" data-testid={testid} />
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

function PayOption({ selected, onClick, title, sub, testid }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-all ${
        selected ? "border-[#1B4332] bg-[#1B4332]/5 ring-1 ring-[#1B4332]" : "border-[#E5E5E5] hover:border-[#8BA888]"
      }`}
      data-testid={testid}
    >
      <div className="font-semibold text-[#1A1A1A]">{title}</div>
      <div className="mt-1 text-xs text-[#4A4A4A]">{sub}</div>
    </button>
  );
}
