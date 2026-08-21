import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Mail, KeyRound, Lock } from "lucide-react";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: email, 2: code + new password
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const sendCode = async (e) => {
    e.preventDefault();
    if (!email.trim()) return toast.error("Please enter your email");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
      toast.success("If an account exists, we sent a code to your email.");
      setStep(2);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) return toast.error("Enter the 6-digit code from your email");
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email: email.trim().toLowerCase(),
        code: code.trim(),
        new_password: password,
      });
      toast.success("Password reset. Please sign in with your new password.");
      navigate("/login", { replace: true });
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-app grid min-h-[80vh] place-items-center py-12">
      <div className="w-full max-w-md" data-testid="forgot-password-page">
        <div className="card-base p-8">
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">Forgot password</h1>
          <p className="mt-1 text-sm text-[#4A4A4A]">
            {step === 1
              ? "Enter your registered email — we'll send a 6-digit code."
              : "Enter the code sent to your email and your new password."}
          </p>

          {step === 1 && (
            <form onSubmit={sendCode} className="mt-6 space-y-4" data-testid="forgot-step-1">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-base pl-9"
                    placeholder="you@example.com"
                    data-testid="forgot-email"
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full" data-testid="forgot-send-code">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Sending…" : "Send code"}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={resetPassword} className="mt-6 space-y-4" data-testid="forgot-step-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">6-digit code</label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="input-base pl-9 tracking-[0.5em] text-center font-mono text-lg"
                    placeholder="123456"
                    data-testid="forgot-code"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">New password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-base pl-9"
                    placeholder="At least 6 characters"
                    data-testid="forgot-new-password"
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full" data-testid="forgot-reset">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Resetting…" : "Reset password"}
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-center text-xs text-[#4A4A4A] hover:text-[#1B4332]"
                data-testid="forgot-back"
              >
                Didn&apos;t get the code? Try again
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-[#4A4A4A]">
            Remembered it?{" "}
            <Link to="/login" className="font-semibold text-[#1B4332] hover:text-[#E07A5F]">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
