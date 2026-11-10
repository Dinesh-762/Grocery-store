import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import { Loader2, Clock, XCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function VendorVerification() {
  const { logout } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/vendor/verification-status").then(({ data: d }) => setData(d)).catch(() => {});
  }, []);

  if (!data) {
    return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;
  }

  const { status, rejection_reason, vendor } = data;

  if (status === "Approved") {
    return null;
  }

  const isRejected = status === "Rejected";

  return (
    <div className="container-app flex min-h-[60vh] items-center justify-center py-12" data-testid="vendor-verification">
      <div className="card-base max-w-lg p-10 text-center">
        <div className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${isRejected ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
          {isRejected ? <XCircle className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
        </div>
        <h1 className="mt-6 font-heading text-2xl font-bold">
          {isRejected ? "Application rejected" : "Verification pending"}
        </h1>
        <p className="mt-3 text-sm text-[#4A4A4A]">
          {isRejected
            ? rejection_reason || "Your vendor application was not approved. Contact support for details."
            : "Your application for " + (vendor?.business_name || "your shop") + " is under admin review. You'll get full dashboard access once approved."}
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-1.5 text-xs font-semibold">
          Status: {status}
        </div>
        {!isRejected && (
          <p className="mt-4 text-xs text-[#4A4A4A]">
            Typical review time: within 24 hours. Ensure your documents were submitted correctly.
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={logout} className="btn-secondary">Log out</button>
          <Link to="/vendor/support" className="btn-primary">Contact support</Link>
        </div>
      </div>
    </div>
  );
}

export function VendorGate({ children }) {
  const location = useLocation();
  const [approved, setApproved] = useState(null);
  const onSupportPage = location.pathname === "/vendor/support";

  useEffect(() => {
    api.get("/vendor/verification-status")
      .then(({ data }) => setApproved(data.can_access_dashboard))
      .catch(() => setApproved(false));
  }, []);

  if (onSupportPage) {
    return children;
  }

  if (approved === null) {
    return <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1B4332]" />;
  }

  if (!approved) {
    return <VendorVerification />;
  }

  return children;
}
