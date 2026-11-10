import { Link } from "react-router-dom";
import {
  Leaf,
  Users,
  Heart,
  ShieldCheck,
  Truck,
  Clock,
  ArrowRight,
  Sparkles,
  MapPin,
  HandHeart,
} from "lucide-react";
import Footer from "@/components/Footer";

const STATS = [
  { value: "20+", label: "Years serving Ambajogai" },
  { value: "500+", label: "Homes delivered weekly" },
  { value: "40+", label: "Local farmer partners" },
  { value: "45 min", label: "Average delivery time" },
];

const VALUES = [
  {
    icon: Leaf,
    title: "Farm-fresh only",
    body: "We source directly from local farms every morning. Nothing sits on our shelves for more than a day.",
    color: "bg-[#1B4332]",
  },
  {
    icon: Heart,
    title: "Real people, real service",
    body: "You'll never speak to a bot. Our team knows the aisles and knows the town.",
    color: "bg-[#E07A5F]",
  },
  {
    icon: ShieldCheck,
    title: "Prices that feel fair",
    body: "Transparent pricing, competitive with any chain. Plus free delivery over ₹499.",
    color: "bg-[#2D6A4F]",
  },
  {
    icon: Users,
    title: "Community first",
    body: "We employ our neighbours and support local farmers. Every order helps Ambajogai grow.",
    color: "bg-[#8BA888]",
  },
];

const MILESTONES = [
  { year: "2005", title: "A family shop opens", body: "Started as a small counter on Main Road with vegetables, grains, and a warm smile." },
  { year: "2012", title: "Growing with the town", body: "Expanded into dairy, spices, and daily essentials as Ambajogai's needs grew." },
  { year: "2020", title: "Delivery begins", body: "Launched doorstep delivery so families could stay safe and stocked at home." },
  { year: "Today", title: "Your digital neighbourhood store", body: "Hundreds of orders every week — still the same family, still the same fresh quality." },
];

