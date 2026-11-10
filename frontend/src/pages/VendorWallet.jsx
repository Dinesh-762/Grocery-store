import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatINR, formatApiError } from "@/lib/api";
import { Loader2, Wallet, ArrowRight } from "lucide-react";

export default function VendorWallet() {
  const [wallet, setWallet] = useState(null);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/vendor/wallet"), api.get("/vendor/wallet/transactions")])
      .then(([w, t]) => {
        setWallet(w.data);
        setTxs(t.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  const cards = [
    { label: "Available balance", value: formatINR(wallet?.available_balance || 0), color: "text-[#1B4332]" },
    { label: "Pending balance", value: formatINR(wallet?.pending_balance || 0), color: "text-[#F4A261]" },
    { label: "Referral earnings", value: formatINR(wallet?.referral_earnings || 0), color: "text-[#8BA888]" },
    { label: "Total paid out", value: formatINR(wallet?.total_paid_out || 0), color: "text-[#4A4A4A]" },
  ];

  return (
    <div className="space-y-8" data-testid="vendor-wallet">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#1B4332] text-white">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-heading text-2xl font-semibold">Wallet</h2>
            <p className="text-xs text-[#4A4A4A]">Track earnings and balances</p>
          </div>
        </div>
        <Link to="/vendor/payouts" className="btn-primary">
          Request payout <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card-base p-5">
            <div className="text-xs uppercase tracking-wider text-[#4A4A4A]">{c.label}</div>
            <div className={`mt-1 font-heading text-2xl font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="card-base overflow-hidden">
        <div className="border-b border-[#E5E5E5] px-5 py-4">
          <h3 className="font-heading text-lg font-semibold">Transaction history</h3>
        </div>
        {txs.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#4A4A4A]">No transactions yet. Earnings appear when orders are delivered.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-[#4A4A4A]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id} className="border-t border-[#E5E5E5]">
                    <td className="px-4 py-3 text-xs">{new Date(t.created_at).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3 capitalize">{t.transaction_type?.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3">{t.description}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${t.amount >= 0 ? "text-[#1B4332]" : "text-red-600"}`}>
                      {t.amount >= 0 ? "+" : ""}{formatINR(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
