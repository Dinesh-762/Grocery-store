import { Outlet } from "react-router-dom";
import VendorBottomNav from "./VendorBottomNav";

export default function VendorLayout() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">

          <div>
            <h1 className="text-lg font-bold text-[#1B4332]">
              Vendor Panel
            </h1>

            <p className="text-xs text-gray-500">
              Manage your store
            </p>
          </div>

          <div className="flex items-center gap-2">

            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
              🟢 Open
            </span>

          </div>

        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 p-4 pb-24">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <VendorBottomNav />

    </div>
  );
}