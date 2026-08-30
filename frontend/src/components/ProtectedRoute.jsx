import { Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

function AccessDenied({ title, message, userEmail }) {
  const { logout } = useAuth();

  return (
    <div
      className="container-app flex min-h-[50vh] flex-col items-center justify-center py-16 text-center"
      data-testid="access-denied"
    >
      <h2 className="font-heading text-2xl font-bold text-[#1A1A1A]">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm text-[#4A4A4A]">{message}</p>
      {userEmail && (
        <p className="mt-1 text-xs text-[#4A4A4A]">
          Signed in as <strong>{userEmail}</strong>
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            logout();
            window.location.href = "/login";
          }}
          className="btn-primary"
        >
          Log out &amp; switch account
        </button>
        <Link to="/" className="btn-secondary">
          Back to store
        </Link>
      </div>
    </div>
  );
}

export default function ProtectedRoute({
  children,
  adminOnly = false,
  vendorOnly = false,
  deliveryOnly = false,
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        className="flex min-h-[50vh] items-center justify-center"
        data-testid="protected-loading"
      >
        <Loader2 className="h-8 w-8 animate-spin text-[#1B4332]" />
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  if (adminOnly && user.role !== "admin") {
    return (
      <AccessDenied
        title="Admin access required"
        message="You need an admin account to open the admin panel. Log out and sign in with admin@ambajogai.com (or your admin credentials)."
        userEmail={user.email}
      />
    );
  }

  if (vendorOnly && user.role !== "vendor") {
    return (
      <AccessDenied
        title="Vendor access required"
        message="This area is only for approved vendor accounts."
        userEmail={user.email}
      />
    );
  }

  if (deliveryOnly && user.role !== "delivery") {
    return (
      <AccessDenied
        title="Delivery partner access required"
        message="This area is only for delivery partner accounts."
        userEmail={user.email}
      />
    );
  }

  return children;
}
