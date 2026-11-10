import { useEffect, useState } from "react";
import { api, formatINR } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Gift, Copy, Check } from "lucide-react";

export default function VendorRefer() {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get("/vendor/referrals").then(({ data: d }) => setData(d)).catch(() => {});
  }, []);

  const copyLink = () => {
    const url = `${window.location.origin}/become-vendor?ref=${data?.referral_code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!data) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  const stats = [
    { label: "Total referrals", value: data.total_referrals },
    { label: "Pending", value: data.pending_referrals },
    { label: "Approved", value: data.approved_referrals },
    { label: "Earnings", value: formatINR(data.referral_earnings) },
  ];

  return (
    <div className="space-y-8" data-testid="vendor-refer">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#E07A5F] text-white">
          <Gift className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-heading text-2xl font-semibold">Refer &amp; Earn</h2>
          <p className="text-xs text-[#4A4A4A]">Invite other vendors and earn rewards when they get approved</p>
        </div>
      </div>

      <div className="card-base p-6">
        <div className="text-xs uppercase tracking-wider text-[#4A4A4A]">Your referral code</div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="font-heading text-3xl font-bold tracking-wider text-[#1B4332]">{data.referral_code}</span>
          <button type="button" onClick={copyLink} className="btn-secondary">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copy link
          </button>
        </div>
        <p className="mt-3 text-sm text-[#4A4A4A]">
          Share: <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">{window.location.origin}/become-vendor?ref={data.referral_code}</code>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card-base p-5">
            <div className="text-xs uppercase tracking-wider text-[#4A4A4A]">{s.label}</div>
            <div className="mt-1 font-heading text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {data.referrals?.length > 0 && (
        <div className="card-base overflow-hidden">
          <div className="border-b px-5 py-4 font-heading text-lg font-semibold">Referral activity</div>
          <div className="divide-y">
            {data.referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-[#4A4A4A]">{new Date(r.created_at).toLocaleDateString("en-IN")}</span>
                <span className="capitalize">{r.status}</span>
                {r.reward_amount ? <span className="font-semibold text-[#1B4332]">{formatINR(r.reward_amount)}</span> : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
