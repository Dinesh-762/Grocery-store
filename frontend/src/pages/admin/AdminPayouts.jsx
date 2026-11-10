import { useCallback, useEffect, useState } from "react";
import { api, formatINR, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const STATUSES = [
"Pending",
"Approved",
"Processing",
"Paid",
"Failed",
"Rejected",
];

export default function AdminPayouts() {
const [payouts, setPayouts] = useState([]);
const [filter, setFilter] = useState("");
const [loading, setLoading] = useState(true);
const [updatingId, setUpdatingId] = useState(null);

const load = useCallback(() => {
setLoading(true);


api
  .get("/admin/payouts", {
    params: filter ? { status: filter } : {},
  })
  .then(({ data }) => setPayouts(data))
  .catch((err) => toast.error(formatApiError(err)))
  .finally(() => setLoading(false));


}, [filter]);

useEffect(() => {
load();
}, [load]);

const updateStatus = async (id, status) => {
const payload = { status };


if (status === "Paid") {
  const ref = window.prompt("Transaction reference (optional):");

  if (ref === null) return;

  payload.transaction_reference = ref;
}

if (status === "Rejected") {
  const notes = window.prompt("Enter rejection reason (optional):");

  if (notes === null) return;

  payload.notes = notes;
}

setUpdatingId(id);

try {
  await api.patch(`/admin/payouts/${id}/status`, payload);

  toast.success(`Payout status updated to ${status}.`);
  load();
} catch (err) {
  toast.error(formatApiError(err));
} finally {
  setUpdatingId(null);
}


};

if (loading) {
return ( <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />
);
}

return ( <div className="space-y-6" data-testid="admin-payouts"> <div className="flex flex-wrap items-center justify-between gap-4"> <h2 className="font-heading text-2xl font-semibold">
Vendor payouts </h2>


    <select
      value={filter}
      onChange={(e) => setFilter(e.target.value)}
      className="input-base w-44"
    >
      <option value="">All statuses</option>

      {STATUSES.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  </div>

  {payouts.length === 0 ? (
    <div className="rounded-2xl border border-dashed p-10 text-center text-[#4A4A4A]">
      No payout requests.
    </div>
  ) : (
    <div className="space-y-4">
      {payouts.map((p) => (
        <div key={p.id} className="card-base p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-semibold">
                {p.vendor_name || p.vendor_id}
              </div>

              <div className="text-xs text-[#4A4A4A]">
                #{String(p.id).slice(-6).toUpperCase()} ·{" "}
                {new Date(p.created_at).toLocaleString("en-IN")}
              </div>

              {p.bank_account?.account_number && (
                <div className="mt-2 text-xs text-[#4A4A4A]">
                  {p.bank_account.bank_name} · ****
                  {String(p.bank_account.account_number).slice(-4)} ·{" "}
                  {p.bank_account.ifsc_code}
                </div>
              )}
            </div>

            <div className="text-right">
              <div className="font-heading text-2xl font-bold">
                {formatINR(p.amount)}
              </div>

              <div className="mt-1 text-sm font-semibold">
                {p.status}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label
              htmlFor={`payout-status-${p.id}`}
              className="text-sm font-medium"
            >
              Change status:
            </label>

            <select
              id={`payout-status-${p.id}`}
              value={STATUSES.includes(p.status) ? p.status : ""}
              disabled={updatingId === p.id}
              onChange={(e) => {
                const status = e.target.value;

                if (status && status !== p.status) {
                  updateStatus(p.id, status);
                }
              }}
              className="input-base w-44"
            >
              {!STATUSES.includes(p.status) && (
                <option value="" disabled>
                  {p.status}
                </option>
              )}

              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            {updatingId === p.id && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
          </div>
        </div>
      ))}
    </div>
  )}
</div>


);
}
