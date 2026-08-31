import { useEffect, useState } from "react";
import { toast } from "sonner";
import ProfileSection from "@/pages/ProfileSection";

const PREFS_KEY = "ambajogai_notif_prefs";

const defaultPrefs = {
  orderUpdates: true,
  offers: true,
  deliveryAlerts: true,
};

export default function ProfileNotifications() {
  const [prefs, setPrefs] = useState(defaultPrefs);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      if (saved) setPrefs({ ...defaultPrefs, ...JSON.parse(saved) });
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = (key) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    toast.success("Notification preference saved");
  };

  const rows = [
    { key: "orderUpdates", label: "Order updates", desc: "Status changes for your orders" },
    { key: "offers", label: "Offers & deals", desc: "Promotions and discounts" },
    { key: "deliveryAlerts", label: "Delivery alerts", desc: "When your order is out for delivery" },
  ];

  return (
    <ProfileSection
      title="Notifications"
      description="Choose what you'd like to be notified about."
    >
      <div className="card-base divide-y divide-[#E5E5E5]">
        {rows.map((row) => (
          <label
            key={row.key}
            className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4"
          >
            <div>
              <div className="text-sm font-medium text-[#1A1A1A]">{row.label}</div>
              <div className="text-xs text-[#4A4A4A]">{row.desc}</div>
            </div>
            <input
              type="checkbox"
              checked={!!prefs[row.key]}
              onChange={() => toggle(row.key)}
              className="h-4 w-4 accent-[#1B4332]"
            />
          </label>
        ))}
      </div>
    </ProfileSection>
  );
}
