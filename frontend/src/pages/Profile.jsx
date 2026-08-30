import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiError } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Package,
  Heart,
  Wallet,
  Gift,
  Bell,
  HelpCircle,
  Star,
  LogOut,
  Camera,
  FolderOpen,
  Trash2,
  ChevronRight,
  Loader2,
} from "lucide-react";

const menuItems = [
  { label: "My Orders", icon: Package, to: "/orders" },
  { label: "Wishlist", icon: Heart, to: "/profile/wishlist" },
  { label: "Wallet", icon: Wallet, to: "/profile/wallet" },
  { label: "Refer Friends", icon: Gift, to: "/profile/refer" },
  { label: "Notifications", icon: Bell, to: "/profile/notifications" },
  { label: "Help Center", icon: HelpCircle, to: "/contact" },
  { label: "Rate App", icon: Star, to: "/profile/rate" },
];

function initials(name, email) {
  const n = String(name || email || "?").trim();
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

export default function Profile() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const cameraRef = useRef(null);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  const uploadPhoto = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    try {
      const { data } = await api.post("/users/me/photo", fd);
      setUser(data);
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(formatApiError(err, "Could not upload photo"));
    } finally {
      setUploading(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deletePhoto = async () => {
    if (!user.profile_photo) return;
    if (!window.confirm("Remove your profile photo?")) return;
    setDeleting(true);
    try {
      const { data } = await api.delete("/users/me/photo");
      setUser(data);
      toast.success("Profile photo removed");
    } catch (err) {
      toast.error(formatApiError(err, "Could not remove photo"));
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="container-app py-8 sm:py-10" data-testid="profile-page">
      <div className="mx-auto max-w-lg space-y-4">
        {/* Profile card */}
        <div className="card-base p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 shrink-0 sm:h-[4.5rem] sm:w-[4.5rem]">
              {user.profile_photo ? (
                <AvatarImage src={user.profile_photo} alt={user.name} />
              ) : null}
              <AvatarFallback className="bg-[#1B4332]/10 text-lg font-semibold text-[#1B4332]">
                {initials(user.name, user.email)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <h1 className="truncate font-heading text-xl font-bold text-[#1A1A1A] sm:text-2xl">
                {user.name}
              </h1>
              <p className="mt-0.5 truncate text-sm text-[#4A4A4A]">{user.email}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={(e) => uploadPhoto(e.target.files?.[0])}
                  data-testid="profile-camera-input"
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => uploadPhoto(e.target.files?.[0])}
                  data-testid="profile-file-input"
                />

                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  disabled={uploading || deleting}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-semibold text-[#E07A5F] transition-colors hover:bg-[#FFF5F2] disabled:opacity-50"
                  data-testid="profile-camera-btn"
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )}
                  Camera
                </button>

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || deleting}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-semibold text-[#E07A5F] transition-colors hover:bg-[#FFF5F2] disabled:opacity-50"
                  data-testid="profile-files-btn"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Files
                </button>

                {user.profile_photo && (
                  <button
                    type="button"
                    onClick={deletePhoto}
                    disabled={uploading || deleting}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    data-testid="profile-delete-photo-btn"
                  >
                    {deleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Menu */}
        <div className="card-base overflow-hidden divide-y divide-[#E5E5E5]">
          {menuItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="flex items-center gap-3 px-5 py-4 text-[#1A1A1A] transition-colors hover:bg-gray-50"
              data-testid={`profile-menu-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <item.icon className="h-5 w-5 shrink-0 text-[#4A4A4A]" />
              <span className="flex-1 text-sm font-medium">{item.label}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
            </Link>
          ))}
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-red-200 bg-white py-3.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
          data-testid="profile-logout-btn"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  );
}
