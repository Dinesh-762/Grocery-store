import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  LockKeyhole,
  Smartphone,
  Mail,
} from "lucide-react";
import { api, formatApiError } from "@/lib/api";

export default function ForgotPassword() {
  const navigate = useNavigate();

  // 1 = choose recovery method
  // 2 = enter OTP + new password
  const [step, setStep] = useState(1);

  // Recovery method
  const [method, setMethod] = useState("phone");

  // User identifier
  const [identifier, setIdentifier] = useState("");

  // OTP and password
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // STEP 1 — Request OTP
  // ---------------------------------------------------------------------------

  const requestOtp = async (e) => {
    e.preventDefault();

    const cleanIdentifier = identifier.trim();

    // Validate phone
    if (method === "phone") {
      if (!/^\d{10}$/.test(cleanIdentifier)) {
        toast.error("Please enter a valid 10-digit mobile number.");
        return;
      }
    }

    // Validate email
    if (method === "email") {
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          cleanIdentifier
        )
      ) {
        toast.error("Please enter a valid email address.");
        return;
      }
    }

    setLoading(true);

    try {
      const response = await api.post(
        "/auth/password-reset/request",
        {
          method,
          identifier:
            method === "email"
              ? cleanIdentifier.toLowerCase()
              : cleanIdentifier,
        }
      );

      toast.success(
        response.data?.message ||
          "OTP generated successfully."
      );

      // Current backend uses mock OTP for development.
      // Remove this once real SMS/email OTP is connected.
      if (response.data?.debug_code) {
        toast.info(
          `Your OTP is ${response.data.debug_code}`,
          {
            duration: 10000,
          }
        );
      }

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

  // ---------------------------------------------------------------------------
  // STEP 2 — Verify OTP and reset password
  // ---------------------------------------------------------------------------

  const resetPassword = async (e) => {
    e.preventDefault();

    const cleanIdentifier = identifier.trim();
    const cleanOtp = otp.trim();

    if (!/^\d{6}$/.test(cleanOtp)) {
      toast.error("Please enter the 6-digit OTP.");
      return;
    }

    if (newPassword.length < 6) {
      toast.error(
        "Password must be at least 6 characters."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post(
        "/auth/password-reset",
        {
          method,
          identifier:
            method === "email"
              ? cleanIdentifier.toLowerCase()
              : cleanIdentifier,
          code: cleanOtp,
          new_password: newPassword,
        }
      );

      toast.success(
        response.data?.message ||
          "Password reset successfully!"
      );

      navigate("/login", {
        replace: true,
      });
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

  // ---------------------------------------------------------------------------
  // Change recovery method
  // ---------------------------------------------------------------------------

  const changeMethod = () => {
    setStep(1);
    setIdentifier("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
  };

  // ---------------------------------------------------------------------------
  // Change method while on step 1
  // ---------------------------------------------------------------------------

  const selectMethod = (selectedMethod) => {
    setMethod(selectedMethod);
    setIdentifier("");
  };

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  return (
    <div className="container-app grid min-h-[80vh] place-items-center py-12">
      <div
        className="w-full max-w-md"
        data-testid="forgot-password-page"
      >
        <div className="card-base p-8">

          {/* ---------------------------------------------------------------- */}
          {/* HEADER */}
          {/* ---------------------------------------------------------------- */}

          <div className="mb-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#1B4332]/10">
              <LockKeyhole className="h-6 w-6 text-[#1B4332]" />
            </div>

            <h1 className="font-heading text-2xl font-bold sm:text-3xl">
              Forgot Password?
            </h1>

            <p className="mt-2 text-sm text-[#4A4A4A]">
              {step === 1
                ? "Choose how you want to reset your password."
                : "Enter the OTP and create your new password."}
            </p>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* STEP 1 — SELECT METHOD + SEND OTP */}
          {/* ---------------------------------------------------------------- */}

          {step === 1 && (
            <form
              onSubmit={requestOtp}
              className="space-y-5"
            >

              {/* Recovery Method */}

              <div>
                <label className="mb-2 block text-xs font-semibold text-[#4A4A4A]">
                  Reset password using
                </label>

                <div className="grid grid-cols-2 gap-3">

                  {/* Mobile */}

                  <button
                    type="button"
                    onClick={() =>
                      selectMethod("phone")
                    }
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      method === "phone"
                        ? "border-[#1B4332] bg-[#1B4332]/10 text-[#1B4332]"
                        : "border-black/10 bg-white text-[#4A4A4A] hover:border-[#1B4332]/40"
                    }`}
                    data-testid="forgot-phone-method"
                  >
                    <Smartphone className="h-4 w-4" />
                    Mobile
                  </button>

                  {/* Email */}

                  <button
                    type="button"
                    onClick={() =>
                      selectMethod("email")
                    }
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      method === "email"
                        ? "border-[#1B4332] bg-[#1B4332]/10 text-[#1B4332]"
                        : "border-black/10 bg-white text-[#4A4A4A] hover:border-[#1B4332]/40"
                    }`}
                    data-testid="forgot-email-method"
                  >
                    <Mail className="h-4 w-4" />
                    Email
                  </button>

                </div>
              </div>

              {/* ---------------------------------------------------------------- */}
              {/* MOBILE INPUT */}
              {/* ---------------------------------------------------------------- */}

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
                    value={identifier}
                    onChange={(e) =>
                      setIdentifier(
                        e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 10)
                      )
                    }
                    className="input-base"
                    placeholder="Enter 10-digit mobile number"
                    data-testid="forgot-phone-input"
                  />
                </div>
              )}

              {/* ---------------------------------------------------------------- */}
              {/* EMAIL INPUT */}
              {/* ---------------------------------------------------------------- */}

              {method === "email" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
                    Registered Email Address
                  </label>

                  <input
                    type="email"
                    required
                    value={identifier}
                    onChange={(e) =>
                      setIdentifier(
                        e.target.value
                      )
                    }
                    className="input-base"
                    placeholder="Enter your registered email"
                    data-testid="forgot-email-input"
                  />
                </div>
              )}

              {/* SEND OTP */}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
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

          {/* ---------------------------------------------------------------- */}
          {/* STEP 2 — OTP + PASSWORD */}
          {/* ---------------------------------------------------------------- */}

          {step === 2 && (
            <form
              onSubmit={resetPassword}
              className="space-y-5"
            >

              {/* Recovery information */}

              <div className="rounded-xl bg-[#1B4332]/5 p-3 text-sm text-[#4A4A4A]">
                OTP sent to{" "}
                <span className="font-semibold text-[#1B4332]">
                  {method === "phone"
                    ? `••••••${identifier.slice(-4)}`
                    : identifier}
                </span>
              </div>

              {/* OTP */}

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
                  OTP
                </label>

                <input
                  type="text"
                  inputMode="numeric"
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
                  className="input-base tracking-[0.3em]"
                  placeholder="000000"
                  data-testid="forgot-otp-input"
                />
              </div>

              {/* New Password */}

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
                  New Password
                </label>

                <input
                  type="password"
                  required
                  minLength={6}
                  maxLength={128}
                  value={newPassword}
                  onChange={(e) =>
                    setNewPassword(
                      e.target.value
                    )
                  }
                  className="input-base"
                  placeholder="Enter new password"
                  data-testid="forgot-new-password"
                />
              </div>

              {/* Confirm Password */}

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
                  Confirm New Password
                </label>

                <input
                  type="password"
                  required
                  minLength={6}
                  maxLength={128}
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(
                      e.target.value
                    )
                  }
                  className="input-base"
                  placeholder="Confirm new password"
                  data-testid="forgot-confirm-password"
                />
              </div>

              {/* RESET PASSWORD */}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
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
                className="w-full text-sm font-semibold text-[#1B4332] hover:text-[#E07A5F]"
              >
                Change recovery method
              </button>
            </form>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* BACK TO LOGIN */}
          {/* ---------------------------------------------------------------- */}

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