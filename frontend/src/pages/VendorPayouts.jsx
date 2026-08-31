import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatINR, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Banknote } from "lucide-react";

const STATUS_COLORS = {
  Pending: "bg-yellow-100 text-yellow-700",
  Approved: "bg-blue-100 text-blue-700",
  Processing: "bg-purple-100 text-purple-700",
  Paid: "bg-green-100 text-green-700",
  Failed: "bg-red-100 text-red-700",
  Rejected: "bg-red-100 text-red-700",
};

export default function VendorPayouts() {
  const [wallet, setWallet] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    Promise.all([api.get("/vendor/wallet"), api.get("/vendor/payouts")])
      .then(([w, p]) => {
        setWallet(w.data);
        setPayouts(p.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const requestPayout = async (e) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!val || val <= 0) return toast.error("Enter a valid amount");
    setSubmitting(true);
    try {
      await api.post("/vendor/payouts/request", { amount: val });
      toast.success("Payout request submitted");
      setAmount("");
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  return (
    <div className="space-y-8" data-testid="vendor-payouts">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#F4A261] text-white">
          <Banknote className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-heading text-2xl font-semibold">Payouts</h2>
          <p className="text-xs text-[#4A4A4A]">
            Available: {formatINR(wallet?.available_balance || 0)}
            {(wallet?.pending_balance ?? 0) > 0 && (
              <> · Pending settlement: {formatINR(wallet.pending_balance)}</>
            )}
          </p>
        </div>
      </div>

      <form onSubmit={requestPayout} className="card-base p-6">
        <h3 className="font-heading text-lg font-semibold">Request payout</h3>
        <p className="mt-1 text-xs text-[#4A4A4A]">
          Ensure <Link to="/vendor/bank" className="font-semibold text-[#1B4332]">bank details</Link> are saved first.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (₹)"
            className="input-base max-w-xs"
            min="1"
            step="0.01"
          />
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit request
          </button>
        </div>
      </form>

      <div className="card-base overflow-hidden">
        <div className="border-b border-[#E5E5E5] px-5 py-4">
          <h3 className="font-heading text-lg font-semibold">Payout history</h3>
        </div>
        {payouts.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#4A4A4A]">No payout requests yet.</p>
        ) : (
          <div className="divide-y divide-[#E5E5E5]">
            {payouts.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div>
                  <div className="font-semibold">#{p.id.slice(-6).toUpperCase()}</div>
                  <div className="text-xs text-[#4A4A4A]">
                    {new Date(p.created_at).toLocaleString("en-IN")} · {p.payment_method}
                  </div>
                  {p.transaction_reference && (
                    <div className="text-xs text-[#4A4A4A]">Ref: {p.transaction_reference}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-heading text-xl font-bold">{formatINR(p.amount)}</div>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[p.status] || "bg-gray-100"}`}>
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
