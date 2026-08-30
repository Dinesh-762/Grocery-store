import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  MessageCircle,
  Send,
  ChevronDown,
  Truck,
  RotateCcw,
  CreditCard,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import Footer from "@/components/Footer";

const FAQ = [
  {
    q: "How fast is delivery?",
    a: "Most orders reach your doorstep within 30–45 minutes across Ambajogai. Delivery is free for orders above ₹499.",
    icon: Truck,
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept UPI (via QR code at checkout) and Cash on Delivery. Please keep exact change ready for COD orders.",
    icon: CreditCard,
  },
  {
    q: "Can I return damaged items?",
    a: "Yes — report any damaged or spoiled items within 24 hours over WhatsApp for a full refund or replacement.",
    icon: RotateCcw,
  },
  {
    q: "Do you take bulk or event orders?",
    a: "Absolutely! Message us on WhatsApp with your list and we'll prepare a quote. We handle weddings, functions, and office orders.",
    icon: HelpCircle,
  },
];

const SUBJECTS = [
  "General enquiry",
  "Order issue",
  "Bulk order",
  "Feedback",
  "Vendor partnership",
  "Other",
];

export default function Contact() {
  const [store, setStore] = useState({ whatsapp: "+918237214975", email: "ambajogaigrocerystores@gmail.com" });
  const [form, setForm] = useState({ name: "", email: "", subject: SUBJECTS[0], message: "" });
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    api.get("/store/info").then(({ data }) => setStore(data)).catch(() => {});
  }, []);

  const waNum = store.whatsapp.replace(/[^\d]/g, "");

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) return toast.error("Fill required fields");
    const msg = encodeURIComponent(
      `Hi, I'm ${form.name.trim()}${form.email ? ` (${form.email.trim()})` : ""}.\n` +
        `Subject: ${form.subject}\n\n${form.message.trim()}`
    );
    window.open(`https://wa.me/${waNum}?text=${msg}`, "_blank");
    toast.success("Opening WhatsApp…");
    setForm({ name: "", email: "", subject: SUBJECTS[0], message: "" });
  };

  return (
    <div data-testid="contact-page">
      {/* HERO */}
      <section className="relative overflow-hidden bg-[#1B4332]">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#8BA888]" />
          <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-[#E07A5F]" />
        </div>
        <div className="container-app relative py-14 sm:py-20">
          <div className="mx-auto max-w-2xl text-center animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
              <MessageCircle className="h-3.5 w-3.5" /> We reply within minutes
            </span>
            <h1 className="mt-4 font-heading text-3xl font-bold text-white sm:text-5xl">
              Say hello — we&apos;re here to help.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-white/75 sm:text-base">
              Got a question, a bulk order, or feedback? Reach us on WhatsApp, phone, or email. Real people, real answers.
            </p>
          </div>
        </div>
      </section>

      {/* QUICK CONTACT CARDS */}
      <section className="container-app relative z-10 -mt-8 sm:-mt-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickCard
            icon={MessageCircle}
            title="WhatsApp"
            body="Fastest way to reach us"
            action="Chat now"
            href={`https://wa.me/${waNum}`}
            accent="bg-[#25D366] text-white hover:bg-[#20b859]"
            testId="whatsapp-cta"
            external
          />
          <QuickCard
            icon={Phone}
            title="Call"
            body={store.phone || store.whatsapp}
            action="Call us"
            href={`tel:${store.phone || store.whatsapp}`}
            accent="btn-primary"
          />
          <QuickCard
            icon={Mail}
            title="Email"
            body={store.email}
            action="Send email"
            href={`mailto:${store.email}`}
            accent="btn-secondary"
          />
          <QuickCard
            icon={MapPin}
            title="Visit us"
            body="Main Road, Ambajogai 431517"
            action="Get directions"
            href="https://maps.google.com/?q=Ambajogai+Maharashtra+431517"
            accent="btn-accent"
            external
          />
        </div>
      </section>

      {/* FORM + INFO */}
      <section className="container-app py-14 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <form onSubmit={submit} className="card-base p-6 sm:p-8" data-testid="contact-form">
              <h2 className="font-heading text-2xl font-semibold">Send a message</h2>
              <p className="mt-2 text-sm text-[#4A4A4A]">
                Fill in the form and we&apos;ll open WhatsApp with your message pre-filled.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Name *">
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input-base"
                    placeholder="Your name"
                    data-testid="contact-name"
                  />
                </Field>
                <Field label="Email (optional)">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input-base"
                    placeholder="you@example.com"
                    data-testid="contact-email"
                  />
                </Field>
              </div>

              <div className="mt-4">
                <Field label="Subject">
                  <select
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="input-base"
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="mt-4">
                <Field label="Message *">
                  <textarea
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="input-base resize-none"
                    placeholder="How can we help you?"
                    data-testid="contact-message"
                  />
                </Field>
              </div>

              <button type="submit" className="btn-primary mt-6 w-full sm:w-auto" data-testid="contact-submit">
                <Send className="h-4 w-4" /> Send via WhatsApp
              </button>
            </form>
          </div>

          <div className="space-y-6 lg:col-span-2">
            <div className="card-base p-6">
              <h3 className="font-heading text-lg font-semibold">Store details</h3>
              <ul className="mt-5 space-y-5">
                <ContactItem icon={MapPin} title="Address" body="Main Road, Ambajogai, Maharashtra 431517" />
                <ContactItem icon={Phone} title="Phone / WhatsApp" body={store.phone || store.whatsapp} href={`tel:${store.phone || store.whatsapp}`} />
                <ContactItem icon={Mail} title="Email" body={store.email} href={`mailto:${store.email}`} />
                <ContactItem icon={Clock} title="Open hours" body="Mon–Sun, 7:00 AM – 10:00 PM" />
              </ul>
            </div>

            <div className="rounded-2xl border border-[#8BA888]/30 bg-[#8BA888]/10 p-6">
              <h3 className="font-heading text-lg font-semibold text-[#1B4332]">Need order help?</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#4A4A4A]">
                Track your order from the Orders page, or message us on WhatsApp with your order ID.
              </p>
              <Link to="/orders" className="mt-4 inline-flex text-sm font-semibold text-[#1B4332] hover:text-[#E07A5F]">
                View my orders →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* MAP */}
      <section className="container-app pb-14 sm:pb-20">
        <div className="overflow-hidden rounded-3xl border border-gray-100 shadow-sm">
          <div className="grid lg:grid-cols-[1fr_1.5fr]">
            <div className="bg-[#1B4332] p-8 text-white sm:p-10">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8BA888]">Find us</span>
              <h2 className="mt-2 font-heading text-2xl font-bold sm:text-3xl">On Main Road, Ambajogai</h2>
              <p className="mt-4 text-sm leading-relaxed text-white/75">
                Drop by to pick up an order, browse what&apos;s fresh today, or just say hello. Parking available on the street.
              </p>
              <a
                href="https://maps.google.com/?q=Ambajogai+Maharashtra+431517"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-accent mt-6 inline-flex"
              >
                <MapPin className="h-4 w-4" /> Open in Google Maps
              </a>
            </div>
            <div className="relative min-h-[280px] bg-gray-100 lg:min-h-[320px]">
              <iframe
                title="Ambajogai Grocery Store location"
                src="https://maps.google.com/maps?q=Ambajogai%2C+Maharashtra+431517&z=14&output=embed"
                className="absolute inset-0 h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-14 sm:py-20">
        <div className="container-app">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8BA888]">FAQ</span>
            <h2 className="mt-2 font-heading text-3xl font-bold sm:text-4xl">Common questions</h2>
            <p className="mt-3 text-sm text-[#4A4A4A] sm:text-base">
              Can&apos;t find what you need?{" "}
              <a href={`https://wa.me/${waNum}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#1B4332] hover:text-[#E07A5F]">
                Message us on WhatsApp
              </a>
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-3xl space-y-3">
            {FAQ.map(({ q, a, icon: Icon }, i) => (
              <div key={q} className="card-base overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                  className="flex w-full items-center gap-4 p-5 text-left"
                  aria-expanded={openFaq === i}
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1B4332]/10 text-[#1B4332]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="flex-1 font-heading text-sm font-semibold sm:text-base">{q}</span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-[#4A4A4A] transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="border-t border-gray-100 px-5 pb-5 pt-4 pl-[4.25rem] text-sm leading-relaxed text-[#4A4A4A]">
                    {a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function QuickCard({ icon: Icon, title, body, action, href, accent, testId, external }) {
  const inner = (
    <div className="card-base flex h-full flex-col p-5 transition-all hover:-translate-y-1 hover:shadow-md">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-[#1B4332]/10 text-[#1B4332]">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="mt-3 font-heading text-base font-semibold">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-[#4A4A4A]">{body}</p>
      <span className={`mt-4 inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${accent}`}>
        {action}
      </span>
    </div>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" data-testid={testId}>
        {inner}
      </a>
    );
  }
  return <a href={href} data-testid={testId}>{inner}</a>;
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">{label}</label>
      {children}
    </div>
  );
}

function ContactItem({ icon: Icon, title, body, href }) {
  const content = (
    <>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-sm text-[#4A4A4A]">{body}</div>
    </>
  );

  return (
    <li className="flex items-start gap-4">
      <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-[#1B4332]/10 text-[#1B4332]">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        {href ? (
          <a href={href} className="block hover:text-[#1B4332]">
            {content}
          </a>
        ) : (
          content
        )}
      </div>
    </li>
  );
}
