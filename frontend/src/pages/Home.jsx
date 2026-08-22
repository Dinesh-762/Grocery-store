import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Truck, ShieldCheck, Clock, Star, ArrowRight, Sparkles, Store } from "lucide-react";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import Footer from "@/components/Footer";

export default function Home() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [popular, setPopular] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [cRes, fRes, pRes, aRes, rRes] = await Promise.all([
          api.get("/categories"),
          api.get("/products?featured=true&limit=8"),
          api.get("/products?popular=true&limit=8"),
          api.get("/products?limit=200"),
          api.get("/reviews?limit=6"),
        ]);
        setCategories(cRes.data);
        setFeatured(fRes.data);
        setPopular(pRes.data);
        setAllProducts(aRes.data);
        setReviews(rRes.data);
      } catch {
        /* ignore fetch errors on home */
      }
    })();
  }, []);

  // Group products by vendor for the "Shop by Store" section
  const productsByVendor = useMemo(() => {
    const groups = {};
    for (const p of allProducts) {
      if (!p.vendor_id || !p.vendor_name) continue;
      if (!groups[p.vendor_id]) {
        groups[p.vendor_id] = { vendor_id: p.vendor_id, vendor_name: p.vendor_name, items: [] };
      }
      if (groups[p.vendor_id].items.length < 4) {
        groups[p.vendor_id].items.push(p);
      }
    }
    return Object.values(groups);
  }, [allProducts]);

  const submitSearch = (e) => {
    e.preventDefault();
    if (search.trim()) navigate(`/products?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <div data-testid="home-page">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1557844352-761f2565b576?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxOTF8MHwxfHNlYXJjaHw0fHxmcmVzaCUyMG9yZ2FuaWMlMjB2ZWdldGFibGVzJTIwZnJ1aXRzJTIwbWFya2V0fGVufDB8fHx8MTc4NTE2OTIwNXww&ixlib=rb-4.1.0&q=85"
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1B4332]/85 via-[#1B4332]/60 to-transparent" />
        </div>

        <div className="container-app relative py-20 sm:py-28 lg:py-32">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" /> Local & Fresh, Delivered in 30–45 minutes
            </span>
            <h1 className="mt-6 font-heading text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
              Ambajogai&apos;s freshest
              <span className="block text-[#E07A5F]">groceries at your door.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-white/85 sm:text-lg">
              Farm-picked vegetables, dairy, staples, spices and pantry essentials — hand-selected daily and delivered fast across town.
            </p>

            <form onSubmit={submitSearch} className="mt-8 max-w-lg" data-testid="hero-search-form">
              <div className="relative flex overflow-hidden rounded-full bg-white p-1.5 shadow-xl">
                <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search rice, atta, dal, milk…"
                  className="flex-1 bg-transparent pl-12 pr-3 text-sm outline-none placeholder:text-gray-400"
                  data-testid="hero-search-input"
                />
                <button
                  type="submit"
                  className="rounded-full bg-[#1B4332] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2D6A4F]"
                  data-testid="hero-search-submit"
                >
                  Search
                </button>
              </div>
            </form>

            <div className="mt-8 flex flex-wrap gap-6">
              {[
                { icon: Truck, text: "Free delivery over ₹499" },
                { icon: Clock, text: "Delivered in 30–45 min" },
                { icon: ShieldCheck, text: "100% quality assured" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-sm text-white/85">
                  <Icon className="h-4 w-4 text-[#8BA888]" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* OFFERS BANNER */}
      <section className="container-app -mt-8 relative z-10">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: "10% off", sub: "on your first order", color: "bg-[#E07A5F]" },
            { title: "Free delivery", sub: "orders above ₹499", color: "bg-[#1B4332]" },
            { title: "COD available", sub: "pay on delivery", color: "bg-[#8BA888]" },
          ].map((o) => (
            <div
              key={o.title}
              className={`${o.color} rounded-2xl p-5 text-white shadow-md transition-transform hover:-translate-y-0.5`}
            >
              <div className="font-heading text-xl font-bold">{o.title}</div>
              <div className="mt-1 text-sm opacity-90">{o.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="container-app py-16">
        <SectionHeading title="Shop by Category" subtitle="Everything you need under one roof" cta={{ to: "/products", label: "See all" }} />
        <div className="mt-8 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {categories.map((c) => (
            <Link
              key={c.slug}
              to={`/products?category=${c.slug}`}
              className="card-base group flex flex-col items-center gap-3 p-4 text-center hover:border-[#8BA888]"
              data-testid={`category-${c.slug}`}
            >
              <div className="aspect-square w-full overflow-hidden rounded-xl bg-gray-50">
                <img src={c.image} alt={c.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
              </div>
              <div className="text-xs font-medium text-[#1A1A1A]">{c.name}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      {featured.length > 0 && (
        <section className="container-app py-8">
          <SectionHeading title="Featured Today" subtitle="Hand-picked deals just for you" cta={{ to: "/products", label: "Shop all" }} />
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* POPULAR */}
      {popular.length > 0 && (
        <section className="container-app py-8">
          <SectionHeading title="Popular Right Now" subtitle="What Ambajogai is buying this week" />
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {popular.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* SHOP BY VENDOR / STORE */}
      {productsByVendor.length > 0 && (
        <section className="container-app py-8" data-testid="shop-by-vendor">
          <SectionHeading title="Shop by Store" subtitle="Fresh picks from your neighbourhood vendors" />
          <div className="mt-8 space-y-10">
            {productsByVendor.map((g) => (
              <div key={g.vendor_id} data-testid={`vendor-group-${g.vendor_id}`}>
                <div className="flex items-center justify-between">
                  <Link
                    to={`/vendors/${g.vendor_id}`}
                    className="group inline-flex items-center gap-2 text-lg font-semibold text-[#1A1A1A] hover:text-[#1B4332]"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[#1B4332]/10 text-[#1B4332]">
                      <Store className="h-4 w-4" />
                    </span>
                    {g.vendor_name}
                    <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                  <Link
                    to={`/vendors/${g.vendor_id}`}
                    className="text-xs font-semibold text-[#1B4332] hover:text-[#E07A5F]"
                    data-testid={`view-store-${g.vendor_id}`}
                  >
                    View store
                  </Link>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {g.items.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* WHY US */}
      <section className="bg-white py-20">
        <div className="container-app">
          <SectionHeading title="Why shop with us" subtitle="A grocery experience built for busy families" />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { icon: "🌾", title: "Farm-fresh daily", body: "We source directly from local farmers to bring you the freshest produce every single day." },
              { icon: "⚡", title: "Lightning fast delivery", body: "Order any time and get your groceries delivered in 30–45 minutes, right at your doorstep across Ambajogai." },
              { icon: "💚", title: "Fair prices, no hidden fees", body: "Transparent pricing on every item. What you see is what you pay — plus free delivery over ₹499." },
            ].map((w) => (
              <div key={w.title} className="rounded-2xl border border-[#E5E5E5] p-6">
                <div className="text-3xl">{w.icon}</div>
                <h3 className="mt-4 font-heading text-lg font-semibold">{w.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4A4A4A]">{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      {reviews.length > 0 && (
        <section className="container-app py-20">
          <SectionHeading title="Loved by our neighbours" subtitle="Real stories from Ambajogai families" />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {reviews.slice(0, 3).map((r) => (
              <div key={r.id} className="card-base p-6" data-testid={`review-${r.id}`}>
                <div className="flex gap-0.5">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-[#F4A261] text-[#F4A261]" />
                  ))}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-[#4A4A4A]">&ldquo;{r.comment}&rdquo;</p>
                <div className="mt-4 text-sm font-semibold text-[#1B4332]">— {r.author_name}</div>
              </div>
            ))}
          </div>
        </section>
      )}
      <Footer />
    </div>
  );
}

function SectionHeading({ title, subtitle, cta }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="font-heading text-2xl font-bold text-[#1A1A1A] sm:text-3xl lg:text-4xl">{title}</h2>
        {subtitle && <p className="mt-2 text-sm text-[#4A4A4A]">{subtitle}</p>}
      </div>
      {cta && (
        <Link to={cta.to} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B4332] hover:text-[#E07A5F]">
          {cta.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
