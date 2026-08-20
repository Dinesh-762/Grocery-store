import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ArrowLeft, LockKeyhole, Smartphone, Mail } from "lucide-react";
import { api, formatApiError } from "@/lib/api";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [method, setMethod] = useState("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const requestOtp = async (e) => {
    e.preventDefault();
    if (method === "phone" && !/^\d{10}$/.test(phone.trim())) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (method === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const payload = method === "phone"
        ? { method: "phone", phone: phone.trim() }
        : { method: "email", email: email.trim().toLowerCase() };
      const { data } = await api.post("/auth/password-reset/request", payload);
      toast.success(data?.message || "OTP sent successfully.");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setStep(2);
    } catch (err) {
      toast.error(formatApiError(err, "Unable to send OTP. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      toast.error("Please enter the 6-digit OTP.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const verifyPayload = method === "phone"
        ? { method: "phone", phone: phone.trim(), code: cleanOtp }
        : { method: "email", email: email.trim().toLowerCase(), code: cleanOtp };

      const { data: verified } = await api.post("/auth/password-reset/verify", verifyPayload);
      if (!verified?.reset_token) {
        throw new Error("OTP verification failed.");
      }

      await api.post("/auth/password-reset/confirm", {
        reset_token: verified.reset_token,
        new_password: newPassword,
      });

      toast.success("Password reset successfully. Please log in with your new password.");
      navigate("/login", { replace: true });
    } catch (err) {
      toast.error(formatApiError(err, "Unable to reset password. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const changeMethod = () => {
    setStep(1);
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="container-app grid min-h-[80vh] place-items-center py-12">
      <div className="w-full max-w-md" data-testid="forgot-password-page">
        <div className="card-base p-8">
          <div className="mb-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#1B4332]/10">
              <LockKeyhole className="h-6 w-6 text-[#1B4332]" />
            </div>
            <h1 className="font-heading text-2xl font-bold sm:text-3xl">Forgot Password?</h1>
            <p className="mt-2 text-sm leading-6 text-[#4A4A4A]">
              {step === 1
                ? "Choose mobile or email to receive your password reset OTP."
                : "Enter the OTP and create a new password."}
            </p>
          </div>

          {step === 1 ? (
            <form onSubmit={requestOtp} className="space-y-5">
              <div>
                <label className="mb-2 block text-xs font-semibold text-[#4A4A4A]">Reset using</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setMethod("phone")} className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${method === "phone" ? "border-[#1B4332] bg-[#1B4332] text-white" : "border-black/10 bg-white text-[#4A4A4A]"}`}>
                    <Smartphone className="h-4 w-4" /> Mobile
                  </button>
                  <button type="button" onClick={() => setMethod("email")} className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${method === "email" ? "border-[#1B4332] bg-[#1B4332] text-white" : "border-black/10 bg-white text-[#4A4A4A]"}`}>
                    <Mail className="h-4 w-4" /> Email
                  </button>
                </div>
              </div>

              {method === "phone" ? (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Mobile number</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile number" inputMode="numeric" className="input-base w-full" autoComplete="tel" />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Email address</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" className="input-base w-full" autoComplete="email" />
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-50">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Sending OTP..." : "Send OTP"}
              </button>
            </form>
          ) : (
            <form onSubmit={resetPassword} className="space-y-5">
              <div className="rounded-xl bg-[#1B4332]/5 p-3 text-sm text-[#1B4332]">
                OTP sent to your registered {method === "phone" ? "mobile number" : "email address"}.
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">6-digit OTP</label>
                <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="Enter OTP" className="input-base w-full text-center tracking-[0.35em]" autoComplete="one-time-code" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">New password</label>
                <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" className="input-base w-full" autoComplete="new-password" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">Confirm new password</label>
                <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" className="input-base w-full" autoComplete="new-password" />
              </div>

              <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-50">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Resetting password..." : "Reset Password"}
              </button>

              <button type="button" onClick={changeMethod} className="w-full text-sm font-semibold text-[#1B4332] hover:underline">
                Use a different method
              </button>
            </form>
          )}

          <div className="mt-6 border-t border-black/10 pt-5">
            <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-[#1B4332]">
              <ArrowLeft className="h-4 w-4" /> Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
