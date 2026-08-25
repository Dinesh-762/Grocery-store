import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  LockKeyhole,
  Smartphone,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { api, formatApiError } from "@/lib/api";

export default function ForgotPassword() {
  const navigate = useNavigate();

  // 1 = choose method / enter identifier
  // 2 = enter OTP + new password
  const [step, setStep] = useState(1);

  // phone / email
  const [method, setMethod] = useState("phone");

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);

  // =========================================================
  // STEP 1 — REQUEST OTP
  // =========================================================
  const requestOtp = async (e) => {
    e.preventDefault();

    if (method === "phone") {
      const cleanPhone = phone.trim();

      if (!/^\d{10}$/.test(cleanPhone)) {
        toast.error("Please enter a valid 10-digit phone number.");
        return;
      }
    }

    if (method === "email") {
      const cleanEmail = email.trim().toLowerCase();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        toast.error("Please enter a valid email address.");
        return;
      }
    }

    setLoading(true);

    try {
      const payload =
        method === "phone"
          ? {
              method: "phone",
              phone: phone.trim(),
            }
          : {
              method: "email",
              email: email.trim().toLowerCase(),
            };

      const response = await api.post(
        "/auth/password-reset/request",
        payload
      );

      toast.success(
        response.data?.message || "OTP generated successfully."
      );

      // Current backend returns mock OTP for development.
      if (response.data?.debug_code) {
        toast.info(`Your OTP is ${response.data.debug_code}`, {
          duration: 10000,
        });
      }

      setOtp("");
      setNewPassword("");
      setConfirmPassword("");

      setStep(2);
    } catch (err) {
      toast.error(
        formatApiError(
          err,
          "Unable to send OTP. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // STEP 2 — VERIFY OTP + RESET PASSWORD
  // =========================================================
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
      const payload =
        method === "phone"
          ? {
              method: "phone",
              phone: phone.trim(),
              code: cleanOtp,
              new_password: newPassword,
            }
          : {
              method: "email",
              email: email.trim().toLowerCase(),
              code: cleanOtp,
              new_password: newPassword,
            };

      const response = await api.post(
        "/auth/password-reset",
        payload
      );

      toast.success(
        response.data?.message ||
          "Password reset successfully!"
      );

      navigate("/login", { replace: true });
    } catch (err) {
      toast.error(
        formatApiError(
          err,
          "Unable to reset password. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // CHANGE METHOD
  // =========================================================
  const changeMethod = () => {
    setStep(1);
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
  };

  // =========================================================
  // CHANGE IDENTIFIER
  // =========================================================
  const changeIdentifier = () => {
    setStep(1);
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="container-app grid min-h-[80vh] place-items-center py-12">
      <div
        className="w-full max-w-md"
        data-testid="forgot-password-page"
      >
        <div className="card-base p-8">

          {/* =================================================
              HEADER
          ================================================= */}
          <div className="mb-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#1B4332]/10">
              <LockKeyhole className="h-6 w-6 text-[#1B4332]" />
            </div>

            <h1 className="font-heading text-2xl font-bold sm:text-3xl">
              Forgot Password?
            </h1>

            <p className="mt-2 text-sm leading-6 text-[#4A4A4A]">
              {step === 1
                ? "Choose how you want to reset your Ambajogai Grocery account password."
                : "Enter the OTP and create a new password for your account."}
            </p>
          </div>

          {/* =================================================
              STEP 1
          ================================================= */}
          {step === 1 && (
            <form
              onSubmit={requestOtp}
              className="space-y-5"
            >

              {/* METHOD SELECTOR */}
              <div>
                <label className="mb-2 block text-xs font-semibold text-[#4A4A4A]">
                  Reset using
                </label>

                <div className="grid grid-cols-2 gap-3">

                  {/* PHONE OPTION */}
                  <button
                    type="button"
                    onClick={() => setMethod("phone")}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      method === "phone"
                        ? "border-[#1B4332] bg-[#1B4332] text-white"
                        : "border-black/10 bg-white text-[#4A4A4A] hover:border-[#1B4332]/40"
                    }`}
                    data-testid="forgot-phone-method"
                  >
                    <Smartphone className="h-4 w-4" />
                    Mobile
                  </button>

                  {/* EMAIL OPTION */}
                  <button
                    type="button"
                    onClick={() => setMethod("email")}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      method === "email"
                        ? "border-[#1B4332] bg-[#1B4332] text-white"
                        : "border-black/10 bg-white text-[#4A4A4A] hover:border-[#1B4332]/40"
                    }`}
                    data-testid="forgot-email-method"
                  >
                    <Mail className="h-4 w-4" />
                    Email
                  </button>

                </div>
              </div>

              {/* PHONE INPUT */}
              {method === "phone" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
                    Registered Mobile Number
                  </label>

                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    required
                    value={phone}
                    onChange={(e) =>
                      setPhone(
                        e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 10)
                      )
                    }
                    className="input-base"
                    placeholder="Enter 10-digit mobile number"
                    data-testid="forgot-phone-input"
                  />

                  <p className="mt-1.5 text-xs text-[#777]">
                    Enter the mobile number linked to your account.
                  </p>
                </div>
              )}

              {/* EMAIL INPUT */}
              {method === "email" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
                    Registered Email Address
                  </label>

                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    className="input-base"
                    placeholder="you@example.com"
                    data-testid="forgot-email-input"
                  />

                  <p className="mt-1.5 text-xs text-[#777]">
                    Enter the email address linked to your account.
                  </p>
                </div>
              )}

              {/* SEND OTP */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex w-full items-center justify-center gap-2"
                data-testid="forgot-send-otp"
              >
                {loading && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

                {loading
                  ? "Sending OTP..."
                  : "Send OTP"}
              </button>
            </form>
          )}

          {/* =================================================
              STEP 2
          ================================================= */}
          {step === 2 && (
            <form
              onSubmit={resetPassword}
              className="space-y-5"
            >

              {/* ACCOUNT IDENTIFIER */}
              <div className="rounded-xl bg-[#1B4332]/5 p-4">

                <div className="flex items-center gap-2">
                  {method === "phone" ? (
                    <Smartphone className="h-4 w-4 text-[#1B4332]" />
                  ) : (
                    <Mail className="h-4 w-4 text-[#1B4332]" />
                  )}

                  <p className="text-xs font-semibold text-[#4A4A4A]">
                    OTP sent to
                  </p>
                </div>

                <p className="mt-1 break-all text-sm font-bold text-[#1B4332]">
                  {method === "phone"
                    ? phone
                    : email}
                </p>

                <button
                  type="button"
                  onClick={changeIdentifier}
                  className="mt-2 text-xs font-semibold text-[#1B4332] hover:text-[#E07A5F]"
                >
                  Change {method === "phone" ? "mobile number" : "email"}
                </button>

              </div>

              {/* OTP */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
                  6-Digit OTP
                </label>

                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) =>
                    setOtp(
                      e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6)
                    )
                  }
                  className="input-base text-center tracking-[0.4em]"
                  placeholder="000000"
                  data-testid="forgot-otp-input"
                />

                <p className="mt-1.5 text-xs text-[#777]">
                  OTP is valid for 5 minutes.
                </p>
              </div>

              {/* NEW PASSWORD */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
                  New Password
                </label>

                <input
                  type="password"
                  required
                  minLength={6}
                  maxLength={128}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) =>
                    setNewPassword(e.target.value)
                  }
                  className="input-base"
                  placeholder="Enter new password"
                  data-testid="forgot-new-password"
                />
              </div>

              {/* CONFIRM PASSWORD */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
                  Confirm New Password
                </label>

                <input
                  type="password"
                  required
                  minLength={6}
                  maxLength={128}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  className="input-base"
                  placeholder="Confirm new password"
                  data-testid="forgot-confirm-password"
                />
              </div>

              {/* RESET BUTTON */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex w-full items-center justify-center gap-2"
                data-testid="forgot-reset-password"
              >
                {loading && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

                {loading
                  ? "Resetting Password..."
                  : "Reset Password"}
              </button>

              {/* CHANGE METHOD */}
              <button
                type="button"
                onClick={changeMethod}
                className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-[#1B4332] hover:text-[#E07A5F]"
              >
                <ArrowLeft className="h-4 w-4" />
                Use another method
              </button>
            </form>
          )}

          {/* =================================================
              BACK TO LOGIN
          ================================================= */}
          <div className="mt-6 border-t border-black/10 pt-5 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#1B4332] hover:text-[#E07A5F]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}