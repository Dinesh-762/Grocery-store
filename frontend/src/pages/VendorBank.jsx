import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Landmark } from "lucide-react";

export default function VendorBank() {
  const [form, setForm] = useState({
    account_holder_name: "",
    bank_name: "",
    account_number: "",
    ifsc_code: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/vendor/settings")
      .then(({ data }) => {
        const b = data.bank_details || {};
        setForm({
          account_holder_name: b.account_holder_name || "",
          bank_name: b.bank_name || "",
          account_number: b.account_number || "",
          ifsc_code: b.ifsc_code || "",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const up = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/vendor/bank-details", { bank_details: form });
      toast.success("Bank details saved");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  return (
    <div className="mx-auto max-w-xl space-y-6" data-testid="vendor-bank">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#8BA888] text-white">
          <Landmark className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-heading text-2xl font-semibold">Bank details</h2>
          <p className="text-xs text-[#4A4A4A]">Used for payout transfers. Kept secure.</p>
        </div>
      </div>

      <form onSubmit={save} className="card-base space-y-4 p-6">
        <Field label="Account holder name" value={form.account_holder_name} onChange={up("account_holder_name")} required />
        <Field label="Bank name" value={form.bank_name} onChange={up("bank_name")} required />
        <Field label="Account number" value={form.account_number} onChange={up("account_number")} required />
        <Field label="IFSC code" value={form.ifsc_code} onChange={up("ifsc_code")} required placeholder="SBIN0001234" />
        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save bank details
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, ...rest }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">{label}</label>
      <input className="input-base" {...rest} />
    </div>
  );
}
