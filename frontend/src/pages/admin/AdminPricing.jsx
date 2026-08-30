import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

export default function AdminPricing() {
  const [settings, setSettings] = useState(null);
  const [rules, setRules] = useState([]);
  const [saving, setSaving] = useState(false);
  const [newRule, setNewRule] = useState({ rule_type: "category", target_id: "", markup_pct: 25, active: true });

  const load = () => {
    Promise.all([api.get("/admin/platform-settings"), api.get("/admin/pricing-rules")])
      .then(([s, r]) => {
        setSettings(s.data);
        setRules(r.data);
      })
      .catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const saveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.patch("/admin/platform-settings", settings);
      setSettings(data);
      toast.success("Platform settings saved — customer prices will update dynamically");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const addRule = async () => {
    try {
      await api.post("/admin/pricing-rules", newRule);
      toast.success("Pricing rule added");
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const toggleRule = async (id, active) => {
    await api.patch(`/admin/pricing-rules/${id}`, { active });
    load();
  };

  const deleteRule = async (id) => {
    if (!window.confirm("Delete this rule?")) return;
    await api.delete(`/admin/pricing-rules/${id}`);
    load();
  };

  if (!settings) return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;

  const fields = [
    { key: "global_markup_pct", label: "Global markup (%)", step: "0.1" },
    { key: "gst_rate", label: "GST rate (decimal, e.g. 0.05)", step: "0.001" },
    { key: "platform_fee", label: "Platform fee (₹)", step: "1" },
    { key: "free_delivery_threshold", label: "Free delivery above (₹)", step: "1" },
    { key: "delivery_near_fee", label: "Base delivery fee (₹)", step: "1" },
    { key: "delivery_per_km", label: "Per km fee (₹)", step: "1" },
    { key: "min_payout_amount", label: "Min payout (₹)", step: "1" },
    { key: "settlement_days", label: "Settlement days", step: "1" },
    { key: "referral_reward_amount", label: "Referral reward (₹)", step: "1" },
  ];

  return (
    <div className="space-y-8" data-testid="admin-pricing">
      <div>
        <h2 className="font-heading text-2xl font-semibold">Pricing &amp; Platform Settings</h2>
        <p className="mt-1 text-sm text-[#4A4A4A]">
          Control customer-facing prices. Vendor base prices + markup = selling price before tax &amp; delivery.
        </p>
      </div>

      <form onSubmit={saveSettings} className="card-base p-6">
        <h3 className="font-heading text-lg font-semibold">Global settings</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">{f.label}</label>
              <input
                type="number"
                step={f.step}
                value={settings[f.key] ?? ""}
                onChange={(e) => setSettings({ ...settings, [f.key]: parseFloat(e.target.value) })}
                className="input-base"
              />
            </div>
          ))}
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={!!settings.product_approval_required}
              onChange={(e) => setSettings({ ...settings, product_approval_required: e.target.checked })}
            />
            <span className="text-sm">Require admin approval for vendor product changes</span>
          </label>
        </div>
        <div className="mt-6 flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save settings
          </button>
        </div>
      </form>

      <div className="card-base p-6">
        <h3 className="font-heading text-lg font-semibold">Pricing rules</h3>
        <p className="mt-1 text-xs text-[#4A4A4A]">Priority: Product → Vendor → Subcategory → Category → Global</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <select value={newRule.rule_type} onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value })} className="input-base">
            <option value="global">Global</option>
            <option value="category">Category</option>
            <option value="subcategory">Subcategory</option>
            <option value="vendor">Vendor</option>
            <option value="product">Product</option>
          </select>
          <input placeholder="Target ID (slug/vendor_id/product_id)" value={newRule.target_id} onChange={(e) => setNewRule({ ...newRule, target_id: e.target.value })} className="input-base" />
          <input type="number" placeholder="Markup %" value={newRule.markup_pct} onChange={(e) => setNewRule({ ...newRule, markup_pct: parseFloat(e.target.value) })} className="input-base" />
          <button type="button" onClick={addRule} className="btn-primary"><Plus className="h-4 w-4" /> Add rule</button>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-[#4A4A4A]">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Markup %</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 capitalize">{r.rule_type}</td>
                  <td className="px-3 py-2">{r.target_id || "—"}</td>
                  <td className="px-3 py-2 font-semibold">{r.markup_pct}%</td>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={r.active} onChange={(e) => toggleRule(r.id, e.target.checked)} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => deleteRule(r.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
