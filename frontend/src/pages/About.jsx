import { Link } from "react-router-dom";
import { Leaf, Users, Heart, ShieldCheck } from "lucide-react";

export default function About() {
  return (
    <div className="container-app py-12" data-testid="about-page">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#8BA888]/20 px-3 py-1 text-xs font-semibold text-[#1B4332]">
            <Leaf className="h-3.5 w-3.5" /> Family run since 2005
          </span>
          <h1 className="mt-4 font-heading text-4xl font-bold sm:text-5xl">
            The neighbourhood grocery, reimagined.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-[#4A4A4A]">
            Ambajogai Grocery Store started as a small family shop on Main Road. Two decades later, we&apos;ve grown
            with the town — but we still believe in what we started with: fresh produce, honest prices, and a
            smile at every doorstep.
          </p>
          <p className="mt-4 text-base leading-relaxed text-[#4A4A4A]">
            Today, we deliver to hundreds of homes across Ambajogai in under 90 minutes. From the farmer&apos;s field
            to your kitchen, every item passes through our own hands.
          </p>
          <Link to="/products" className="btn-primary mt-8 inline-flex">Explore the shelves</Link>
        </div>

        <div className="rounded-3xl overflow-hidden shadow-lg">
          <img
            src="https://images.unsplash.com/photo-1693505628207-dbeb3d882c92?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzF8MHwxfHNlYXJjaHwwyfHxpbmRpYW4lMjBsb2NhbCUyMHByZW1pdW0lMjBncm9jZXJ5JTIwc3RvcmUlMjBzaG9wfGVufDB8fHx8MTc4NTE2OTIwNHww&ixlib=rb-4.1.0&q=85"
            alt="Store"
            className="h-full w-full object-cover"
          />
        </div>
      </div>

      <section className="mt-24">
        <h2 className="font-heading text-3xl font-bold sm:text-4xl">What we stand for</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            { icon: Leaf, title: "Farm-fresh only", body: "We source directly from local farms every morning. Nothing sits on our shelves for more than a day." },
            { icon: Heart, title: "Real people, real service", body: "You'll never speak to a bot. Our team knows the aisles and knows the town." },
            { icon: ShieldCheck, title: "Prices that feel fair", body: "Transparent pricing, competitive with any chain. Plus free delivery over ₹499." },
            { icon: Users, title: "Community first", body: "We employ our neighbours and support local farmers. Every order helps Ambajogai grow." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="card-base p-6">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[#1B4332] text-white">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#4A4A4A]">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