export default function About() {
  return (
    <div data-testid="about-page">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1693505628207-dbeb3d882c92?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzF8MHwxfHNlYXJjaHwwyfHxpbmRpYW4lMjBsb2NhbCUyMHByZW1pdW0lMjBncm9jZXJ5JTIwc3RvcmUlMjBzaG9wfGVufDB8fHx8MTc4NTE2OTIwNHww&ixlib=rb-4.1.0&q=85"
            alt="Ambajogai Grocery Store"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1B4332]/90 via-[#1B4332]/70 to-[#1B4332]/40" />
        </div>

        <div className="container-app relative py-16 sm:py-24 lg:py-28">
          <div className="max-w-2xl animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" /> Family run since 2005
            </span>
            <h1 className="mt-4 font-heading text-3xl font-bold text-white sm:text-5xl lg:text-6xl">
              The neighbourhood grocery,
              <span className="block text-[#E07A5F]">reimagined for today.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-white/85 sm:text-lg">
              Ambajogai Grocery Store started as a small family shop on Main Road. Two decades later, we&apos;ve grown
              with the town — but we still believe in fresh produce, honest prices, and a smile at every doorstep.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/products" className="btn-primary">
                Explore the shelves
              </Link>
              <Link to="/contact" className="btn-secondary border-white/40 text-white hover:border-white hover:bg-white hover:text-[#1B4332]">
                Get in touch
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-b border-[#E5E5E5] bg-white py-10 sm:py-12">
        <div className="container-app">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8">
            {STATS.map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="font-heading text-3xl font-bold text-[#1B4332] sm:text-4xl">{value}</div>
                <div className="mt-1 text-xs text-[#4A4A4A] sm:text-sm">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OUR STORY */}
      <section className="container-app py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8BA888]">Our story</span>
            <h2 className="mt-2 font-heading text-3xl font-bold sm:text-4xl">From Main Road to your kitchen</h2>
            <p className="mt-6 text-base leading-relaxed text-[#4A4A4A]">
              What began as a single counter selling vegetables and grains has become Ambajogai&apos;s trusted grocery
              destination. We know our customers by name, their usual orders, and the best time to deliver before
              dinner.
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#4A4A4A]">
              Today, we deliver to hundreds of homes across Ambajogai in 30–45 minutes. From the farmer&apos;s field
              to your kitchen, every item passes through our own hands — checked for freshness, packed with care, and
              sent with a team member who lives in your neighbourhood.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              {[
                { icon: Truck, text: "Free delivery over ₹499" },
                { icon: Clock, text: "30–45 min delivery" },
                { icon: HandHeart, text: "Family-owned & operated" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 rounded-full border border-[#E5E5E5] bg-white px-4 py-2 text-sm text-[#4A4A4A]">
                  <Icon className="h-4 w-4 text-[#1B4332]" />
                  {text}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl shadow-md">
                <img
                  src="https://images.unsplash.com/photo-1542838132-92c53300491e?crop=entropy&cs=srgb&fm=jpg&q=85&w=600"
                  alt="Fresh produce"
                  className="aspect-[4/5] w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="overflow-hidden rounded-2xl shadow-md">
                <img
                  src="https://images.unsplash.com/photo-1604719312566-8912e9227c6a?crop=entropy&cs=srgb&fm=jpg&q=85&w=600"
                  alt="Local market"
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
            <div className="space-y-4 pt-8">
              <div className="overflow-hidden rounded-2xl shadow-md">
                <img
                  src="https://images.unsplash.com/photo-1578911373434-0cb395d2cbfb?crop=entropy&cs=srgb&fm=jpg&q=85&w=600"
                  alt="Grocery delivery"
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="overflow-hidden rounded-2xl shadow-md">
                <img
                  src="https://images.unsplash.com/photo-1586201375761-83865001e31c?crop=entropy&cs=srgb&fm=jpg&q=85&w=600"
                  alt="Staples and grains"
                  className="aspect-[4/5] w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="bg-white py-16 sm:py-20">
        <div className="container-app">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8BA888]">What we stand for</span>
            <h2 className="mt-2 font-heading text-3xl font-bold sm:text-4xl">Built on trust, not shortcuts</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-[#4A4A4A] sm:text-base">
              Every decision we make comes back to one question: would we serve this to our own family?
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map(({ icon: Icon, title, body, color }) => (
              <div key={title} className="card-base group p-6 transition-all hover:-translate-y-1 hover:shadow-md">
                <div className={`grid h-11 w-11 place-items-center rounded-xl ${color} text-white transition-transform group-hover:scale-105`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-heading text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4A4A4A]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section className="container-app py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8BA888]">Our journey</span>
            <h2 className="mt-2 font-heading text-3xl font-bold sm:text-4xl">Two decades of serving Ambajogai</h2>
            <p className="mt-4 text-sm leading-relaxed text-[#4A4A4A] sm:text-base">
              We&apos;ve seen the town grow, seasons change, and families come back week after week. Here&apos;s how
              we got here.
            </p>
            <Link to="/products" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B4332] hover:text-[#E07A5F]">
              Start shopping
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="relative space-y-0">
            {MILESTONES.map(({ year, title, body }, i) => (
              <div key={year} className="relative flex gap-6 pb-10 last:pb-0">
                {i < MILESTONES.length - 1 && (
                  <div className="absolute left-[23px] top-12 h-[calc(100%-2rem)] w-px bg-[#E5E5E5]" />
                )}
                <div className="relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-[#1B4332] bg-white font-heading text-xs font-bold text-[#1B4332]">
                  {year.slice(2)}
                </div>
                <div className="pt-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#8BA888]">{year}</div>
                  <h3 className="mt-1 font-heading text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#4A4A4A]">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMUNITY */}
      <section className="bg-[#1B4332] py-16 sm:py-20">
        <div className="container-app">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8BA888]">Our community</span>
              <h2 className="mt-2 font-heading text-3xl font-bold text-white sm:text-4xl">
                More than a store — a part of Ambajogai
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-white/75 sm:text-base">
                We partner with local farmers, employ neighbours, and support community events throughout the year.
                When you shop with us, you&apos;re investing in the town we all call home.
              </p>
              <div className="mt-8 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#8BA888]" />
                <div>
                  <div className="font-semibold text-white">Visit us on Main Road</div>
                  <div className="mt-1 text-sm text-white/70">Main Road, Ambajogai, Maharashtra 431517</div>
                  <div className="mt-1 text-sm text-white/70">Open Mon–Sun, 7:00 AM – 10:00 PM</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { emoji: "🌾", label: "Local sourcing", stat: "40+ farms" },
                { emoji: "👨‍👩‍👧", label: "Happy families", stat: "500+ weekly" },
                { emoji: "🏪", label: "Vendor partners", stat: "Growing daily" },
                { emoji: "♻️", label: "Less waste", stat: "Daily fresh stock" },
              ].map(({ emoji, label, stat }) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center backdrop-blur-sm">
                  <div className="text-2xl">{emoji}</div>
                  <div className="mt-2 font-heading text-lg font-bold text-white">{stat}</div>
                  <div className="mt-1 text-xs text-white/60">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-app py-16 sm:py-20">
        <div className="rounded-3xl bg-gradient-to-br from-[#8BA888]/20 via-white to-[#E07A5F]/10 p-8 text-center sm:p-12">
          <h2 className="font-heading text-2xl font-bold sm:text-3xl">Ready to fill your pantry?</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-[#4A4A4A] sm:text-base">
            Browse our full catalogue of fresh produce, dairy, staples, and spices — delivered to your door in under an hour.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/products" className="btn-primary">
              Shop now
            </Link>
            <Link to="/become-vendor" className="btn-secondary">
              Sell with us
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
