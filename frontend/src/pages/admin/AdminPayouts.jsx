import { useEffect, useState } from "react";
import { api, formatINR, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const STATUSES = ["Pending", "Approved", "Processing", "Paid", "Failed", "Rejected"];

export default function AdminPayouts() {
  const [payouts, setPayouts] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/admin/payouts", { params: filter ? { status: filter } : {} })
      .then(({ data }) => setPayouts(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id, status) => {
    const payload = { status };
    if (status === "Paid") {
      const ref = window.prompt("Transaction reference (optional):") || "";
      payload.transaction_reference = ref;
    }
    if (status === "Rejected") {
      payload.notes = window.prompt("Rejection reason:") || "";
    }
    try {
      await api.patch(`/admin/payouts/${id}/status`, payload);
      toast.success(`Payout ${status.toLowerCase()}`);
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  return (
    <div className="space-y-6" data-testid="admin-payouts">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-heading text-2xl font-semibold">Vendor payouts</h2>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input-base w-44">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {payouts.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-[#4A4A4A]">No payout requests.</div>
      ) : (
        <div className="space-y-4">
          {payouts.map((p) => (
            <div key={p.id} className="card-base p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">{p.vendor_name || p.vendor_id}</div>
                  <div className="text-xs text-[#4A4A4A]">#{p.id.slice(-6).toUpperCase()} · {new Date(p.created_at).toLocaleString("en-IN")}</div>
                  {p.bank_account?.account_number && (
                    <div className="mt-2 text-xs text-[#4A4A4A]">
                      {p.bank_account.bank_name} · ****{String(p.bank_account.account_number).slice(-4)} · {p.bank_account.ifsc_code}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-heading text-2xl font-bold">{formatINR(p.amount)}</div>
                  <div className="mt-1 text-sm font-semibold">{p.status}</div>
                </div>
              </div>
              {p.status === "Pending" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => updateStatus(p.id, "Approved")} className="btn-secondary text-sm">Approve</button>
                  <button type="button" onClick={() => updateStatus(p.id, "Processing")} className="btn-secondary text-sm">Processing</button>
                  <button type="button" onClick={() => updateStatus(p.id, "Paid")} className="btn-primary text-sm">Mark paid</button>
                  <button type="button" onClick={() => updateStatus(p.id, "Rejected")} className="text-sm text-red-600">Reject</button>
                </div>
              )}
              {p.status === "Approved" && (
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => updateStatus(p.id, "Paid")} className="btn-primary text-sm">Mark paid</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
