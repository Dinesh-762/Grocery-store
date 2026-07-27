import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ShoppingCart, User, Search, Menu, X, LogOut, LayoutDashboard, Package, Leaf } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/products", label: "Shop" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export default function Header() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");

  const submitSearch = (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    navigate(`/products?q=${encodeURIComponent(search.trim())}`);
    setSearch("");
    setMobileOpen(false);
  };

  return (
    <header
      className="sticky top-0 z-40 border-b border-[#E5E5E5]/60 bg-[#FDFBF7]/85 backdrop-blur-md"
      data-testid="site-header"
    >
      <div className="container-app flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2" data-testid="brand-logo">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#1B4332] text-white">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="font-heading text-lg font-bold text-[#1B4332] sm:text-xl">
            Ambajogai <span className="hidden text-[#E07A5F] sm:inline">Grocery</span>
          </span>
        </Link>

        <form onSubmit={submitSearch} className="hidden max-w-md flex-1 md:block" data-testid="header-search-form">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for rice, dal, milk, snacks…"
              className="input-base pl-11"
              data-testid="header-search-input"
            />
          </div>
        </form>

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Main">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${
                  isActive ? "text-[#1B4332]" : "text-[#4A4A4A] hover:text-[#1B4332]"
                }`
              }
              data-testid={`nav-${l.label.toLowerCase()}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/cart"
            className="relative grid h-10 w-10 place-items-center rounded-full text-[#1B4332] transition-colors hover:bg-[#1B4332]/10"
            data-testid="cart-icon"
            aria-label="Cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <span
                className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#E07A5F] px-1 text-xs font-semibold text-white"
                data-testid="cart-count"
              >
                {count}
              </span>
            )}
          </Link>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="hidden h-10 items-center gap-2 rounded-full border border-[#E5E5E5] bg-white px-3 text-sm font-medium text-[#1B4332] transition-colors hover:bg-[#F3F4F6] sm:flex"
                  data-testid="user-menu-trigger"
                >
                  <User className="h-4 w-4" />
                  <span className="max-w-[100px] truncate">{user.name.split(" ")[0]}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/orders" data-testid="menu-my-orders" className="cursor-pointer">
                    <Package className="mr-2 h-4 w-4" /> My Orders
                  </Link>
                </DropdownMenuItem>
                {user.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" data-testid="menu-admin" className="cursor-pointer">
                      <LayoutDashboard className="mr-2 h-4 w-4" /> Admin Panel
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} data-testid="menu-logout" className="cursor-pointer text-red-600">
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden gap-2 sm:flex">
              <Link
                to="/login"
                className="rounded-full px-4 py-2 text-sm font-medium text-[#1B4332] hover:bg-[#1B4332]/10"
                data-testid="nav-login"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-[#1B4332] px-4 py-2 text-sm font-medium text-white hover:bg-[#2D6A4F]"
                data-testid="nav-register"
              >
                Sign up
              </Link>
            </div>
          )}

          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-full text-[#1B4332] hover:bg-[#1B4332]/10 lg:hidden"
            aria-label="Menu"
            data-testid="mobile-menu-toggle"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[#E5E5E5]/60 bg-white lg:hidden" data-testid="mobile-menu">
          <div className="container-app space-y-4 py-4">
            <form onSubmit={submitSearch}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products…"
                  className="input-base pl-11"
                  data-testid="mobile-search-input"
                />
              </div>
            </form>
            <div className="flex flex-col gap-1">
              {navLinks.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-medium ${
                      isActive
                        ? "bg-[#1B4332]/10 text-[#1B4332]"
                        : "text-[#4A4A4A] hover:bg-gray-50"
                    }`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
              {user ? (
                <>
                  <Link
                    to="/orders"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-[#4A4A4A] hover:bg-gray-50"
                  >
                    My Orders
                  </Link>
                  {user.role === "admin" && (
                    <Link
                      to="/admin"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-[#4A4A4A] hover:bg-gray-50"
                    >
                      Admin Panel
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      logout();
                      setMobileOpen(false);
                    }}
                    className="rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <div className="flex gap-2 pt-2">
                  <Link to="/login" className="btn-secondary flex-1 py-2" onClick={() => setMobileOpen(false)}>
                    Login
                  </Link>
                  <Link to="/register" className="btn-primary flex-1 py-2" onClick={() => setMobileOpen(false)}>
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
