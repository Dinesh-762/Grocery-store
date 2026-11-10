import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import {
  MessageCircle,
  Phone,
  Mail,
  Clock,
  Send,
  ChevronDown,
  HelpCircle,
  Package,
  Wallet,
  Store,
} from "lucide-react";
import { toast } from "sonner";

const VENDOR_FAQ = [
  {
    q: "How do I get my products approved?",
    a: "New products are submitted for admin review. You'll see pending status in Catalogue until approved. Edits may require re-approval.",
    icon: Package,
  },
  {
    q: "When do I receive payouts?",
    a: "After orders are delivered, earnings move to your wallet after the settlement period. Request a payout from Wallet → Payouts once you add bank details.",
    icon: Wallet,
  },
  {
    q: "Why can't I mark an order as Delivered?",
    a: "Vendors can update status up to Ready. Out for delivery, delivered, and cancelled are handled by the delivery partner or admin.",
    icon: HelpCircle,
  },
  {
    q: "How does pricing work for my products?",
    a: "You set your own price per product. That is the amount used for your orders and payouts on this dashboard.",
    icon: Store,
  },
];

const SUBJECTS = [
  "Vendor account help",
  "Product approval",
  "Order issue",
  "Payout / wallet",
  "Technical problem",
  "Other",
];

export default function VendorSupport() {
  const [store, setStore] = useState({
    whatsapp: "+918237214975",
    phone: "+918237214975",
    email: "ambajogaigrocerystores@gmail.com",
  });
  const [form, setForm] = useState({ name: "", email: "", subject: SUBJECTS[0], message: "" });
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    api.get("/store/info").then(({ data }) => setStore(data)).catch(() => {});
  }, []);

  const waNum = (store.whatsapp || "").replace(/[^\d]/g, "");

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) return toast.error("Fill required fields");
    const msg = encodeURIComponent(
      `[Vendor Support]\nFrom: ${form.name.trim()}${form.email ? ` (${form.email.trim()})` : ""}\n` +
        `Subject: ${form.subject}\n\n${form.message.trim()}`
    );
    window.open(`https://wa.me/${waNum}?text=${msg}`, "_blank", "noopener,noreferrer");
    toast.success("Opening WhatsApp…");
    setForm({ name: "", email: "", subject: SUBJECTS[0], message: "" });
  };

  return (
    <div className="space-y-8" data-testid="vendor-support">
      <div>
        <h2 className="font-heading text-2xl font-semibold">Help &amp; Support</h2>
        <p className="mt-1 text-sm text-[#4A4A4A]">
          Vendor-only help — account, products, orders, and payouts. We typically reply within minutes on WhatsApp.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <a
          href={`https://wa.me/${waNum}`}
          target="_blank"
          rel="noopener noreferrer"
          className="card-base flex flex-col p-5 transition hover:border-[#8BA888]"
        >
          <MessageCircle className="h-6 w-6 text-[#25D366]" />
          <div className="mt-3 font-semibold">WhatsApp</div>
          <div className="mt-1 text-sm text-[#4A4A4A]">Fastest for urgent issues</div>
        </a>
        <a href={`tel:${store.phone || store.whatsapp}`} className="card-base flex flex-col p-5 transition hover:border-[#8BA888]">
          <Phone className="h-6 w-6 text-[#1B4332]" />
          <div className="mt-3 font-semibold">Call</div>
          <div className="mt-1 text-sm text-[#4A4A4A]">{store.phone || store.whatsapp}</div>
        </a>
        <a href={`mailto:${store.email}`} className="card-base flex flex-col p-5 transition hover:border-[#8BA888]">
          <Mail className="h-6 w-6 text-[#1B4332]" />
          <div className="mt-3 font-semibold">Email</div>
          <div className="mt-1 truncate text-sm text-[#4A4A4A]">{store.email}</div>
        </a>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <form onSubmit={submit} className="card-base p-6">
          <h3 className="font-heading text-lg font-semibold">Send a message</h3>
          <p className="mt-1 text-xs text-[#4A4A4A]">Opens WhatsApp with your message pre-filled.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Your name *">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-base" required />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-base" />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Subject">
              <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input-base">
                {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Message *">
              <textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="input-base resize-none" required />
            </Field>
          </div>
          <button type="submit" className="btn-primary mt-4">
            <Send className="h-4 w-4" /> Send via WhatsApp
          </button>
        </form>

        <div className="space-y-4">
          <div className="card-base p-6">
            <h3 className="font-heading text-lg font-semibold">Quick links</h3>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link to="/vendor/orders" className="font-semibold text-[#1B4332] hover:underline">My orders</Link></li>
              <li><Link to="/vendor/catalogue" className="font-semibold text-[#1B4332] hover:underline">Catalogue &amp; products</Link></li>
              <li><Link to="/vendor/wallet" className="font-semibold text-[#1B4332] hover:underline">Wallet &amp; earnings</Link></li>
              <li><Link to="/vendor/settings" className="font-semibold text-[#1B4332] hover:underline">Shop settings</Link></li>
            </ul>
          </div>
          <div className="card-base p-6">
            <div className="flex items-center gap-2 text-sm text-[#4A4A4A]">
              <Clock className="h-4 w-4" />
              Support hours: Mon–Sun, 7:00 AM – 10:00 PM
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-heading text-lg font-semibold">Vendor FAQ</h3>
        {VENDOR_FAQ.map(({ q, a, icon: Icon }, i) => (
          <div key={q} className="card-base overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <Icon className="h-4 w-4 shrink-0 text-[#1B4332]" />
              <span className="flex-1 text-sm font-semibold">{q}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
            </button>
            {openFaq === i && (
              <div className="border-t px-4 pb-4 pt-3 text-sm text-[#4A4A4A]">{a}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">{label}</label>
      {children}
    </div>
  );
}
