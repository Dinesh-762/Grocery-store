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
| Pricing Configuration
|--------------------------------------------------------------------------
*/

const MINIMUM_ORDER_VALUE = 100;
const FREE_ORDER_LIMIT = 249;
const FREE_ORDER_REQUIRED_ORDERS = 13;

const PLATFORM_FEE = 10;

const CGST_RATE = 0.025;
const SGST_RATE = 0.025;
const GST_RATE = 0.05;

const DELIVERY_RATE_PER_KM = 13;
const DELIVERY_RATE_ABOVE_1_5_KM = 20;

/*
|--------------------------------------------------------------------------
| EXACT AMBAJOGAI STORE LOCATION
|--------------------------------------------------------------------------
|
| Latitude  : 18.7271336
| Longitude : 76.3810922
|
*/

const STORE_LATITUDE = 18.7271336;
const STORE_LONGITUDE = 76.3810922;
const MAX_DELIVERY_DISTANCE_KM = 12;
const GROCERY_COUPON_CODE = "GROCERY10";
const SAVED_ADDRESS_KEY = "ambajogai_saved_address";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function calculateDistanceKm(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const earthRadiusKm = 6371;

  const latitude1 = Number(lat1);
  const longitude1 = Number(lon1);
  const latitude2 = Number(lat2);
  const longitude2 = Number(lon2);

  if (
    !Number.isFinite(latitude1) ||
    !Number.isFinite(longitude1) ||
    !Number.isFinite(latitude2) ||
    !Number.isFinite(longitude2)
  ) {
    return 0;
  }

  const dLat =
    ((latitude2 - latitude1) * Math.PI) /
    180;

  const dLon =
    ((longitude2 - longitude1) * Math.PI) /
    180;

  const lat1Rad =
    (latitude1 * Math.PI) /
    180;

  const lat2Rad =
    (latitude2 * Math.PI) /
    180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) ** 2;

  const safeA = Math.min(
    1,
    Math.max(0, a)
  );

  const c =
    2 *
    Math.atan2(
      Math.sqrt(safeA),
      Math.sqrt(1 - safeA)
    );

  return Math.round(
    earthRadiusKm * c * 100
  ) / 100;
}

/*
|--------------------------------------------------------------------------
| Delivery fee
|--------------------------------------------------------------------------
*/

function calculateDeliveryFee(
  distanceKm,
  subtotal = 0
) {
  if (
    !Number.isFinite(distanceKm) ||
    distanceKm <= 0
  ) {
    return 0;
  }

  /*
   * Orders >= ₹499 get free delivery.
   *
   * Backend remains authoritative.
   */

  if (
    Number(subtotal) >= 499
  ) {
    return 0;
  }

  if (
    distanceKm <= 1.5
  ) {
    return (
      Math.round(
        distanceKm *
          DELIVERY_RATE_PER_KM *
          100
      ) / 100
    );
  }

  return (
    Math.round(
      distanceKm *
        DELIVERY_RATE_ABOVE_1_5_KM *
        100
    ) / 100
  );
}

