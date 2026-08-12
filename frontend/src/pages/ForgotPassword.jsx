import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ArrowLeft, LockKeyhole } from "lucide-react";
import { api, formatApiError } from "@/lib/api";

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);

  // Step 1: Request OTP
  const requestOtp = async (e) => {
    e.preventDefault();

    const cleanPhone = phone.trim();

    if (!/^\d{10}$/.test(cleanPhone)) {
      toast.error("Please enter a valid 10-digit phone number.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post(
        "/auth/password-reset/request",
        {
          phone: cleanPhone,
        }
      );

      toast.success(
        response.data?.message || "OTP generated successfully."
      );

      // Current backend is using mock OTP for development.
      if (response.data?.debug_code) {
        toast.info(`Your OTP is ${response.data.debug_code}`, {
          duration: 10000,
        });
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

  // Step 2: Verify OTP and reset password
  const resetPassword = async (e) => {
    e.preventDefault();

    if (!/^\d{6}$/.test(otp.trim())) {
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
      const response = await api.post(
        "/auth/password-reset",
        {
          phone: phone.trim(),
          code: otp.trim(),
          new_password: newPassword,
        }
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

  return (
    <div className="container-app grid min-h-[80vh] place-items-center py-12">
      <div
        className="w-full max-w-md"
        data-testid="forgot-password-page"
      >
        <div className="card-base p-8">

          {/* Header */}
          <div className="mb-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#1B4332]/10">
              <LockKeyhole className="h-6 w-6 text-[#1B4332]" />
            </div>

            <h1 className="font-heading text-2xl font-bold sm:text-3xl">
              Forgot Password?
            </h1>

            <p className="mt-2 text-sm text-[#4A4A4A]">
              {step === 1
                ? "Enter your registered phone number to receive an OTP."
                : "Enter the OTP and create your new password."}
            </p>
          </div>

          {/* STEP 1 — Phone Number */}
          {step === 1 && (
            <form
              onSubmit={requestOtp}
              className="space-y-5"
            >
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
                  Registered Phone Number
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
                  placeholder="Enter 10-digit phone number"
                  data-testid="forgot-phone-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
                data-testid="forgot-send-otp"
              >
                {loading && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

                {loading ? "Sending OTP..." : "Send OTP"}
              </button>
            </form>
          )}

          {/* STEP 2 — OTP + Password */}
          {step === 2 && (
            <form
              onSubmit={resetPassword}
              className="space-y-5"
            >
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

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
                  New Password
                </label>

                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) =>
                    setNewPassword(e.target.value)
                  }
                  className="input-base"
                  placeholder="Enter new password"
                  data-testid="forgot-new-password"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#4A4A4A]">
                  Confirm New Password
                </label>

                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  className="input-base"
                  placeholder="Confirm new password"
                  data-testid="forgot-confirm-password"
                />
              </div>

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

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setOtp("");
                }}
                className="w-full text-sm font-semibold text-[#1B4332] hover:text-[#E07A5F]"
              >
                Change phone number
              </button>
            </form>
          )}

          {/* Back to Login */}
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