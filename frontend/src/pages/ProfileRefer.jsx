import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import ProfileSection from "@/pages/ProfileSection";

export default function ProfileRefer() {
  const { user } = useAuth();
  const code = `AMB${String(user?.id || "").slice(-6).toUpperCase()}`;
  const shareUrl = `${window.location.origin}/register?ref=${code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Referral link copied!");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <ProfileSection
      title="Refer Friends"
      description="Share Ambajogai Grocery with friends and earn rewards when they order."
    >
      <div className="card-base space-y-4 p-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[#4A4A4A]">
            Your referral code
          </div>
          <div className="mt-1 font-mono text-2xl font-bold text-[#1B4332]">{code}</div>
        </div>
        <p className="text-sm text-[#4A4A4A]">
          Share this link so friends can sign up and shop fresh groceries in Ambajogai.
        </p>
        <div className="rounded-xl border border-dashed border-[#E5E5E5] bg-gray-50 p-3 text-xs break-all text-[#4A4A4A]">
          {shareUrl}
        </div>
        <button type="button" onClick={copy} className="btn-primary w-full">
          Copy referral link
        </button>
      </div>
    </ProfileSection>
  );
}
