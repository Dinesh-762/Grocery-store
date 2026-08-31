import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Leaf } from "lucide-react";

function panelHome(pathname) {
  if (pathname.startsWith("/admin")) return "/admin";
  if (pathname.startsWith("/vendor")) return "/vendor";
  if (pathname.startsWith("/delivery")) return "/delivery";
  return "/";
}

export default function PanelChrome({ title, subtitle }) {
  const { pathname } = useLocation();
  const home = panelHome(pathname);
  const inVendorPanel = pathname.startsWith("/vendor");

  return (
    <header className="site-header" data-testid="panel-header">
      <div className="container-app flex h-14 items-center justify-between gap-3 sm:h-16">
        <Link to={home} className="flex min-w-0 items-center gap-2 text-[#1B4332]">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1B4332] text-white sm:h-9 sm:w-9">
            <Leaf className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <span className="truncate font-heading text-sm font-bold sm:text-base">{title}</span>
        </Link>
        {!inVendorPanel && (
          <Link
            to="/"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-3 py-1.5 text-xs font-semibold text-[#1B4332] hover:bg-gray-50 sm:text-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back to store</span>
            <span className="sm:hidden">Store</span>
          </Link>
        )}
      </div>
      {subtitle && (
        <div className="container-app border-t border-[#E5E5E5]/40 pb-3 pt-2 text-xs text-[#4A4A4A] sm:hidden">
          {subtitle}
        </div>
      )}
    </header>
  );
}
