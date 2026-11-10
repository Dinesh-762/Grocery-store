import { useEffect, useState } from "react";
import { api, formatINR } from "@/lib/api";
import {
  Loader2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Palmtree,
} from "lucide-react";

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api
      .get("/vendor/dashboard")
      .then(({ data }) => setData(data))
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />
    );
  }

  const stats = [
    { label: "Base sales", value: formatINR(data.base_sales ?? 0), color: "bg-[#1B4332]" },
    { label: "Available balance", value: formatINR(data.wallet?.available_balance ?? 0), color: "bg-[#8BA888]" },
    { label: "Total orders", value: data.total_orders, color: "bg-[#E07A5F]" },
    { label: "Pending orders", value: data.pending_orders, color: "bg-[#F4A261]" },
    { label: "Delivered", value: data.delivered_orders ?? 0, color: "bg-[#1B4332]" },
    { label: "Products live", value: data.approved_products, color: "bg-[#8BA888]" },
  ];

  return (
    <div className="space-y-8" data-testid="vendor-dashboard">

      <div className="card-base p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">

          <div>
            <div className="text-xs uppercase tracking-wider text-[#4A4A4A]">
              Signed in as
            </div>

            <div className="mt-1 font-heading text-2xl font-bold">
              {data.vendor.business_name}
            </div>

            <div className="text-sm text-[#4A4A4A]">
              {data.vendor.owner_email} · {data.vendor.phone}
            </div>
          </div>


          {data.vendor.vacation_mode ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
              <Palmtree className="h-3.5 w-3.5" />
              Temporarily Closed
            </span>
          ) : data.vendor.open_now === false ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700">
              <Clock className="h-3.5 w-3.5" />
              Closed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Open now
            </span>
          )}

        </div>
      </div>


      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {stats.map((s) => (
          <div key={s.label} className="card-base p-5">

            <div className={`h-1.5 w-10 rounded-full ${s.color}`} />

            <div className="mt-4 text-xs uppercase tracking-wider text-[#4A4A4A]">
              {s.label}
            </div>

            <div className="mt-1 font-heading text-2xl font-bold">
              {s.value}
            </div>

          </div>
        ))}

      </div>


      {data.pending_products > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-[#F4A261] bg-[#F4A261]/10 p-4">

          <Clock className="mt-0.5 h-5 w-5 text-[#F4A261]" />

          <div className="text-sm">
            <span className="font-semibold">
              {data.pending_products} product(s)
            </span>{" "}
            are pending admin approval.
          </div>

        </div>
      )}


      {data.low_stock.length > 0 && (
        <div className="card-base p-6">

          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#E07A5F]" />
            <h3 className="font-heading text-lg font-semibold">
              Low stock
            </h3>
          </div>


          <div className="space-y-3">

            {data.low_stock.map((p)=>(
              <div key={p.id} className="flex items-center gap-3">

                <img
                  src={p.image}
                  alt=""
                  className="h-10 w-10 rounded-lg object-cover"
                />

                <div className="flex-1">
                  <div className="text-sm font-semibold">
                    {p.name}
                  </div>

                  <div className="text-xs text-[#4A4A4A]">
                    {p.unit}
                  </div>
                </div>

                <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold">
                  {p.stock} left
                </span>

              </div>
            ))}

          </div>

        </div>
      )}

    </div>
  );
}