import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { ShoppingCart, User, Search, Menu, X, LogOut, LayoutDashboard, Package, Leaf, Store, Truck, UserCircle } from "lucide-react";
import { api, formatINR } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const submitSearch = (e) => {
  e.preventDefault();
  if (!search.trim()) return;

  navigate(`/products?q=${encodeURIComponent(search.trim())}`);
  setSearch("");
  setMobileOpen(false);
  };
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
  if (search.trim().length === 0) {
    setSuggestions([]);
    setShowSuggestions(false);
    return;
  }

  const timer = setTimeout(async () => {
    try {
      const res = await api.get(
        `/products?q=${encodeURIComponent(search)}&limit=5`
      );

      setSuggestions(res.data);
      setShowSuggestions(true);
    } catch (err) {
      console.error(err);
    }
  }, 300);

  return () => clearTimeout(timer);
}, [search]);

  const userInitials = (user?.name || user?.email || "U")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header
      className="site-header"
      data-testid="site-header"
    >
      <div className="container-app flex h-14 items-center justify-between gap-2 sm:h-16 sm:gap-4">
        <Link to="/" className="flex min-w-0 items-center gap-2" data-testid="brand-logo">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1B4332] text-white sm:h-9 sm:w-9">
            <Leaf className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <span className="truncate font-heading text-base font-bold text-[#1B4332] sm:text-lg lg:text-xl">
            Ambajogai <span className="hidden text-[#E07A5F] sm:inline">Grocery</span>
          </span>
        </Link>

        <form onSubmit={submitSearch} className="relative hidden max-w-md flex-1 md:block" data-testid="header-search-form">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Search for rice, dal, milk, snacks…"
              className="input-base pl-12"
              data-testid="header-search-input"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-white shadow-xl">
                {suggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      navigate(`/products/${item.slug}`);
                      setSearch("");
                      setSuggestions([]);
                      setShowSuggestions(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 hover:bg-gray-50"
                  >
                    <img
                      src={item.image}
                      className="h-10 w-10 rounded object-cover"
                      alt={item.name}
                    />
                    <div className="text-left">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-gray-500">{formatINR(item.price)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
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
                  className="hidden h-10 items-center gap-2 rounded-full border border-[#E5E5E5] bg-white px-2.5 text-sm font-medium text-[#1B4332] transition-colors hover:bg-[#F3F4F6] sm:flex sm:px-3"
                  data-testid="user-menu-trigger"
                >
                  {user.profile_photo ? (
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.profile_photo} alt={user.name} />
                      <AvatarFallback className="text-[10px]">{userInitials}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                  <span className="max-w-[100px] truncate">{(user.name || user.email || "User").split(" ")[0]}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" data-testid="menu-profile" className="cursor-pointer">
                    <UserCircle className="mr-2 h-4 w-4" /> My Profile
                  </Link>
                </DropdownMenuItem>
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
                {user.role === "vendor" && (
                  <DropdownMenuItem asChild>
                    <Link to="/vendor" data-testid="menu-vendor" className="cursor-pointer">
                      <Store className="mr-2 h-4 w-4" /> Vendor Panel
                    </Link>
                  </DropdownMenuItem>
                )}
                {user.role === "delivery" && (
                  <DropdownMenuItem asChild>
                    <Link to="/delivery" data-testid="menu-delivery" className="cursor-pointer">
                      <Truck className="mr-2 h-4 w-4" /> Delivery Panel
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
          <div className="container-app max-h-[calc(100dvh-3.5rem)] space-y-4 overflow-y-auto py-4">
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
                    to="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-[#4A4A4A] hover:bg-gray-50"
                  >
                    My Profile
                  </Link>
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
                  {user.role === "vendor" && (
                    <Link
                      to="/vendor"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-[#4A4A4A] hover:bg-gray-50"
                    >
                      Vendor Panel
                    </Link>
                  )}
                  {user.role === "delivery" && (
                    <Link
                      to="/delivery"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-[#4A4A4A] hover:bg-gray-50"
                    >
                      Delivery Panel
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

