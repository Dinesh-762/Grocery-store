import { toast } from "sonner";
import { Star } from "lucide-react";
import ProfileSection from "@/pages/ProfileSection";

export default function ProfileRate() {
  const rate = () => {
    toast.success("Thank you! Your feedback helps us improve Ambajogai Grocery.");
  };

  return (
    <ProfileSection
      title="Rate App"
      description="Enjoying Ambajogai Grocery? Let us know!"
    >
      <div className="card-base p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#FFF5F2] text-[#E07A5F]">
          <Star className="h-7 w-7 fill-current" />
        </div>
        <p className="mt-4 text-sm text-[#4A4A4A]">
          Tap below to rate your experience. We read every review.
        </p>
        <button type="button" onClick={rate} className="btn-primary mt-6 w-full">
          Rate Ambajogai Grocery
        </button>
      </div>
    </ProfileSection>
  );
}
