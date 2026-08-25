import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function WhatsAppFloat() {
  const [phone, setPhone] = useState(null);

  useEffect(() => {
    api.get("/store/info").then(({ data }) => setPhone(data.whatsapp)).catch(() => {});
  }, []);

  if (!phone) return null;
  const num = phone.replace(/[^\d]/g, "");
  const msg = encodeURIComponent("Hi! I'd like to enquire about groceries.");

  return (
    <a
      href={`https://wa.me/${num}?text=${msg}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="whats-pulse fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110"
      data-testid="whatsapp-float"
    >
      <MessageCircle className="h-6 w-6 fill-white" />
    </a>
  );
}
