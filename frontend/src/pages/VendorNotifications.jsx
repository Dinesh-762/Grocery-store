import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Loader2, Bell } from "lucide-react";

export default function VendorNotifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get("/notifications")
      .then(({ data }) => setItems(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const markAllRead = async () => {
    await api.post("/notifications/read-all");
    load();
  };

  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    load();
  };

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  return (
    <div className="space-y-6" data-testid="vendor-notifications">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#1B4332] text-white">
            <Bell className="h-5 w-5" />
          </div>
          <h2 className="font-heading text-2xl font-semibold">Notifications</h2>
        </div>
        {items.some((n) => !n.read) && (
          <button type="button" onClick={markAllRead} className="btn-secondary text-sm">Mark all read</button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E5E5E5] p-10 text-center text-[#4A4A4A]">
          No notifications yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <div
              key={n.id}
              className={`card-base p-4 ${!n.read ? "border-l-4 border-l-[#1B4332]" : "opacity-80"}`}
              onClick={() => !n.read && markRead(n.id)}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{n.title}</div>
                  <div className="mt-1 text-sm text-[#4A4A4A]">{n.body}</div>
                  <div className="mt-2 text-xs text-[#4A4A4A]">
                    {new Date(n.created_at).toLocaleString("en-IN")}
                  </div>
                </div>
                {n.link && (
                  <Link to={n.link} className="text-xs font-semibold text-[#1B4332] hover:underline">View</Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
