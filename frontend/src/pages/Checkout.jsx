import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { api, formatINR, formatApiError } from "@/lib/api";
import { CreditCard, Truck, MapPin, Loader2, MessageCircle, Tag, X } from "lucide-react";

export default function Checkout() {
  const { items, subtotal, deliveryFee, total: cartTotal, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [store, setStore] = useState({ upi_id: "ambajogai@upi", upi_name: "Ambajogai Grocery", whatsapp: "+919999999999" });
  const [payment, setPayment] = useState("UPI");
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState(null); // {code, discount_pct, discount}
  const [couponBusy, setCouponBusy] = useState(false);
  const [f, setForm] = useState({
    full_name: user?.name || "",
    phone: user?.phone || "",
    line1: "",
    landmark: "",
    area: "",
    pincode: "",
    notes: "",
  });
  // Legacy alias so all existing `form.foo` references keep working (this was a rename mid-refactor)
  const form = f;

  useEffect(() => {
    api.get("/store/info").then(({ data }) => setStore(data)).catch(() => {});
  }, []);

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
        items,
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
      });
      setPlaced(true);
      clearCart();
      toast.success("Order placed successfully!");

      // WhatsApp confirmation
      const num = store.whatsapp.replace(/[^\d]/g, "");
      const msg = encodeURIComponent(
        `New order #${data.id.slice(-6).toUpperCase()}\n${data.items.length} item(s) — ${formatINR(data.total)}\nName: ${data.address.full_name}\nPhone: ${data.address.phone}\nAddress: ${data.address.line1}, ${data.address.area}, ${data.address.pincode}\nPayment: ${data.payment_method}`
      );
      window.open(`https://wa.me/${num}?text=${msg}`, "_blank");

      navigate(`/orders/${data.id}`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSubmitting(false);
    }
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

  const removeCoupon = () => { setCoupon(null); setCouponInput(""); };

  const discount = coupon?.discount || 0;
  const total = Math.max(0, Math.round((cartTotal - discount) * 100) / 100);

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
            <div className="mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#1B4332]" />
              <h2 className="font-heading text-lg font-semibold">Delivery address</h2>
            </div>
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
                <div className="text-sm font-semibold">Scan to pay {formatINR(total)}</div>
                <img src={qrSrc} alt="UPI QR" className="h-52 w-52 rounded-lg" data-testid="upi-qr" />
                <div className="text-xs text-[#4A4A4A]">UPI ID: <span className="font-mono">{store.upi_id}</span></div>
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
            <Row label="Delivery" value={deliveryFee === 0 ? "FREE" : formatINR(deliveryFee)} />
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
