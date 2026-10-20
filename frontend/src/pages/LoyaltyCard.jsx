import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ShoppingCart,
  Gift,
  Instagram,
  Star,
  Leaf,
  Truck,
  ShieldCheck,
  CheckCircle2,
  Info,
  LoaderCircle,
} from "lucide-react";

const INSTAGRAM_URL =
  "https://www.instagram.com/ambajogaigrocery.store/";

const LoyaltyCard = () => {
  const [customerName, setCustomerName] = useState("");
  const [completedOrders, setCompletedOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const eligibleOrders = Math.min(
    10,
    Math.max(0, Number(completedOrders) || 0)
  );

  const rewardUnlocked = eligibleOrders >= 10;
  const progress = eligibleOrders * 10;

  useEffect(() => {
    let active = true;

    const loadLoyaltyData = async () => {
      try {
        setLoading(true);
        setError("");

        /*
         * Backend integration:
         * This endpoint must return the authenticated customer's
         * actual eligible completed-order count.
         *
         * Expected response:
         * {
         *   "customer_name": "Dinesh",
         *   "completed_orders": 3
         * }
         *
         * The backend endpoint will be implemented separately.
         */

        const response = await fetch("/api/loyalty/progress", {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(
            "Your loyalty progress is temporarily unavailable."
          );
        }

        const data = await response.json();

        if (!active) return;

        setCustomerName(data.customer_name || "");
        setCompletedOrders(
          Math.max(
            0,
            Math.floor(Number(data.completed_orders) || 0)
          )
        );
      } catch (err) {
        if (!active) return;

        setError(
          err.message ||
            "Unable to load your loyalty progress."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadLoyaltyData();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f9f4] text-[#123f2d]">
      {/* Header */}
      <header className="border-b border-green-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-3"
            aria-label="Ambajogai Grocery Store home"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-800 text-white">
              <ShoppingCart size={27} />
            </div>

            <div>
              <h1 className="text-lg font-extrabold leading-tight sm:text-xl">
                Ambajogai
              </h1>
              <p className="text-sm font-semibold text-green-700 sm:text-base">
                Grocery Store
              </p>
            </div>
          </Link>

          <div className="hidden text-sm font-medium text-gray-600 sm:block">
            Fresh <span className="mx-2 text-green-700">•</span>
            Local <span className="mx-2 text-green-700">•</span>
            For You
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        {/* Page heading */}
        <section className="mb-7">
          <Link
            to="/"
            className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-green-800"
          >
            <ArrowLeft size={18} />
            Back to Store
          </Link>

          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            Loyalty Card
          </h2>

          <p className="mt-2 text-lg text-green-800 sm:text-xl">
            Shop more. Get rewarded!
          </p>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
            Complete 10 qualifying orders and receive a free
            order worth up to ₹499. Thank you for being part
            of Ambajogai Grocery Store!
          </p>
        </section>

        {/* Customer progress */}
        <section className="mb-5 rounded-2xl border border-green-100 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium text-gray-500">
                YOUR PERSONAL LOYALTY CARD
              </p>

              <h3 className="mt-2 text-2xl font-bold sm:text-3xl">
                {customerName
                  ? `Hi, ${customerName}!`
                  : "Welcome Back!"}
              </h3>

              <p className="mt-1 text-gray-600">
                Every qualifying order brings you closer to a reward.
              </p>
            </div>

            <div className="min-w-[190px] rounded-xl bg-green-50 p-5 sm:min-w-[220px]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-600">
                    Orders Completed
                  </p>

                  <p className="mt-1 text-3xl font-extrabold text-green-800">
                    {loading ? "—" : `${eligibleOrders}/10`}
                  </p>
                </div>

                <ShoppingCart
                  size={30}
                  className="text-green-800"
                />
              </div>

              <div
                className="mt-4 h-2.5 overflow-hidden rounded-full bg-green-100"
                role="progressbar"
                aria-label="Loyalty progress"
                aria-valuemin={0}
                aria-valuemax={10}
                aria-valuenow={eligibleOrders}
              >
                <div
                  className="h-full rounded-full bg-green-700 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-xl border border-green-100 bg-[#f5f8ef] p-4">
            <Info
              size={22}
              className="mt-0.5 shrink-0 text-green-800"
            />

            <div>
              <p className="font-semibold">
                Only orders above ₹299 count towards your loyalty card.
              </p>

              <p className="mt-1 text-sm text-gray-600">
                Only completed and delivered qualifying orders count.
                Orders of exactly ₹299 do not qualify.
              </p>
            </div>
          </div>
        </section>

        {/* Stamp card */}
        <section className="mb-5 overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-green-900 to-green-800 p-5 text-white sm:p-7">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Gift size={34} />
                </div>

                <div>
                  <h3 className="text-xl font-bold sm:text-2xl">
                    Your Digital Stamp Card
                  </h3>

                  <p className="mt-1 text-sm text-green-50 sm:text-base">
                    Complete 10 orders above ₹299.
                  </p>
                </div>
              </div>

              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/40 px-4 py-2 text-sm font-semibold">
                <Gift size={19} />
                10 Orders = 1 Free Order
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-8">
            {loading ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-gray-500">
                <LoaderCircle
                  size={34}
                  className="animate-spin text-green-700"
                />

                <p>Loading your loyalty card...</p>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
                <Info
                  size={28}
                  className="mx-auto mb-2 text-amber-700"
                />

                <p className="font-semibold text-amber-900">
                  Your loyalty progress could not be loaded.
                </p>

                <p className="mt-2 text-sm text-amber-800">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-4 rounded-lg bg-green-800 px-5 py-2 text-sm font-semibold text-white hover:bg-green-900"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-5">
                {Array.from({ length: 10 }, (_, index) => {
                  const stampNumber = index + 1;
                  const completed = stampNumber <= eligibleOrders;

                  return (
                    <div
                      key={stampNumber}
                      className={`flex aspect-square min-h-[135px] flex-col items-center justify-center rounded-full border-2 p-3 text-center transition-all sm:min-h-[155px] ${
                        completed
                          ? "border-green-700 bg-gradient-to-br from-green-700 to-green-900 text-white shadow-md"
                          : "border-gray-300 bg-gray-50 text-gray-500"
                      }`}
                    >
                      <div className="mb-2 flex items-center gap-1">
                        <ShoppingCart size={25} />

                        {completed && (
                          <CheckCircle2
                            size={19}
                            className="text-white"
                          />
                        )}
                      </div>

                      <span className="text-2xl font-extrabold sm:text-3xl">
                        {stampNumber}
                      </span>

                      <span className="mt-1 text-xs font-medium sm:text-sm">
                        {completed ? "Completed" : "Upcoming"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && !error && (
              <p className="mt-6 text-center text-sm text-gray-500">
                {rewardUnlocked
                  ? "Congratulations! Your loyalty reward is unlocked."
                  : `${10 - eligibleOrders} more qualifying ${
                      10 - eligibleOrders === 1 ? "order" : "orders"
                    } to unlock your free-order reward.`}
              </p>
            )}
          </div>
        </section>

        {/* Large free-order reward banner */}
        <section className="relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-green-950 via-green-800 to-green-700 p-6 text-white shadow-md sm:p-10 lg:p-12">
          <div className="pointer-events-none absolute -right-12 -top-16 h-64 w-64 rounded-full bg-white/5" />

          <div className="pointer-events-none absolute -bottom-24 right-24 h-56 w-56 rounded-full bg-lime-300/10" />

          <div className="relative z-10 grid items-center gap-8 md:grid-cols-[1.3fr_0.7fr]">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-green-900">
                <Gift size={20} />
                YOUR LOYALTY REWARD
              </div>

              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-100 sm:text-base">
                A little thank-you for shopping with us
              </p>

              <h3 className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                1 FREE
                <br />
                ORDER
              </h3>

              <p className="mt-3 text-2xl font-bold text-lime-200 sm:text-3xl">
                Worth up to ₹499!
              </p>

              <p className="mt-4 max-w-xl text-sm leading-6 text-green-50 sm:text-base">
                Complete 10 qualifying orders above ₹299 to
                unlock one free order worth up to ₹499.
              </p>

              {!loading && !error && (
                <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold">
                  {rewardUnlocked ? (
                    <>
                      <CheckCircle2 size={20} />
                      Reward unlocked
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={20} />
                      {eligibleOrders} of 10 qualifying orders completed
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <div className="flex h-40 w-40 items-center justify-center rounded-full border border-white/20 bg-white/10 sm:h-52 sm:w-52">
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white/10 sm:h-44 sm:w-44">
                  <Gift
                    size={100}
                    strokeWidth={1.3}
                    className="text-lime-200 sm:h-32 sm:w-32"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Instagram and review cards */}
        <section className="mb-5 grid gap-5 md:grid-cols-2">
          <div className="flex flex-col justify-between rounded-2xl border border-green-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 text-white">
                <Instagram size={28} />
              </div>

              <div>
                <h3 className="text-lg font-bold">
                  Follow Us on Instagram
                </h3>

                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Stay updated with our latest offers, fresh arrivals
                  and store updates.
                </p>
              </div>
            </div>

            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-green-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-900"
            >
              <Instagram size={19} />
              Follow @ambajogaigrocery.store
            </a>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-green-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <Star size={28} />
              </div>

              <div>
                <h3 className="text-lg font-bold">
                  Give Us a Review
                </h3>

                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Your feedback helps us improve our products
                  and delivery service.
                </p>
              </div>
            </div>

            <Link
              to="/"
              onClick={() => {
                sessionStorage.setItem(
                  "openStoreReview",
                  "true"
                );
              }}
              className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-green-800 px-4 py-3 text-sm font-semibold text-green-900 transition hover:bg-green-50"
            >
              <Star size={19} />
              Write a Review
            </Link>
          </div>
        </section>

        {/* Store benefits */}
        <section className="grid grid-cols-1 gap-4 rounded-2xl border border-green-100 bg-white p-5 sm:grid-cols-3 sm:p-6">
          <div className="flex items-center gap-3">
            <Leaf
              size={28}
              className="shrink-0 text-green-800"
            />

            <div>
              <p className="font-semibold">Fresh Products</p>
              <p className="text-sm text-gray-500">
                Quality groceries
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 border-green-100 sm:border-x sm:px-5">
            <Truck
              size={28}
              className="shrink-0 text-green-800"
            />

            <div>
              <p className="font-semibold">Fast Delivery</p>
              <p className="text-sm text-gray-500">
                In Ambajogai
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:justify-end">
            <ShieldCheck
              size={28}
              className="shrink-0 text-green-800"
            />

            <div>
              <p className="font-semibold">Safe & Secure</p>
              <p className="text-sm text-gray-500">
                Shopping experience
              </p>
            </div>
          </div>
        </section>

        <footer className="py-6 text-center text-sm text-gray-500">
          Thank you for supporting Ambajogai Grocery Store. 💚
        </footer>
      </main>
    </div>
  );
};

export default LoyaltyCard;