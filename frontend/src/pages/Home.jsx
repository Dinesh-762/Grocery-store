
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search, Truck, ShieldCheck, Clock, Star, ArrowRight,
  Sparkles, Store, ChevronLeft, ChevronRight, Tag,
  Leaf, MapPin
} from "lucide-react";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import Footer from "@/components/Footer";

const firstOrderOffers = [
  {
    id: "first-order-10",
    eyebrow: "WELCOME OFFER",
    title: "10% OFF your first order",
    subtitle:
      "Your first grocery order just got better. Enjoy 10% OFF and save on your everyday essentials.",
    detail: "FIRST ORDER ONLY",
    image:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1800&q=85",
  },
  {
    id: "mrp-first-order-5",
    eyebrow: "MRP SAVINGS",
    title: "5% OFF on MRP Products",
    subtitle:
      "Enjoy 5% OFF on eligible MRP products on your first order.",
    detail: "MRP PRODUCTS ONLY · FIRST ORDER ONLY",
    image:
      "https://images.unsplash.com/photo-1543168256-418811576931?auto=format&fit=crop&w=1800&q=85",
  },
];

export default function Home() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [offers, setOffers] = useState([]);
  const [activeOffer, setActiveOffer] = useState(0);

  const displayOffers = useMemo(() => [
    ...firstOrderOffers,
    ...offers.map((offer, index) => ({
      id: offer.id || `store-offer-${index}`,
      eyebrow: "SPECIAL OFFER",
      title: offer.title,
      subtitle: offer.subtitle,
      detail: "STORE OFFER",
      image:
        "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1800&q=85",
    })),
  ], [offers]);

  useEffect(() => {
    if (displayOffers.length <= 1) {
      setActiveOffer(0);
      return;
    }

    const timer = setInterval(() => {
      setActiveOffer(current =>
        (current + 1) % displayOffers.length
      );
    }, 4500);

    return () => clearInterval(timer);
  }, [displayOffers.length]);

  useEffect(() => {
    if (activeOffer >= displayOffers.length) {
      setActiveOffer(0);
    }
  }, [activeOffer, displayOffers.length]);

  useEffect(() => {
    let mounted = true;

    async function loadHome() {
      try {
        const [cRes, fRes, rRes, oRes, vRes] =
          await Promise.all([
            api.get("/categories"),
            api.get("/products?featured=true&limit=8"),
            api.get("/reviews?limit=6"),
            api.get("/offers"),
            api.get("/vendors"),
          ]);

        if (!mounted) return;

        setCategories(Array.isArray(cRes.data) ? cRes.data : []);
        setFeatured(Array.isArray(fRes.data) ? fRes.data : []);
        setReviews(Array.isArray(rRes.data) ? rRes.data : []);
        setOffers(Array.isArray(oRes.data) ? oRes.data : []);
        setVendors(Array.isArray(vRes.data) ? vRes.data : []);
      } catch {
        // Homepage remains usable if an optional API fails.
      }
    }

    loadHome();

    return () => {
      mounted = false;
    };
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    const query = search.trim();

    if (query) {
      navigate(`/products?q=${encodeURIComponent(query)}`);
    } else {
      navigate("/products");
    }
  };

  const moveOffer = (direction) => {
    setActiveOffer(current =>
      (current + direction + displayOffers.length) %
      displayOffers.length
    );
  };

  return (
    <div
      data-testid="home-page"
      className="min-w-0 overflow-x-clip bg-[#FAFBF8]"
    >

      {/* HERO SECTION */}

      <section className="relative isolate overflow-hidden bg-[#153D2C]">

        <img
          src="https://images.unsplash.com/photo-1557844352-761f2565b576?auto=format&fit=crop&w=2000&q=85"
          alt="Fresh vegetables and fruits"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />

        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#102F23]/95 via-[#153D2C]/80 to-[#153D2C]/35" />



      {/* OFFERS CAROUSEL */}

      {displayOffers.length > 0 && (

        <section className="relative z-10 w-full pt-4 pb-1 sm:pt-5 sm:pb-2">

          <div className="mb-4 flex items-end justify-between gap-3 px-4 sm:px-8 lg:px-12">

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#FFE08A]">
                DEALS MADE FOR YOU
              </p>

              <h2 className="mt-1 font-heading text-xl font-bold text-white sm:text-2xl">
                Offers & savings
              </h2>
            </div>

            {displayOffers.length > 1 && (
              <div className="hidden gap-2 sm:flex">

                <button
                  type="button"
                  onClick={() => moveOffer(-1)}
                  aria-label="Previous offer"
                  className="flex h-10 w-10 items-center justify-center rounded-full border bg-white text-[#1B4332] hover:bg-[#EAF1EB]"
                >
                  <ChevronLeft />
                </button>

                <button
                  type="button"
                  onClick={() => moveOffer(1)}
                  aria-label="Next offer"
                  className="flex h-10 w-10 items-center justify-center rounded-full border bg-white text-[#1B4332] hover:bg-[#EAF1EB]"
                >
                  <ChevronRight />
                </button>

              </div>
            )}

          </div>

          <div className="relative w-full overflow-hidden">

            <div
              className="flex transition-transform duration-700 ease-in-out motion-reduce:transition-none"
              style={{
                transform: `translateX(-${activeOffer * 100}%)`
              }}
            >

              {displayOffers.map((offer, index) => (

                <Link
                  key={offer.id}
                  to="/products"
                  aria-label={`${offer.title}. Browse products.`}
                  data-testid={`offer-${offer.id}`}
                  className="group relative min-w-full"
                >

                  <div className="relative flex min-h-[190px] items-center overflow-hidden px-6 py-7 sm:min-h-[220px] sm:px-14 sm:py-8 lg:min-h-[240px] lg:px-20">

                    <img
                      src={offer.image}
                      alt=""
                      loading={index === activeOffer ? "eager" : "lazy"}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105"
                    />

                    <div className="absolute inset-0 bg-gradient-to-r from-[#702C3A]/95 via-[#C94F45]/85 to-[#E98B45]/75" />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

                    <div className="relative z-10 mx-auto w-full max-w-3xl text-center text-white sm:text-left">

                      <span className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-3 py-1.5 text-[10px] font-bold tracking-widest backdrop-blur sm:text-xs">

                        <Tag className="h-4 w-4 text-[#FFE08A]" />

                        {offer.eyebrow}

                      </span>

                      <h3 className="mt-3 font-heading text-2xl font-extrabold leading-tight sm:text-3xl lg:text-4xl">
                        {offer.title}
                      </h3>

                      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/90 sm:mx-0 sm:text-base sm:leading-7">
                        {offer.subtitle}
                      </p>

                      <div className="mt-3 inline-flex items-center gap-2 text-xs font-bold tracking-widest text-[#FFE08A]">
                        {offer.detail}
                        <ArrowRight className="h-4 w-4" />
                      </div>

                    </div>

                  </div>

                </Link>

              ))}

            </div>

            {displayOffers.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => moveOffer(-1)}
                  aria-label="Previous offer"
                  className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur sm:hidden"
                >
                  <ChevronLeft />
                </button>

                <button
                  type="button"
                  onClick={() => moveOffer(1)}
                  aria-label="Next offer"
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur sm:hidden"
                >
                  <ChevronRight />
                </button>

                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">

                  {displayOffers.map((offer, index) => (

                    <button
                      key={offer.id}
                      type="button"
                      onClick={() => setActiveOffer(index)}
                      aria-label={`Show offer ${index + 1}`}
                      className={`h-2.5 rounded-full transition-all ${
                        index === activeOffer
                          ? "w-7 bg-[#FFE08A]"
                          : "w-2.5 bg-white/65"
                      }`}
                    />

                  ))}

                </div>

              </>
            )}

          </div>

          <p className="mt-3 px-4 text-center text-[11px] text-white/70 sm:px-8 lg:px-12">
            First-order offers are subject to eligibility and applicable
            product conditions at checkout.
          </p>

        </section>

      )}



        <div className="container-app relative py-12 sm:py-16 lg:py-24">

          <div className="max-w-2xl">

            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur">
              <Sparkles className="h-4 w-4 text-[#F6C85F]" />
              AMBAJOGAI'S LOCAL GROCERY STORE
            </span>

            <h1 className="mt-5 font-heading text-3xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
              Fresh groceries.
              <span className="mt-1 block text-[#F6C85F]">
                Delivered to your door.
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-6 text-white/85 sm:text-lg sm:leading-8">
              From fresh fruits and vegetables to daily essentials,
              shop from trusted local stores and get your groceries
              delivered across Ambajogai.
            </p>

            <form
              onSubmit={submitSearch}
              className="mt-6 flex w-full max-w-xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-2xl sm:mt-8 sm:flex-row sm:items-center sm:rounded-full"
              data-testid="hero-search-form"
            >

              <div className="relative min-w-0 flex-1">

                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />

                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search rice, atta, dal, milk..."
                  aria-label="Search groceries"
                  className="min-h-11 w-full rounded-xl bg-transparent py-2.5 pl-11 pr-3 text-base text-gray-900 outline-none placeholder:text-gray-400 sm:text-sm"
                  data-testid="hero-search-input"
                />

              </div>

              <button
                type="submit"
                className="min-h-11 w-full rounded-xl bg-[#1B4332] px-7 py-3 text-sm font-bold text-white transition hover:bg-[#2D6A4F] sm:w-auto sm:rounded-full"
                data-testid="hero-search-submit"
              >
                Search products
              </button>

            </form>

            

          </div>

        </div>

      </section>

      {/* CATEGORIES */}

      <section className="container-app py-9 sm:py-14">

        <SectionHeading
          eyebrow="EXPLORE OUR RANGE"
          title="Shop by category"
          subtitle="Everyday essentials, fresh picks and more — all in one place."
          cta={{ to: "/products", label: "View all products" }}
        />

        <div className="no-scrollbar mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible lg:grid-cols-6">

          {categories.map(category => (

            <Link
              key={category.slug}
              to={`/products?category=${encodeURIComponent(category.slug)}`}
              className="group flex w-[116px] shrink-0 snap-start flex-col items-center gap-2 rounded-2xl border border-[#E8EDE8] bg-white p-2.5 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md sm:w-auto sm:p-4"
              data-testid={`category-${category.slug}`}
            >

              <div className="aspect-square w-full overflow-hidden rounded-xl bg-[#F0F4EF]">

                {category.image ? (
                  <img
                    src={category.image}
                    alt={category.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Leaf className="h-8 w-8 text-[#6B8F71]" />
                  </div>
                )}

              </div>

              <span className="line-clamp-2 text-xs font-semibold text-[#263B2E] sm:text-sm">
                {category.name}
              </span>

            </Link>

          ))}

        </div>

      </section>

      {/* SHOP BY STORE */}

      {vendors.length > 0 && (

        <section
          className="border-y border-[#EDF1EC] bg-white py-9 sm:py-14"
          data-testid="shop-by-store"
        >

          <div className="container-app">

            <SectionHeading
              eyebrow="LOCAL & TRUSTED"
              title="Shop by store"
              subtitle="Discover neighbourhood stores and shop from sellers you trust."
            />

            <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">

              {vendors.map(vendor => (

                <Link
                  key={vendor.id}
                  to={`/vendors/${vendor.id}`}
                  className="group min-w-0 overflow-hidden rounded-2xl border border-[#E7ECE7] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                  data-testid={`vendor-card-${vendor.id}`}
                >

                  <div className="relative aspect-[5/4] overflow-hidden bg-[#F0F4EF]">

                    {vendor.shop_logo ? (
                      <img
                        src={vendor.shop_logo}
                        alt={vendor.business_name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Store className="h-10 w-10 text-[#77947B]" />
                      </div>
                    )}

                    {vendor.verified && (
                      <span className="absolute left-2 top-2 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#1B4332] shadow-sm">
                        ✓ Verified
                      </span>
                    )}

                    {vendor.vacation_mode && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-700">
                          Temporarily closed
                        </span>
                      </div>
                    )}

                  </div>

                  <div className="min-w-0 p-3 sm:p-4">

                    <h3 className="truncate text-sm font-bold text-[#20392A] sm:text-base">
                      {vendor.business_name}
                    </h3>

                    {vendor.description && (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#68756B]">
                        {vendor.description}
                      </p>
                    )}

                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#1B5A3B]">
                      Visit store <ArrowRight className="h-3.5 w-3.5" />
                    </span>

                  </div>

                </Link>

              ))}

            </div>

          </div>

        </section>

      )}

      {/* FEATURED PRODUCTS */}

      {featured.length > 0 && (

        <section className="container-app py-9 sm:py-14">

          <SectionHeading
            eyebrow="HAND-PICKED FOR YOU"
            title="Featured products"
            subtitle="Popular picks for your everyday grocery needs."
            cta={{ to: "/products", label: "Shop all products" }}
          />

          <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">

            {featured.map(product => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}

          </div>

        </section>

      )}

      {/* WHY SHOP WITH US */}

      <section className="bg-[#EEF4ED] py-10 sm:py-16">

        <div className="container-app">

          <SectionHeading
            eyebrow="THE LOCAL ADVANTAGE"
            title="Why shop with us?"
            subtitle="A simpler, more convenient way to shop for your daily needs."
          />

          <div className="mt-7 grid gap-3 sm:mt-9 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">

            {[
              {
                icon: "🌿",
                title: "Fresh everyday essentials",
                body: "Find fruits, vegetables, groceries and household essentials for your everyday needs."
              },
              {
                icon: "⚡",
                title: "Convenient local delivery",
                body: "Get your order delivered to your doorstep across our serviceable areas in Ambajogai."
              },
              {
                icon: "💚",
                title: "Shop from local stores",
                body: "Discover neighbourhood sellers and support the local businesses around you."
              },
              {
                icon: "🏷️",
                title: "Clear offers & pricing",
                body: "Explore available offers and check eligible discounts before placing your order."
              },
              {
                icon: "🛡️",
                title: "Easy shopping experience",
                body: "Browse products, add your essentials to cart and place your order with ease."
              },
              {
                icon: "📍",
                title: "Made for Ambajogai",
                body: "A local grocery shopping experience designed around Ambajogai customers."
              }
            ].map(item => (

              <div
                key={item.title}
                className="rounded-2xl border border-[#DFE8DE] bg-white p-5 sm:p-6"
              >

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF2E9] text-2xl">
                  {item.icon}
                </div>

                <h3 className="mt-4 font-heading text-base font-bold text-[#20392A] sm:text-lg">
                  {item.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-[#68756B]">
                  {item.body}
                </p>

              </div>

            ))}

          </div>

        </div>

      </section>

      {/* CUSTOMER REVIEWS */}

      {reviews.length > 0 && (

        <section className="container-app py-10 sm:py-16">

          <SectionHeading
            eyebrow="CUSTOMER EXPERIENCES"
            title="Loved by our neighbours"
            subtitle="See what customers are saying about their shopping experience."
          />

          <div className="mt-7 grid gap-3 sm:mt-9 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">

            {reviews.slice(0, 6).map(review => (

              <article
                key={review.id}
                className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-sm sm:p-6"
                data-testid={`review-${review.id}`}
              >

                <div className="flex gap-1">

                  {Array.from({
                    length: Math.min(5, Math.max(0, Number(review.rating) || 0))
                  }).map((_, index) => (

                    <Star
                      key={index}
                      className="h-4 w-4 fill-[#E9A23B] text-[#E9A23B]"
                    />

                  ))}

                </div>

                <p className="mt-4 break-words text-sm leading-6 text-[#4F5D52]">
                  “{review.comment}”
                </p>

                <div className="mt-4 border-t border-[#EDF1EC] pt-3 text-sm font-bold text-[#1B4332]">
                  {review.author_name}
                </div>

              </article>

            ))}

          </div>

        </section>

      )}

      {/* FINAL SHOPPING BANNER */}

      <section className="container-app pb-10 sm:pb-14">

        <div className="flex flex-col gap-4 rounded-2xl bg-[#173F2D] px-5 py-7 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-8">

          <div className="flex items-start gap-3">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <MapPin className="h-5 w-5 text-[#F6D477]" />
            </div>

            <div>
              <h2 className="font-heading text-lg font-bold sm:text-xl">
                Your neighbourhood grocery store
              </h2>

              <p className="mt-1 text-sm leading-6 text-white/75">
                Shop local. Get everyday essentials delivered across Ambajogai.
              </p>
            </div>

          </div>

          <Link
            to="/products"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F6D477] px-5 py-3 text-sm font-bold text-[#20392A] transition hover:bg-[#FFE59A] sm:w-auto"
          >
            Start shopping <ArrowRight className="h-4 w-4" />
          </Link>

        </div>

      </section>

      <Footer />

    </div>
  );
}

function HeroBenefit({ icon: Icon, text }) {
  return (
    <div className="flex min-w-0 items-center gap-2">

      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
        <Icon className="h-4 w-4 text-[#F6D477]" />
      </span>

      <span className="text-xs font-medium sm:text-sm">
        {text}
      </span>

    </div>
  );
}

function SectionHeading({ eyebrow, title, subtitle, cta }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">

      <div className="min-w-0">

        {eyebrow && (
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A36B22] sm:text-xs">
            {eyebrow}
          </p>
        )}

        <h2 className="mt-1 font-heading text-2xl font-extrabold tracking-tight text-[#1A3526] sm:text-3xl lg:text-4xl">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68756B] sm:text-base">
            {subtitle}
          </p>
        )}

      </div>

      {cta && (
        <Link
          to={cta.to}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-[#1B5A3B] hover:bg-[#EAF1EB] sm:text-sm"
        >
          {cta.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

    </div>
  );
}
