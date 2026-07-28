import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await login(email.trim().toLowerCase(), password);
    setLoading(false);
    if (res.ok) {
      toast.success(`Welcome back, ${res.user.name.split(" ")[0]}!`);
      const roleHome = res.user.role === "admin" ? "/admin" : res.user.role === "vendor" ? "/vendor" : "/";
      const from = location.state?.from || roleHome;
      navigate(from, { replace: true });
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="container-app grid min-h-[80vh] place-items-center py-12">
      <div className="w-full max-w-md" data-testid="login-page">
        <div className="card-base p-8">
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">Welcome back</h1>
          <p className="mt-1 text-sm text-[#4A4A4A]">Sign in to your Ambajogai Grocery account</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-base"
                placeholder="you@example.com"
                data-testid="login-email"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-base"
                placeholder="••••••••"
                data-testid="login-password"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full" data-testid="login-submit">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#4A4A4A]">
            No account?{" "}
            <Link to="/register" className="font-semibold text-[#1B4332] hover:text-[#E07A5F]">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
