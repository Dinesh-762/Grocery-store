import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { api, formatINR, formatApiError } from "@/lib/api";
import {
  CreditCard,
  Truck,
  MapPin,
  Loader2,
  MessageCircle,
  Tag,
  X,
  Navigation,
} from "lucide-react";

export default function Checkout() {
  const {
    items,
    subtotal,
    deliveryFee,
    total: cartTotal,
    clearCart,
  } = useCart();

  const { user } = useAuth();
  const navigate = useNavigate();

  const [store, setStore] = useState({
    upi_id: "ambajogai@upi",
    upi_name: "Ambajogai Grocery Store",
    whatsapp: "+918237214975",
    upi_qr: "/assets/upi-qr.jpeg",
  });

  const [payment, setPayment] = useState("UPI");
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);

  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [couponBusy, setCouponBusy] = useState(false);

  const [form, setForm] = useState({
    full_name: user?.name || "",
    phone: user?.phone || "",
    line1: "",
    landmark: "",
    area: "",
    pincode: "",
    notes: "",
  });

  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
  });

  const [locating, setLocating] = useState(false);

  /* -------------------------------------------------------
     LOAD STORE INFORMATION
  ------------------------------------------------------- */

  useEffect(() => {
    api
      .get("/store/info")
      .then(({ data }) => {
        setStore((current) => ({
          ...current,
          ...data,
        }));
      })
      .catch(() => {});
  }, []);

  /* -------------------------------------------------------
     REDIRECT EMPTY CART
  ------------------------------------------------------- */

  useEffect(() => {
    if (items.length === 0 && !submitting && !placed) {
      navigate("/cart");
    }
  }, [items.length, submitting, placed, navigate]);

  /* -------------------------------------------------------
     FORM UPDATE
  ------------------------------------------------------- */

  const update = (key) => (event) => {
    setForm((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  /* -------------------------------------------------------
     GET CURRENT LOCATION
  ------------------------------------------------------- */

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location is not supported by your browser.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        setLocation({
          latitude,
          longitude,
        });

        toast.success("Location captured successfully!");
        setLocating(false);
      },
      (error) => {
        setLocating(false);

        if (error.code === error.PERMISSION_DENIED) {
          toast.error("Please allow location access.");
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          toast.error("Unable to detect your location.");
        } else if (error.code === error.TIMEOUT) {
          toast.error("Location request timed out.");
        } else {
          toast.error("Unable to get your location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  /* -------------------------------------------------------
     FORM VALIDATION
  ------------------------------------------------------- */

  const validate = () => {
    const requiredFields = [
      "full_name",
      "phone",
      "line1",
      "area",
      "pincode",
    ];

    for (const key of requiredFields) {
      if (!String(form[key] || "").trim()) {
        return `Please fill your ${key.replace("_", " ")}`;
      }
    }

    const cleanPhone = form.phone.replace(/\s/g, "");

    if (!/^\+?\d{10,15}$/.test(cleanPhone)) {
      return "Enter a valid phone number";
    }

    if (!/^\d{6}$/.test(form.pincode)) {
      return "Enter a valid 6-digit pincode";
    }

    return null;
  };

  /* -------------------------------------------------------
     PLACE ORDER
  ------------------------------------------------------- */

  const submit = async () => {
    const error = validate();

    if (error) {
      toast.error(error);
      return;
    }

    setSubmitting(true);

    try {
      const orderPayload = {
        items: items.map((item) => ({
          product_id: item.product_id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          unit: item.unit,
          variant_label: item.variant_label || null,
          note: item.note || null,
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

        /* GPS location */
        latitude: location.latitude,
        longitude: location.longitude,
      };

      const { data } = await api.post("/orders", orderPayload);

      setPlaced(true);
      clearCart();

      toast.success("Order placed successfully!");

      /* ---------------------------------------------------
         STORE WHATSAPP MESSAGE
      --------------------------------------------------- */

      const storeNumber = String(store.whatsapp || "").replace(
        /[^\d]/g,
        ""
      );

      const itemsBlock = (data.items || items)
        .map((item) => {
          const variant = item.variant_label
            ? ` (${item.variant_label})`
            : item.unit
            ? ` (${item.unit})`
            : "";

          const note = item.note ? `\n  Note: ${item.note}` : "";

          const itemTotal =
            Number(item.price || 0) * Number(item.quantity || 0);

          return `- ${item.name}${variant} x ${item.quantity} @ ₹${item.price} = ₹${itemTotal.toFixed(
            2
          )}${note}`;
        })
        .join("\n");

      const orderId = data.id
        ? String(data.id).slice(-6).toUpperCase()
        : "NEW";

      const storeMessage = encodeURIComponent(
        `NEW ORDER #${orderId}

${itemsBlock}

Subtotal: ₹${data.subtotal ?? subtotal}
Delivery: ${
          Number(data.delivery_fee ?? deliveryFee) === 0
            ? "FREE"
            : `₹${data.delivery_fee ?? deliveryFee}`
        }${
          data.discount
            ? `\nDiscount: -₹${data.discount}`
            : discount > 0
            ? `\nDiscount: -₹${discount}`
            : ""
        }
Total: ₹${data.total ?? total}
Payment: ${data.payment_method ?? payment}

Customer: ${data.address?.full_name ?? form.full_name}
Phone: ${data.address?.phone ?? form.phone}
Address: ${data.address?.line1 ?? form.line1}${
          (data.address?.landmark ?? form.landmark)
            ? `, ${data.address?.landmark ?? form.landmark}`
            : ""
        }, ${data.address?.area ?? form.area}, ${
          data.address?.pincode ?? form.pincode
        }

${
  location.latitude && location.longitude
    ? `Customer Location:
https://www.google.com/maps?q=${location.latitude},${location.longitude}`
    : "Customer Location: Not provided"
}`
      );

      if (storeNumber) {
        window.open(
          `https://wa.me/${storeNumber}?text=${storeMessage}`,
          "_blank"
        );
      }

      /* ---------------------------------------------------
         CUSTOMER WHATSAPP NOTIFICATION
      --------------------------------------------------- */

      try {
        const { data: notification } = await api.post(
          "/notify/order-whatsapp",
          {
            order_id: data.id,
            event: "placed",
          }
        );

        if (notification?.url) {
          setTimeout(() => {
            window.open(notification.url, "_blank");
          }, 350);
        }
      } catch {
        // WhatsApp notification is non-blocking.
      }

      /* ---------------------------------------------------
         ORDER PAGE
      --------------------------------------------------- */

      navigate(`/orders/${data.id}`);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------------------------------------------
     COUPON
  ------------------------------------------------------- */

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();

    if (!code) {
      toast.error("Enter a coupon code.");
      return;
    }

    setCouponBusy(true);

    try {
      const { data } = await api.get(
        `/coupons/${encodeURIComponent(code)}/validate?subtotal=${subtotal}`
      );

      setCoupon(data);

      toast.success(
        `Coupon ${data.code} applied — saved ${formatINR(data.discount)}`
      );
    } catch (error) {
      setCoupon(null);
      toast.error(formatApiError(error));
    } finally {
      setCouponBusy(false);
    }
  };

  const removeCoupon = () => {
    setCoupon(null);
    setCouponInput("");
  };

  /* -------------------------------------------------------
     TOTAL
  ------------------------------------------------------- */

  const discount = Number(coupon?.discount || 0);

  const total = Math.max(
    0,
    Math.round((Number(cartTotal || 0) - discount) * 100) / 100
  );

  /* -------------------------------------------------------
     UPI QR
  ------------------------------------------------------- */

  const upiUrl = `upi://pay?pa=${encodeURIComponent(
    store.upi_id || ""
  )}&pn=${encodeURIComponent(
    store.upi_name || ""
  )}&am=${total}&cu=INR&tn=${encodeURIComponent(
    "Ambajogai Grocery Order"
  )}`;

  const qrSrc =
    store.upi_qr ||
    `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
      upiUrl
    )}`;

  /* -------------------------------------------------------
     UI
  ------------------------------------------------------- */

  return (
    <div
      className="container-app py-8"
      data-testid="checkout-page"
    >
      <h1 className="font-heading text-3xl font-bold sm:text-4xl">
        Checkout
      </h1>

      <p className="mt-2 text-sm text-[#4A4A4A]">
        Review your delivery details and payment
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* LEFT */}
        <div className="space-y-6">
          {/* DELIVERY ADDRESS */}
          <section className="card-base p-6">
            <div className="mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#1B4332]" />

              <h2 className="font-heading text-lg font-semibold">
                Delivery address
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Full name"
                value={form.full_name}
                onChange={update("full_name")}
                testid="addr-name"
              />

              <Field
                label="Phone"
                value={form.phone}
                onChange={update("phone")}
                testid="addr-phone"
                placeholder="+91..."
              />

              <div className="sm:col-span-2">
                <Field
                  label="Address line"
                  value={form.line1}
                  onChange={update("line1")}
                  testid="addr-line"
                  placeholder="House / flat no, street"
                />
              </div>

              <Field
                label="Landmark (optional)"
                value={form.landmark}
                onChange={update("landmark")}
                testid="addr-landmark"
              />

              <Field
                label="Area / Locality"
                value={form.area}
                onChange={update("area")}
                testid="addr-area"
              />

              <Field
                label="Pincode"
                value={form.pincode}
                onChange={update("pincode")}
                testid="addr-pincode"
                placeholder="431517"
              />

              {/* LOCATION */}
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  disabled={locating}
                  className="btn-secondary flex items-center gap-2"
                  data-testid="get-location-btn"
                >
                  {locating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Navigation className="h-4 w-4" />
                  )}

                  {locating
                    ? "Getting location..."
                    : location.latitude
                    ? "Location captured"
                    : "Use my current location"}
                </button>

                {location.latitude && location.longitude && (
                  <p className="mt-2 text-xs text-green-700">
                    ✓ GPS location captured successfully.
                  </p>
                )}
              </div>

              {/* NOTES */}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
                  Delivery notes (optional)
                </label>

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

          {/* PAYMENT */}
          <section className="card-base p-6">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#1B4332]" />

              <h2 className="font-heading text-lg font-semibold">
                Payment method
              </h2>
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

            {/* UPI */}
            {payment === "UPI" && (
              <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#8BA888] bg-[#FDFBF7] p-6 text-center">
                <div className="text-sm font-semibold">
                  Scan & pay {formatINR(total)}
                </div>

                <img
                  src={qrSrc}
                  alt="UPI QR"
                  className="h-56 w-56 rounded-lg border border-[#E5E5E5] bg-white object-contain p-2"
                  data-testid="upi-qr"
                />

                <div className="text-xs font-semibold text-[#1B4332]">
                  PhonePe · Google Pay · Paytm · any UPI app
                </div>

                <div className="text-xs text-[#4A4A4A]">
                  Enter the amount{" "}
                  <span className="font-mono font-semibold">
                    {formatINR(total)}
                  </span>{" "}
                  in your UPI app after scanning.
                </div>

                <div className="text-xs text-[#4A4A4A]">
                  After payment, place the order — we&apos;ll confirm on
                  WhatsApp.
                </div>
              </div>
            )}

            {/* COD */}
            {payment === "COD" && (
              <div className="mt-6 flex items-start gap-2 rounded-xl bg-[#8BA888]/10 p-4 text-sm text-[#1B4332]">
                <Truck className="mt-0.5 h-4 w-4" />

                <span>
                  Please keep exact change ready. Cash on Delivery available
                  across Ambajogai.
                </span>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT SUMMARY */}
        <aside
          className="card-base sticky top-24 h-fit p-6"
          data-testid="checkout-summary"
        >
          <h2 className="font-heading text-lg font-semibold">
            Order summary
          </h2>

          {/* ITEMS */}
          <div className="mt-4 max-h-64 space-y-3 overflow-auto pr-1">
            {items.map((item) => (
              <div
                key={`${item.product_id}-${item.variant_label || ""}`}
                className="flex gap-3"
              >
                <img
                  src={item.image}
                  alt=""
                  className="h-12 w-12 rounded-lg object-cover"
                />

                <div className="flex-1 text-sm">
                  <div className="font-medium">{item.name}</div>

                  <div className="text-xs text-[#4A4A4A]">
                    Qty {item.quantity} × {formatINR(item.price)}
                  </div>
                </div>

                <div className="text-sm font-semibold">
                  {formatINR(item.price * item.quantity)}
                </div>
              </div>
            ))}
          </div>

          {/* PRICE */}
          <div className="mt-4 space-y-2 border-t border-dashed pt-4 text-sm">
            <Row
              label="Subtotal"
              value={formatINR(subtotal)}
            />

            <Row
              label="Delivery"
              value={
                deliveryFee === 0
                  ? "FREE"
                  : formatINR(deliveryFee)
              }
            />

            {discount > 0 && (
              <Row
                label={`Coupon (${coupon.code})`}
                value={`- ${formatINR(discount)}`}
              />
            )}
          </div>

          {/* COUPON */}
          <div className="mt-4 border-t border-dashed pt-4">
            {coupon ? (
              <div className="flex items-center justify-between rounded-xl bg-green-50 px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-green-700">
                  <Tag className="h-4 w-4" />

                  <span className="font-semibold">
                    {coupon.code}
                  </span>

                  {coupon.discount_pct !== undefined && (
                    <span className="text-xs">
                      -{coupon.discount_pct}%
                    </span>
                  )}
                </span>

                <button
                  type="button"
                  onClick={removeCoupon}
                  className="text-green-700 hover:text-green-900"
                  data-testid="coupon-remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(event) =>
                    setCouponInput(
                      event.target.value.toUpperCase()
                    )
                  }
                  placeholder="Coupon code"
                  className="input-base"
                  data-testid="coupon-input"
                />

                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={
                    couponBusy || !couponInput.trim()
                  }
                  className="btn-secondary shrink-0 px-4 py-2 text-sm"
                  data-testid="coupon-apply"
                >
                  {couponBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Apply"
                  )}
                </button>
              </div>
            )}
          </div>

          {/* TOTAL */}
          <div className="mt-3 flex items-center justify-between border-t border-dashed pt-3">
            <span className="text-sm font-semibold">
              Total
            </span>

            <span
              className="font-heading text-2xl font-bold text-[#1B4332]"
              data-testid="checkout-total"
            >
              {formatINR(total)}
            </span>
          </div>

          {/* PLACE ORDER */}
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="btn-primary mt-6 w-full"
            data-testid="place-order-btn"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}

            {submitting
              ? "Placing order…"
              : "Place order"}
          </button>

          <p className="mt-3 text-center text-xs text-[#4A4A4A]">
            We&apos;ll send order confirmation via WhatsApp.
          </p>
        </aside>
      </div>
    </div>
  );
}

/* =========================================================
   FIELD
========================================================= */

function Field({
  label,
  value,
  onChange,
  testid,
  placeholder,
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
        {label}
      </label>

      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="input-base"
        data-testid={testid}
      />
    </div>
  );
}

/* =========================================================
   ROW
========================================================= */

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#4A4A4A]">
        {label}
      </span>

      <span className="font-semibold">
        {value}
      </span>
    </div>
  );
}

/* =========================================================
   PAYMENT OPTION
========================================================= */

function PayOption({
  selected,
  onClick,
  title,
  sub,
  testid,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-all ${
        selected
          ? "border-[#1B4332] bg-[#1B4332]/5 ring-1 ring-[#1B4332]"
          : "border-[#E5E5E5] hover:border-[#8BA888]"
      }`}
      data-testid={testid}
    >
      <div className="font-semibold text-[#1A1A1A]">
        {title}
      </div>

      <div className="mt-1 text-xs text-[#4A4A4A]">
        {sub}
      </div>
    </button>
  );
}