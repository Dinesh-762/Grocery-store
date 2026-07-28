import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MapPin, Phone, Mail, Clock, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export default function Contact() {
  const [store, setStore] = useState({ whatsapp: "+918237214975", email: "ambajogaigrocerystores@gmail.com" });
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  useEffect(() => {
    api.get("/store/info").then(({ data }) => setStore(data)).catch(() => {});
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) return toast.error("Fill required fields");
    const num = store.whatsapp.replace(/[^\d]/g, "");
    const msg = encodeURIComponent(`Hi, I'm ${form.name}${form.email ? ` (${form.email})` : ""}.\n\n${form.message}`);
    window.open(`https://wa.me/${num}?text=${msg}`, "_blank");
    toast.success("Opening WhatsApp…");
    setForm({ name: "", email: "", message: "" });
  };

  return (
    <div className="container-app py-12" data-testid="contact-page">
      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <h1 className="font-heading text-4xl font-bold sm:text-5xl">Say hello.</h1>
          <p className="mt-4 text-base leading-relaxed text-[#4A4A4A]">
            Got a question, a bulk order, or feedback? We reply within minutes on WhatsApp.
          </p>

          <ul className="mt-8 space-y-5">
            <ContactItem icon={MapPin} title="Visit us" body="Main Road, Ambajogai, Maharashtra 431517" />
            <ContactItem icon={Phone} title="Call" body={store.whatsapp} />
            <ContactItem icon={Mail} title="Email" body={store.email} />
            <ContactItem icon={Clock} title="Open hours" body="Mon–Sun, 7:00 AM – 10:00 PM" />
          </ul>

          <a
            href={`https://wa.me/${store.whatsapp.replace(/[^\d]/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-8 inline-flex bg-[#25D366] hover:bg-[#20b859]"
            data-testid="whatsapp-cta"
          >
            <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
          </a>
        </div>

        <form onSubmit={submit} className="card-base h-fit p-8" data-testid="contact-form">
          <h2 className="font-heading text-2xl font-semibold">Send a message</h2>
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-base" data-testid="contact-name" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Email (optional)</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-base" data-testid="contact-email" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Message</label>
              <textarea rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="input-base resize-none" data-testid="contact-message" />
            </div>
            <button type="submit" className="btn-primary w-full" data-testid="contact-submit">
              Send via WhatsApp
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ContactItem({ icon: Icon, title, body }) {
  return (
    <li className="flex items-start gap-4">
      <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-[#1B4332]/10 text-[#1B4332]">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-sm text-[#4A4A4A]">{body}</div>
      </div>
    </li>
  );
}
