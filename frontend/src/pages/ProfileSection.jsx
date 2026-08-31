import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function ProfileSection({ title, description, children }) {
  return (
    <div className="container-app py-8 sm:py-10">
      <div className="mx-auto max-w-lg">
        <Link
          to="/profile"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#1B4332] hover:text-[#E07A5F]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile
        </Link>
        <h1 className="font-heading text-2xl font-bold">{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-[#4A4A4A]">{description}</p>
        )}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function ProfileComingSoon({ title, description }) {
  return (
    <ProfileSection title={title} description={description}>
      <div className="card-base p-8 text-center text-sm text-[#4A4A4A]">
        Coming soon — we&apos;re building this feature for Ambajogai Grocery.
      </div>
    </ProfileSection>
  );
}
