import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Menu
} from "lucide-react";

const links = [
  {
    to: "/vendor",
    label: "Dashboard",
    icon: LayoutDashboard,
    end: true,
  },
  {
    to: "/vendor/orders",
    label: "Orders",
    icon: ShoppingBag,
  },
  {
    to: "/vendor/products",
    label: "Catalogue",
    icon: Package,
  },
  {
    to: "/vendor/settings",
    label: "More",
    icon: Menu,
  },
];

export default function VendorBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white md:hidden">
      <div className="grid grid-cols-4">
        {links.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-3 text-xs ${
                  isActive
                    ? "text-[#1B4332] font-semibold"
                    : "text-gray-500"
                }`
              }
            >
              <Icon size={20} />
              <span className="mt-1">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}