export default function Checkout() {
  const {
    items,
    subtotal,
    clearCart,
  } = useCart();

  const { user } = useAuth();
  const navigate = useNavigate();

  /*
  |--------------------------------------------------------------------------
  | Store information
  |--------------------------------------------------------------------------
  */

  const [store, setStore] = useState({
    upi_id: "ambajogai@upi",
    upi_name:
      "Ambajogai Grocery Store",
    whatsapp: "+918237214975",
    upi_qr: "/assets/upi-qr.jpeg",
  });

  /*
  |--------------------------------------------------------------------------
  | Payment
  |--------------------------------------------------------------------------
  */

  const [payment, setPayment] =
    useState("UPI");

  const [submitting, setSubmitting] =
    useState(false);

  const [placed, setPlaced] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | Coupon
  |--------------------------------------------------------------------------
  */

  const [couponInput, setCouponInput] =
    useState("");

  const [coupon, setCoupon] =
    useState(null);

  const [couponBusy, setCouponBusy] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | Delivery form
  |--------------------------------------------------------------------------
  */

  const [form, setForm] = useState({
    full_name:
      user?.name || "",
    phone:
      user?.phone || "",
    line1: "",
    landmark: "",
    area: "",
    pincode: "",
    notes: "",
  });

  const [addressSaved, setAddressSaved] = useState(false);
  const [serviceable, setServiceable] = useState(null);
  const [serviceabilityMessage, setServiceabilityMessage] = useState("");

  /*
  |--------------------------------------------------------------------------
  | GPS
  |--------------------------------------------------------------------------
  */

  const [location, setLocation] =
    useState({
      latitude: null,
      longitude: null,
      accuracy: null,
    });

  const [locating, setLocating] =
    useState(false);

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

  // Load the saved address for this account. It stays in place until the
  // customer explicitly chooses Change Address. A local fallback supports
  // older accounts that were saved before the backend endpoint existed.
  useEffect(() => {
    if (!user?.id) return;
    const localKey = `${SAVED_ADDRESS_KEY}_${user.id}`;
    let active = true;

    const applySaved = (saved) => {
      if (!active || !saved) return false;
      const address = saved.form || saved;
      setForm((current) => ({
        ...current,
        ...address,
        full_name: address.full_name || user.name || current.full_name,
        phone: address.phone || user.phone || current.phone,
      }));
      if (Number.isFinite(Number(address.latitude)) && Number.isFinite(Number(address.longitude))) {
        setLocation({
          latitude: Number(address.latitude),
          longitude: Number(address.longitude),
          accuracy: address.accuracy == null ? null : Number(address.accuracy),
        });
      }
      setAddressSaved(true);
      return true;
    };

    api.get("/auth/saved-address")
      .then(({ data }) => {
        if (!applySaved(data?.saved_address)) {
          try {
            const raw = localStorage.getItem(localKey);
            if (raw) applySaved(JSON.parse(raw));
          } catch {}
        }
      })
      .catch(() => {
        try {
          const raw = localStorage.getItem(localKey);
          if (raw) applySaved(JSON.parse(raw));
        } catch {}
      });

    return () => { active = false; };
  }, [user?.id, user?.name, user?.phone]);

  /*
  |--------------------------------------------------------------------------
  | Redirect when cart is empty
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      items.length === 0 &&
      !submitting &&
      !placed
    ) {
      navigate("/cart");
    }
  }, [
    items.length,
    submitting,
    placed,
    navigate,
  ]);

  /*
  |--------------------------------------------------------------------------
  | Update form
  |--------------------------------------------------------------------------
  */

  const update = (key) => (event) => {
    setForm((current) => ({
      ...current,
      [key]:
        event.target.value,
    }));
  };

  const saveAddress = async () => {
    if (!user?.id) {
      toast.error("Please log in before saving your address.");
      return;
    }
    const required = ["full_name", "phone", "line1", "area", "pincode"];
    const missing = required.find((key) => !String(form[key] || "").trim());
    if (missing) {
      toast.error(`Please fill your ${missing.replace("_", " ")}.`);
      return;
    }
    if (!/^\+?\d{10,15}$/.test(String(form.phone).replace(/\s/g, ""))) {
      toast.error("Enter a valid mobile number.");
      return;
    }
    if (!/^\d{6}$/.test(form.pincode)) {
      toast.error("Enter a valid 6-digit pincode.");
      return;
    }
    if (location.latitude === null || location.longitude === null) {
      toast.error("Please verify your delivery location before saving the address.");
      return;
    }

    const saved = {
      ...form,
      email: user.email || "",
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      accuracy: location.accuracy,
    };
    try {
      await api.put("/auth/saved-address", saved);
      localStorage.setItem(`${SAVED_ADDRESS_KEY}_${user.id}`, JSON.stringify(saved));
      setAddressSaved(true);
      toast.success("Address saved. It will stay saved until you change it.");
    } catch (error) {
      toast.error(formatApiError(error, "Could not save your address."));
    }
  };

  const changeAddress = async () => {
    if (user?.id) {
      try { await api.delete("/auth/saved-address"); } catch {}
      try { localStorage.removeItem(`${SAVED_ADDRESS_KEY}_${user.id}`); } catch {}
    }
    setAddressSaved(false);
    setServiceable(null);
    setServiceabilityMessage("");
    setLocation({ latitude: null, longitude: null, accuracy: null });
    toast.success("You can now enter a new delivery address.");
  };

  /*
  |--------------------------------------------------------------------------
  | GET CURRENT LOCATION
  |--------------------------------------------------------------------------
  */

  const getCurrentLocation = () => {
    if (
      !navigator.geolocation
    ) {
      toast.error(
        "Location is not supported by your browser."
      );
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude =
          Number(
            position.coords.latitude
          );

        const longitude =
          Number(
            position.coords.longitude
          );

        const accuracy =
          Number(
            position.coords.accuracy || 0
          );

        console.log(
          "CUSTOMER GPS:",
          {
            latitude,
            longitude,
            accuracy,
          }
        );

        if (
          !Number.isFinite(
            latitude
          ) ||
          !Number.isFinite(
            longitude
          )
        ) {
          setLocating(false);

          toast.error(
            "Invalid location received. Please try again."
          );

          return;
        }

        if (
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          setLocating(false);

          toast.error(
            "Invalid GPS coordinates received."
          );

          return;
        }

        setLocation({
          latitude,
          longitude,
          accuracy,
        });

        toast.success(
          "Location captured successfully!"
        );

        setLocating(false);
      },

      (error) => {
        setLocating(false);

        console.error(
          "GPS ERROR:",
          error
        );

        if (
          error.code ===
          error.PERMISSION_DENIED
        ) {
          toast.error(
            "Please allow location access."
          );
        } else if (
          error.code ===
          error.POSITION_UNAVAILABLE
        ) {
          toast.error(
            "Unable to detect your location."
          );
        } else if (
          error.code ===
          error.TIMEOUT
        ) {
          toast.error(
            "Location request timed out. Please try again."
          );
        } else {
          toast.error(
            "Unable to get your location."
          );
        }
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  /*
  |--------------------------------------------------------------------------
  | Estimated distance
  |--------------------------------------------------------------------------
  */

  const estimatedDistance =
    useMemo(() => {
      if (
        location.latitude === null ||
        location.longitude === null
      ) {
        return null;
      }

      return calculateDistanceKm(
        STORE_LATITUDE,
        STORE_LONGITUDE,
        location.latitude,
        location.longitude
      );
    }, [location]);

  useEffect(() => {
    if (location.latitude === null || location.longitude === null) {
      setServiceable(null);
      setServiceabilityMessage("");
      return;
    }

    let active = true;
    api.get("/delivery/serviceability", {
      params: { latitude: location.latitude, longitude: location.longitude },
    }).then(({ data }) => {
      if (!active) return;
      setServiceable(Boolean(data?.serviceable));
      setServiceabilityMessage(data?.message || "");
    }).catch(() => {
      // Fallback to the same Haversine calculation locally. The backend order
      // endpoint remains the final source of truth. This prevents a temporary
      // serviceability API/network issue from incorrectly rejecting Ambajogai.
      const localServiceable = Number(estimatedDistance) <= MAX_DELIVERY_DISTANCE_KM;
      if (!active) return;
      setServiceable(localServiceable);
      setServiceabilityMessage(
        localServiceable
          ? "Delivery is available in Ambajogai."
          : "Please use a delivery location within Ambajogai."
      );
    });

    return () => { active = false; };
  }, [location.latitude, location.longitude, estimatedDistance]);

  /*
  |--------------------------------------------------------------------------
  | Coupon discount
  |--------------------------------------------------------------------------
  */

  const discount = Number(
    coupon?.discount || 0
  );

  /*
  |--------------------------------------------------------------------------
  | Discounted subtotal
  |--------------------------------------------------------------------------
  */

  const discountedSubtotal =
    Math.max(
      0,
      Number(subtotal || 0) -
        discount
    );

  /*
  |--------------------------------------------------------------------------
  | Estimated delivery fee
  |--------------------------------------------------------------------------
  */

  const estimatedDeliveryFee =
    useMemo(() => {
      if (
        estimatedDistance === null
      ) {
        return 0;
      }

      return calculateDeliveryFee(
        estimatedDistance,
        Number(
          subtotal || 0
        ) -
          Number(
            coupon?.discount || 0
          )
      );
    }, [
      estimatedDistance,
      subtotal,
      coupon,
    ]);

  /*
  |--------------------------------------------------------------------------
  | Platform fee
  |--------------------------------------------------------------------------
  */

  const platformFee =
    discountedSubtotal > 0
      ? PLATFORM_FEE
      : 0;

  /*
  |--------------------------------------------------------------------------
  | Taxable amount
  |--------------------------------------------------------------------------
  */

  const taxableAmount =
    discountedSubtotal +
    platformFee +
    Number(
      estimatedDeliveryFee || 0
    );

  /*
  |--------------------------------------------------------------------------
  | CGST
  |--------------------------------------------------------------------------
  */

  const cgst =
    Math.round(
      taxableAmount *
        CGST_RATE *
        100
    ) / 100;

  /*
  |--------------------------------------------------------------------------
  | SGST
  |--------------------------------------------------------------------------
  */

  const sgst =
    Math.round(
      taxableAmount *
        SGST_RATE *
        100
    ) / 100;

  /*
  |--------------------------------------------------------------------------
  | Total GST
  |--------------------------------------------------------------------------
  */

  const gst =
    Math.round(
      (cgst + sgst) * 100
    ) / 100;

  /*
  |--------------------------------------------------------------------------
  | Final estimated total
  |--------------------------------------------------------------------------
  */

  const estimatedTotal =
    Math.round(
      (
        discountedSubtotal +
        platformFee +
        Number(
          estimatedDeliveryFee || 0
        ) +
        gst
      ) * 100
    ) / 100;

  /*
  |--------------------------------------------------------------------------
  | Validate form
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

    for (
      const key of requiredFields
    ) {
      if (
        !String(
          form[key] || ""
        ).trim()
      ) {
        return `Please fill your ${key.replace(
          "_",
          " "
        )}`;
      }
    }

    const cleanPhone =
      form.phone.replace(
        /\s/g,
        ""
      );

    if (
      !/^\+?\d{10,15}$/.test(
        cleanPhone
      )
    ) {
      return "Enter a valid phone number";
    }

    /*
     * -------------------------------------------------------
     * MINIMUM ORDER VALUE
     * -------------------------------------------------------
     *
     * Customer must have at least ₹100
     * worth of products in cart.
     */

    if (
      Number(subtotal || 0) <
      MINIMUM_ORDER_VALUE
    ) {
      return `Minimum order value is ₹${MINIMUM_ORDER_VALUE}. Please add more items to your cart.`;
    }

    if (
      !/^\d{6}$/.test(
        form.pincode
      )
    ) {
      return "Enter a valid 6-digit pincode";
    }

    if (
      location.latitude === null ||
      location.longitude === null
    ) {
      return "Please allow location access so delivery charges can be calculated.";
    }

    if (serviceable === false || (serviceable === null && Number(estimatedDistance) > MAX_DELIVERY_DISTANCE_KM)) {
      return "Please use a delivery location within Ambajogai.";
    }

    if (
      items.length === 0
    ) {
      return "Your cart is empty.";
    }

    return null;
  };

  /*
  |--------------------------------------------------------------------------
  | Place order
  |--------------------------------------------------------------------------
  */

  const submit = async () => {
    const error =
      validate();

    if (error) {
      toast.error(error);
      return;
    }

    setSubmitting(true);

    try {
      const orderPayload = {
        items: items.map(
          (item) => ({
            product_id:
              item.product_id,

            name: item.name,

            price: Number(
              item.price || 0
            ),

            quantity: Number(
              item.quantity || 1
            ),

            image: item.image,

            unit:
              item.unit || null,

            variant_label:
              item.variant_label ||
              null,

            note: null,

            vendor_id:
              item.vendor_id ||
              null,

            vendor_name:
              item.vendor_name ||
              null,
          })
        ),

        address: {
          full_name:
            form.full_name,

          phone:
            form.phone,

          line1:
            form.line1,

          landmark:
            form.landmark,

          area:
            form.area,

          city:
            "Ambajogai",

          pincode:
            form.pincode,

          latitude:
            Number(
              location.latitude
            ),

          longitude:
            Number(
              location.longitude
            ),
        },

        latitude:
          Number(
            location.latitude
          ),

        longitude:
          Number(
            location.longitude
          ),

        payment_method:
          payment,

        notes:
          form.notes,

        coupon_code:
          coupon?.code || null,
      };

      /*
       * Send order.
       */

      const { data } =
        await api.post(
          "/orders",
          orderPayload
        );

      setPlaced(true);

      /*
       * Backend is authoritative.
       */

      const finalSubtotal =
        Number(
          data.subtotal ??
            subtotal
        );

      const finalDeliveryFee =
        Number(
          data.delivery_fee ??
            estimatedDeliveryFee
        );

      const finalPlatformFee =
        Number(
          data.platform_fee ??
            platformFee
        );

      const finalCgst =
        Number(
          data.cgst ?? cgst
        );

      const finalSgst =
        Number(
          data.sgst ?? sgst
        );

      const finalGst =
        Number(
          data.gst ??
            finalCgst +
              finalSgst
        );

      const finalDiscount =
        Number(
          data.discount ??
            discount
        );

      const finalTotal =
        Number(
          data.total ??
            estimatedTotal
        );

      /*
       * Clear cart after successful order.
       */

      clearCart();

      toast.success(
        "Order placed successfully!"
      );

      /*
       * WhatsApp store notification.
       */

      const storeNumber =
        String(
          store.whatsapp || ""
        ).replace(
          /[^\d]/g,
          ""
        );

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

          const itemTotal =
            Number(
              item.price || 0
            ) *
            Number(
              item.quantity || 0
            );

          return `- ${
            item.name
          }${variant} x ${
            item.quantity
          } @ ₹${Number(
            item.price || 0
          ).toFixed(
            2
          )} = ₹${itemTotal.toFixed(
            2
          )}`;
        })
        .join("\n");

      const orderId =
        data.id
          ? String(data.id)
              .slice(-6)
              .toUpperCase()
          : "NEW";

      const storeMessage =
        encodeURIComponent(
          `NEW ORDER #${orderId}

${itemsBlock}

Subtotal: ₹${finalSubtotal.toFixed(
            2
          )}
Discount: -₹${finalDiscount.toFixed(
            2
          )}
Platform Fee: ₹${finalPlatformFee.toFixed(
            2
          )}
Delivery: ₹${finalDeliveryFee.toFixed(
            2
          )}
CGST (2.5%): ₹${finalCgst.toFixed(
            2
          )}
SGST (2.5%): ₹${finalSgst.toFixed(
            2
          )}
GST (5% Total): ₹${finalGst.toFixed(
            2
          )}
Total: ₹${finalTotal.toFixed(
            2
          )}

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
              data.address
                ?.landmark ??
              form.landmark
            )
              ? `, ${
                  data.address
                    ?.landmark ??
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
          },${
            location.longitude
          }

Distance from Ambajogai Grocery:
${
  data.delivery_distance_km ??
  estimatedDistance ??
  0
} km`
        );

      if (storeNumber) {
        window.open(
          `https://wa.me/${storeNumber}?text=${storeMessage}`,
          "_blank"
        );
      }

      /*
       * Customer WhatsApp notification.
       */

      try {
        const {
          data: notification,
        } = await api.post(
          "/notify/order-whatsapp",
          {
            order_id:
              data.id,
            event:
              "placed",
          }
        );

        if (
          notification?.url
        ) {
          setTimeout(() => {
            window.open(
              notification.url,
              "_blank"
            );
          }, 350);
        }
      } catch {
        /*
         * Non-blocking.
         */
      }

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
    const code = couponInput.trim().toUpperCase();
    if (code !== GROCERY_COUPON_CODE) {
      toast.error(`Use ${GROCERY_COUPON_CODE} to apply the 10% OFF offer.`);
      return;
    }

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
  | UPI
  |--------------------------------------------------------------------------
  */

  const upiUrl =
    `upi://pay?pa=${encodeURIComponent(
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
                value={
                  form.full_name
                }
                onChange={update(
                  "full_name"
                )}
                testid="addr-name"
                  disabled={addressSaved}
              />

              <Field
                label="Phone"
                value={
                  form.phone
                }
                onChange={update(
                  "phone"
                )}
                testid="addr-phone"
                  disabled={addressSaved}
                placeholder="+91..."
              />

              <div className="sm:col-span-2">
                <Field
                  label="Address line"
                  value={
                    form.line1
                  }
                  onChange={update(
                    "line1"
                  )}
                  testid="addr-line"
                  disabled={addressSaved}
                  placeholder="House / flat no, street"
                />
              </div>

              <Field
                label="Landmark (optional)"
                value={
                  form.landmark
                }
                onChange={update(
                  "landmark"
                )}
                testid="addr-landmark"
                  disabled={addressSaved}
              />

              <Field
                label="Area / Locality"
                value={
                  form.area
                }
                onChange={update(
                  "area"
                )}
                testid="addr-area"
                  disabled={addressSaved}
              />

              <Field
                label="Pincode"
                value={
                  form.pincode
                }
                onChange={update(
                  "pincode"
                )}
                testid="addr-pincode"
                  disabled={addressSaved}
                placeholder="6-digit pincode"
              />

              <div className="sm:col-span-2">
                <Field
                  label="Order notes (optional)"
                  value={
                    form.notes
                  }
                  onChange={update(
                    "notes"
                  )}
                  testid="order-notes"
                  placeholder="Any special instructions?"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {!addressSaved ? (
                <button type="button" onClick={saveAddress} className="btn-primary flex-1" data-testid="save-address">
                  Save Address
                </button>
              ) : (
                <button type="button" onClick={changeAddress} className="btn-secondary flex-1" data-testid="change-address">
                  Change Address
                </button>
              )}
            </div>
            {addressSaved && (
              <p className="mt-2 text-xs text-[#1B4332]">✓ Address saved for this account. It will remain saved until you change it.</p>
            )}

            {/* LOCATION */}

            <div className="mt-5 rounded-xl border border-[#8BA888]/30 bg-[#8BA888]/10 p-4">
              <div className="flex items-start gap-3">

                <Navigation className="mt-0.5 h-5 w-5 text-[#1B4332]" />

                <div className="flex-1">

                  <div className="font-semibold text-[#1B4332]">
                    Delivery location
                  </div>

                  <p className="mt-1 text-xs text-[#4A4A4A]">
                    Allow location access so we can calculate your exact delivery charge.
                  </p>

                  {location.latitude !==
                    null &&
                    location.longitude !==
                      null && (
                      <div className="mt-2 text-xs font-medium text-[#1B4332]">
                        Location captured ✓
                      </div>
                    )}

                  {estimatedDistance !==
                    null && (
                    <>
                      <div className="mt-2 text-xs text-[#4A4A4A]">
                        Estimated distance:{" "}
                        <strong>
                          {estimatedDistance.toFixed(
                            2
                          )}{" "}
                          km
                        </strong>
                      </div>

                      {location.accuracy !==
                        null && (
                        <div className="mt-1 text-xs text-[#4A4A4A]">
                          GPS accuracy:{" "}
                          {Math.round(
                            location.accuracy
                          )}{" "}
                          m
                        </div>
                      )}
                    </>
                  )}

                  {serviceable !== null && (
                    <div className={`mt-2 text-xs font-semibold ${serviceable ? "text-[#1B4332]" : "text-red-600"}`}>
                      {serviceable ? "✓ " : "⚠ "}{serviceabilityMessage}
                    </div>
                  )}

                </div>

                <button
                  type="button"
                  onClick={
                    getCurrentLocation
                  }
                  disabled={
                    locating
                  }
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
                  value={
                    couponInput
                  }
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
                  onClick={
                    applyCoupon
                  }
                  disabled={
                    couponBusy
                  }
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
                    {
                      coupon.code
                    }
                  </div>

                  <div className="text-xs text-[#4A4A4A]">
                    You save{" "}
                    {formatINR(
                      discount
                    )}
                  </div>

                </div>

                <button
                  type="button"
                  onClick={
                    removeCoupon
                  }
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
                selected={
                  payment === "UPI"
                }
                onClick={() =>
                  setPayment(
                    "UPI"
                  )
                }
                title="UPI"
                sub="Google Pay, PhonePe, Paytm & other UPI apps"
                testid="payment-upi"
              />

              <PayOption
                selected={
                  payment === "COD"
                }
                onClick={() =>
                  setPayment(
                    "COD"
                  )
                }
                title="Cash on Delivery"
                sub="Pay when your order arrives"
                testid="payment-cod"
              />

            </div>

            {payment ===
              "UPI" && (
              <div className="mt-6 rounded-xl bg-[#8BA888]/10 p-5 text-center">

                <img
                  src={qrSrc}
                  alt="UPI QR"
                  className="mx-auto h-52 w-52 rounded-xl bg-white p-2"
                />

                <div className="mt-4 text-sm font-semibold text-[#1B4332]">
                  {
                    store.upi_name
                  }
                </div>

                <div className="mt-1 text-xs text-[#4A4A4A]">
                  {
                    store.upi_id
                  }
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
                  After payment, place the order. We&apos;ll confirm it via WhatsApp.
                </div>

              </div>
            )}

            {payment ===
              "COD" && (
              <div className="mt-6 flex items-start gap-2 rounded-xl bg-[#8BA888]/10 p-4 text-sm text-[#1B4332]">

                <Truck className="mt-0.5 h-4 w-4" />

                <span>
                  Please keep exact change ready. Cash on Delivery is available across Ambajogai.
                </span>

              </div>
            )}

          </section>
        </div>

        {/* RIGHT */}

        <aside
          className="card-base sticky top-24 h-fit p-6"
          data-testid="checkout-summary"
        >

          <h2 className="font-heading text-lg font-semibold">
            Order summary
          </h2>

          <div className="mt-4 max-h-64 space-y-3 overflow-auto pr-1">

            {items.map(
              (item) => (
                <div
                  key={`${item.product_id}-${item.variant_label || ""}`}
                  className="flex gap-3"
                >

                  <img
                    src={
                      item.image
                    }
                    alt=""
                    className="h-12 w-12 rounded-lg object-cover"
                  />

                  <div className="flex-1 text-sm">

                    <div className="font-medium">
                      {
                        item.name
                      }
                    </div>

                    {item.variant_label && (
                      <div className="mt-0.5 text-xs font-bold text-[#1B4332]">
                        Weight:{" "}
                        {
                          item.variant_label
                        }
                      </div>
                    )}

                    <div className="mt-0.5 text-xs text-[#4A4A4A]">
                      Qty{" "}
                      {
                        item.quantity
                      }{" "}
                      ×{" "}
                      {formatINR(
                        Number(
                          item.price ||
                            0
                        )
                      )}
                    </div>

                  </div>

                  <div className="text-sm font-semibold">
                    {formatINR(
                      Number(
                        item.price ||
                          0
                      ) *
                        Number(
                          item.quantity ||
                            0
                        )
                    )}
                  </div>

                </div>
              )
            )}

          </div>

          <div className="mt-4 space-y-2 border-t border-dashed pt-4 text-sm">

            <Row
              label="Subtotal"
              value={formatINR(
                subtotal
              )}
            />

            {discount >
              0 && (
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
                location.latitude ===
                    null ||
                location.longitude ===
                    null
                  ? "Location required"
                  : formatINR(
                      estimatedDeliveryFee
                    )
              }
            />

            {estimatedDistance !==
              null && (
              <div className="rounded-lg bg-[#8BA888]/10 px-3 py-2 text-xs text-[#1B4332]">

                {Number(
                  discountedSubtotal
                ) >= 499
                  ? "FREE delivery"
                  : estimatedDistance <=
                    1.5
                  ? `₹${DELIVERY_RATE_PER_KM}/km delivery`
                  : `₹${DELIVERY_RATE_ABOVE_1_5_KM}/km delivery`}

                {" · "}

                {estimatedDistance.toFixed(
                  2
                )}{" "}
                km

              </div>
            )}

            <Row
              label="CGST (2.5%)"
              value={formatINR(
                cgst
              )}
            />

            <Row
              label="SGST (2.5%)"
              value={formatINR(
                sgst
              )}
            />

            <Row
              label="GST (5% total)"
              value={formatINR(
                gst
              )}
            />

          </div>

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

          {/* MINIMUM ORDER MESSAGE */}

          {Number(subtotal || 0) <
            MINIMUM_ORDER_VALUE && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">
              Minimum order value is{" "}
              <strong>
                ₹{MINIMUM_ORDER_VALUE}
              </strong>
              . Please add{" "}
              <strong>
                ₹
                {(
                  MINIMUM_ORDER_VALUE -
                  Number(
                    subtotal || 0
                  )
                ).toFixed(2)}
              </strong>{" "}
              more to place your order.
            </div>
          )}

          <button
            type="button"
            onClick={
              submit
            }
            disabled={
              submitting ||
              location.latitude ===
                null ||
              location.longitude ===
                null ||
              Number(subtotal || 0) <
                MINIMUM_ORDER_VALUE
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
              : Number(
                  subtotal || 0
                ) <
                MINIMUM_ORDER_VALUE
              ? `Minimum ₹${MINIMUM_ORDER_VALUE} required`
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
  disabled = false,
}) {
  return (
    <div>

      <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
        {label}
      </label>

      <input
        value={value}
        onChange={onChange}
        placeholder={
          placeholder
        }
        className={`input-base ${disabled ? "bg-gray-100 text-gray-500" : ""}`}
        disabled={disabled}
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

function Row({
  label,
  value,
}) {
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