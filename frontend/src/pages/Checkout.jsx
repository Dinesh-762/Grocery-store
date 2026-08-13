import { useState, useEffect, useMemo } from "react";
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

/*
|--------------------------------------------------------------------------
| Pricing configuration
|--------------------------------------------------------------------------
| These values match the backend pricing rules.
|
| Platform fee : ₹10
| GST          : 5%
| CGST         : 2.5%
| SGST         : 2.5%
|
| Delivery:
| <= 1.5 km : ₹13/km
| > 1.5 km  : ₹20/km
|--------------------------------------------------------------------------
*/

const PLATFORM_FEE = 10;
const GST_RATE = 0.05;
const CGST_RATE = 0.025;
const SGST_RATE = 0.025;

const DELIVERY_RATE_PER_KM = 13;
const DELIVERY_RATE_ABOVE_1_5_KM = 20;

const STORE_LATITUDE = 18.73;
const STORE_LONGITUDE = 76.38;

export default function Checkout() {
  const {
    items,
    subtotal,
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

  /*
  |--------------------------------------------------------------------------
  | Load store information
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | Redirect if cart is empty
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (items.length === 0 && !submitting && !placed) {
      navigate("/cart");
    }
  }, [items.length, submitting, placed, navigate]);

  /*
  |--------------------------------------------------------------------------
  | Update form
  |--------------------------------------------------------------------------
  */

  const update = (key) => (event) => {
    setForm((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  /*
  |--------------------------------------------------------------------------
  | GPS Location
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | Calculate distance
  |--------------------------------------------------------------------------
  */

  const calculateDistanceKm = (
    lat1,
    lon1,
    lat2,
    lon2
  ) => {
    const earthRadius = 6371;

    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *
        Math.sin(dLon / 2) ** 2;

    const c =
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );

    return Math.round(earthRadius * c * 100) / 100;
  };

  /*
  |--------------------------------------------------------------------------
  | Delivery fee
  |--------------------------------------------------------------------------
  */

  const estimatedDistance = useMemo(() => {
    if (
      location.latitude === null ||
      location.longitude === null
    ) {
      return null;
    }

    return calculateDistanceKm(
      STORE_LATITUDE,
      STORE_LONGITUDE,
      Number(location.latitude),
      Number(location.longitude)
    );
  }, [location]);

  const estimatedDeliveryFee = useMemo(() => {
    if (!estimatedDistance || estimatedDistance <= 0) {
      return 0;
    }

    if (estimatedDistance <= 1.5) {
      return Math.round(
        estimatedDistance * DELIVERY_RATE_PER_KM * 100
      ) / 100;
    }

    return Math.round(
      estimatedDistance *
        DELIVERY_RATE_ABOVE_1_5_KM *
        100
    ) / 100;
  }, [estimatedDistance]);

  /*
  |--------------------------------------------------------------------------
  | Coupon
  |--------------------------------------------------------------------------
  */

  const discount = Number(coupon?.discount || 0);

  /*
  |--------------------------------------------------------------------------
  | Pricing calculation
  |--------------------------------------------------------------------------
  */

  const discountedSubtotal = Math.max(
    0,
    Number(subtotal || 0) - discount
  );

  const platformFee =
    discountedSubtotal > 0
      ? PLATFORM_FEE
      : 0;

  const taxableAmount =
    discountedSubtotal +
    platformFee +
    Number(estimatedDeliveryFee || 0);

  const cgst =
    Math.round(
      taxableAmount * CGST_RATE * 100
    ) / 100;

  const sgst =
    Math.round(
      taxableAmount * SGST_RATE * 100
    ) / 100;

  const gst =
    Math.round(
      (cgst + sgst) * 100
    ) / 100;

  const estimatedTotal =
    Math.round(
      (
        discountedSubtotal +
        platformFee +
        Number(estimatedDeliveryFee || 0) +
        gst
      ) * 100
    ) / 100;

  /*
  |--------------------------------------------------------------------------
  | Form validation
  |--------------------------------------------------------------------------
  */

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
        return `Please fill your ${key.replace(
          "_",
          " "
        )}`;
      }
    }

    const cleanPhone = form.phone.replace(
      /\s/g,
      ""
    );

    if (!/^\+?\d{10,15}$/.test(cleanPhone)) {
      return "Enter a valid phone number";
    }

    if (!/^\d{6}$/.test(form.pincode)) {
      return "Enter a valid 6-digit pincode";
    }

    /*
     * Backend requires GPS because delivery charge
     * is calculated from customer's location.
     */

    if (
      location.latitude === null ||
      location.longitude === null
    ) {
      return "Please allow location access so delivery charges can be calculated.";
    }

    return null;
  };

  /*
  |--------------------------------------------------------------------------
  | Place order
  |--------------------------------------------------------------------------
  */

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
          variant_label:
            item.variant_label || null,
          note: item.note || null,
        })),

        /*
         * IMPORTANT:
         * GPS coordinates are inside address because
         * backend reads payload.address.latitude/longitude.
         */

        address: {
          full_name: form.full_name,
          phone: form.phone,
          line1: form.line1,
          landmark: form.landmark,
          area: form.area,
          city: "Ambajogai",
          pincode: form.pincode,

          latitude: Number(
            location.latitude
          ),
          longitude: Number(
            location.longitude
          ),
        },

        payment_method: payment,

        notes: form.notes,

        coupon_code:
          coupon?.code || null,
      };

      const { data } = await api.post(
        "/orders",
        orderPayload
      );

      setPlaced(true);

      /*
       * Backend is authoritative.
       * Use backend calculated totals.
       */

      const finalSubtotal = Number(
        data.subtotal ?? subtotal
      );

      const finalDeliveryFee = Number(
        data.delivery_fee ??
          estimatedDeliveryFee
      );

      const finalPlatformFee = Number(
        data.platform_fee ??
          platformFee
      );

      const finalCgst = Number(
        data.cgst ?? cgst
      );

      const finalSgst = Number(
        data.sgst ?? sgst
      );

      const finalGst = Number(
        data.gst ??
          finalCgst +
            finalSgst
      );

      const finalDiscount = Number(
        data.discount ?? discount
      );

      const finalTotal = Number(
        data.total ?? estimatedTotal
      );

      /*
       * Clear cart only after successful order.
       */

      clearCart();

      toast.success(
        "Order placed successfully!"
      );

      /*
      |--------------------------------------------------------------------------
      | Store WhatsApp message
      |--------------------------------------------------------------------------
      */

      const storeNumber = String(
        store.whatsapp || ""
      ).replace(/[^\d]/g, "");

      const itemsBlock = (
        data.items || items
      )
        .map((item) => {
          const variant =
            item.variant_label
              ? ` (${item.variant_label})`
              : item.unit
              ? ` (${item.unit})`
              : "";

          const note = item.note
            ? `\n  Note: ${item.note}`
            : "";

          const itemTotal =
            Number(item.price || 0) *
            Number(item.quantity || 0);

          return `- ${item.name}${variant} x ${
            item.quantity
          } @ ₹${item.price} = ₹${itemTotal.toFixed(
            2
          )}${note}`;
        })
        .join("\n");

      const orderId = data.id
        ? String(data.id)
            .slice(-6)
            .toUpperCase()
        : "NEW";

      const storeMessage =
        encodeURIComponent(
          `NEW ORDER #${orderId}

${itemsBlock}

Subtotal: ₹${finalSubtotal.toFixed(2)}
Discount: -₹${finalDiscount.toFixed(2)}
Platform Fee: ₹${finalPlatformFee.toFixed(2)}
Delivery: ₹${finalDeliveryFee.toFixed(2)}
CGST (2.5%): ₹${finalCgst.toFixed(2)}
SGST (2.5%): ₹${finalSgst.toFixed(2)}
GST (5%): ₹${finalGst.toFixed(2)}
Total: ₹${finalTotal.toFixed(2)}

Payment: ${
            data.payment_method ??
            payment
          }

Customer: ${
            data.address?.full_name ??
            form.full_name
          }
Phone: ${
            data.address?.phone ??
            form.phone
          }
Address: ${
            data.address?.line1 ??
            form.line1
          }${
            (
              data.address?.landmark ??
              form.landmark
            )
              ? `, ${
                  data.address?.landmark ??
                  form.landmark
                }`
              : ""
          }, ${
            data.address?.area ??
            form.area
          }, ${
            data.address?.pincode ??
            form.pincode
          }

Customer Location:
https://www.google.com/maps?q=${
            location.latitude
          },${location.longitude}`
        );

      if (storeNumber) {
        window.open(
          `https://wa.me/${storeNumber}?text=${storeMessage}`,
          "_blank"
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Customer WhatsApp notification
      |--------------------------------------------------------------------------
      */

      try {
        const {
          data: notification,
        } = await api.post(
          "/notify/order-whatsapp",
          {
            order_id: data.id,
            event: "placed",
          }
        );

        if (notification?.url) {
          setTimeout(() => {
            window.open(
              notification.url,
              "_blank"
            );
          }, 350);
        }
      } catch {
        // WhatsApp notification is non-blocking.
      }

      /*
      |--------------------------------------------------------------------------
      | Order page
      |--------------------------------------------------------------------------
      */

      navigate(
        `/orders/${data.id}`
      );
    } catch (error) {
      toast.error(
        formatApiError(error)
      );
    } finally {
      setSubmitting(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Apply coupon
  |--------------------------------------------------------------------------
  */

  const applyCoupon = async () => {
    const code =
      couponInput.trim().toUpperCase();

    if (!code) {
      toast.error(
        "Enter a coupon code."
      );
      return;
    }

    setCouponBusy(true);

    try {
      const { data } =
        await api.get(
          `/coupons/${encodeURIComponent(
            code
          )}/validate?subtotal=${subtotal}`
        );

      setCoupon(data);

      toast.success(
        `Coupon ${data.code} applied — saved ${formatINR(
          data.discount
        )}`
      );
    } catch (error) {
      setCoupon(null);

      toast.error(
        formatApiError(error)
      );
    } finally {
      setCouponBusy(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Remove coupon
  |--------------------------------------------------------------------------
  */

  const removeCoupon = () => {
    setCoupon(null);
    setCouponInput("");
  };

  /*
  |--------------------------------------------------------------------------
  | UPI QR
  |--------------------------------------------------------------------------
  */

  const upiUrl = `upi://pay?pa=${encodeURIComponent(
    store.upi_id || ""
  )}&pn=${encodeURIComponent(
    store.upi_name || ""
  )}&am=${estimatedTotal.toFixed(
    2
  )}&cu=INR&tn=${encodeURIComponent(
    "Ambajogai Grocery Order"
  )}`;

  const qrSrc =
    store.upi_qr ||
    `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
      upiUrl
    )}`;

  /*
  |--------------------------------------------------------------------------
  | UI
  |--------------------------------------------------------------------------
  */

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
        {/* =========================================================
            LEFT
        ========================================================= */}

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
                placeholder="6-digit pincode"
              />

              <div className="sm:col-span-2">
                <Field
                  label="Order notes (optional)"
                  value={form.notes}
                  onChange={update("notes")}
                  testid="order-notes"
                  placeholder="Any special instructions?"
                />
              </div>
            </div>

            {/* LOCATION */}

            <div className="mt-5 rounded-xl border border-[#8BA888]/30 bg-[#8BA888]/10 p-4">
              <div className="flex items-start gap-3">
                <Navigation className="mt-0.5 h-5 w-5 text-[#1B4332]" />

                <div className="flex-1">
                  <div className="font-semibold text-[#1B4332]">
                    Delivery location
                  </div>

                  <p className="mt-1 text-xs text-[#4A4A4A]">
                    Allow location access so we can calculate
                    your exact delivery charge.
                  </p>

                  {location.latitude !== null &&
                    location.longitude !== null && (
                      <div className="mt-2 text-xs font-medium text-[#1B4332]">
                        Location captured ✓
                      </div>
                    )}

                  {estimatedDistance !== null && (
                    <div className="mt-2 text-xs text-[#4A4A4A]">
                      Estimated distance:{" "}
                      <strong>
                        {estimatedDistance.toFixed(
                          2
                        )} km
                      </strong>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={getCurrentLocation}
                  disabled={locating}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-50"
                  data-testid="get-location-btn"
                >
                  {locating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Navigation className="h-3.5 w-3.5" />
                  )}

                  {locating
                    ? "Locating..."
                    : "Use my location"}
                </button>
              </div>
            </div>
          </section>

          {/* COUPON */}

          <section className="card-base p-6">
            <div className="mb-4 flex items-center gap-2">
              <Tag className="h-5 w-5 text-[#1B4332]" />

              <h2 className="font-heading text-lg font-semibold">
                Coupon
              </h2>
            </div>

            {!coupon ? (
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) =>
                    setCouponInput(
                      e.target.value.toUpperCase()
                    )
                  }
                  placeholder="Enter coupon code"
                  className="input-base flex-1"
                  data-testid="coupon-input"
                />

                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={couponBusy}
                  className="rounded-xl bg-[#1B4332] px-5 py-2 text-sm font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-50"
                  data-testid="apply-coupon"
                >
                  {couponBusy
                    ? "Checking..."
                    : "Apply"}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl bg-[#8BA888]/10 p-4">
                <div>
                  <div className="font-semibold text-[#1B4332]">
                    {coupon.code}
                  </div>

                  <div className="text-xs text-[#4A4A4A]">
                    You save{" "}
                    {formatINR(discount)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={removeCoupon}
                  className="grid h-8 w-8 place-items-center rounded-full hover:bg-white"
                  aria-label="Remove coupon"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </section>

          {/* PAYMENT */}

          <section className="card-base p-6">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#1B4332]" />

              <h2 className="font-heading text-lg font-semibold">
                Payment
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <PayOption
                selected={payment === "UPI"}
                onClick={() =>
                  setPayment("UPI")
                }
                title="UPI"
                sub="Google Pay, PhonePe, Paytm & other UPI apps"
                testid="payment-upi"
              />

              <PayOption
                selected={payment === "COD"}
                onClick={() =>
                  setPayment("COD")
                }
                title="Cash on Delivery"
                sub="Pay when your order arrives"
                testid="payment-cod"
              />
            </div>

            {/* UPI */}

            {payment === "UPI" && (
              <div className="mt-6 rounded-xl bg-[#8BA888]/10 p-5 text-center">
                <img
                  src={qrSrc}
                  alt="UPI QR"
                  className="mx-auto h-52 w-52 rounded-xl bg-white p-2"
                />

                <div className="mt-4 text-sm font-semibold text-[#1B4332]">
                  {store.upi_name}
                </div>

                <div className="mt-1 text-xs text-[#4A4A4A]">
                  {store.upi_id}
                </div>

                <div className="mt-3 text-xs text-[#4A4A4A]">
                  Pay{" "}
                  <span className="font-mono font-bold text-[#1B4332]">
                    {formatINR(
                      estimatedTotal
                    )}
                  </span>{" "}
                  using any UPI app.
                </div>

                <div className="mt-2 text-xs text-[#4A4A4A]">
                  After payment, place the order.
                  We&apos;ll confirm it via WhatsApp.
                </div>
              </div>
            )}

            {/* COD */}

            {payment === "COD" && (
              <div className="mt-6 flex items-start gap-2 rounded-xl bg-[#8BA888]/10 p-4 text-sm text-[#1B4332]">
                <Truck className="mt-0.5 h-4 w-4" />

                <span>
                  Please keep exact change ready.
                  Cash on Delivery is available
                  across Ambajogai.
                </span>
              </div>
            )}
          </section>
        </div>

        {/* =========================================================
            RIGHT SUMMARY
        ========================================================= */}

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
                key={`${item.product_id}-${item.variant_label || ""}-${item.note || ""}`}
                className="flex gap-3"
              >
                <img
                  src={item.image}
                  alt=""
                  className="h-12 w-12 rounded-lg object-cover"
                />

                <div className="flex-1 text-sm">
                  <div className="font-medium">
                    {item.name}
                  </div>

                  {item.variant_label && (
                    <div className="text-xs font-semibold text-[#1B4332]">
                      {item.variant_label}
                    </div>
                  )}

                  <div className="text-xs text-[#4A4A4A]">
                    Qty {item.quantity} ×{" "}
                    {formatINR(item.price)}
                  </div>
                </div>

                <div className="text-sm font-semibold">
                  {formatINR(
                    Number(item.price) *
                      Number(item.quantity)
                  )}
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

            {discount > 0 && (
              <Row
                label={`Coupon (${coupon.code})`}
                value={`- ${formatINR(
                  discount
                )}`}
              />
            )}

            <Row
              label="Platform fee"
              value={formatINR(
                platformFee
              )}
            />

            <Row
              label="Delivery"
              value={
                location.latitude === null
                  ? "Location required"
                  : formatINR(
                      estimatedDeliveryFee
                    )
              }
            />

            {estimatedDistance !== null && (
              <div className="rounded-lg bg-[#8BA888]/10 px-3 py-2 text-xs text-[#1B4332]">
                {estimatedDistance <= 1.5
                  ? `₹${DELIVERY_RATE_PER_KM}/km delivery`
                  : `₹${DELIVERY_RATE_ABOVE_1_5_KM}/km delivery`}
                {" · "}
                {estimatedDistance.toFixed(
                  2
                )} km
              </div>
            )}

            <Row
              label="CGST (2.5%)"
              value={formatINR(cgst)}
            />

            <Row
              label="SGST (2.5%)"
              value={formatINR(sgst)}
            />

            <Row
              label="GST (5%)"
              value={formatINR(gst)}
            />
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
              {formatINR(
                estimatedTotal
              )}
            </span>
          </div>

          {/* PLACE ORDER */}

          <button
            type="button"
            onClick={submit}
            disabled={
              submitting ||
              location.latitude === null ||
              location.longitude === null
            }
            className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="place-order-btn"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}

            {submitting
              ? "Placing order..."
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

/*
|--------------------------------------------------------------------------
| FIELD
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| ROW
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| PAYMENT OPTION
|--------------------------------------------------------------------------
*/

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