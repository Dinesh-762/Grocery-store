import { Link } from "react-router-dom";
import { ArrowLeft, ShoppingBag, CreditCard, Check } from "lucide-react";

const STEPS = [
  { key: "cart", label: "Your cart", icon: ShoppingBag, to: "/cart" },
  { key: "checkout", label: "Checkout", icon: CreditCard, to: "/checkout" },
];

export default function CartFlowHeader({ active = "cart", backTo = "/products", backLabel = "Continue shopping" }) {
  const activeIndex = STEPS.findIndex((s) => s.key === active);

  return (
    <header className="mb-6 space-y-5">
      <nav
        className="flex items-center justify-between gap-3 border-b border-[#E5E5E5] pb-4"
        aria-label="Cart flow navigation"
      >
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 rounded-full px-1 py-1 text-sm font-medium text-[#4A4A4A] transition-colors hover:text-[#1B4332]"
          data-testid={`${active}-back-link`}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">{backLabel}</span>
          <span className="sm:hidden">Back</span>
        </Link>
        <span className="font-heading text-sm font-semibold text-[#1B4332] sm:text-base">
          {STEPS[activeIndex]?.label ?? "Cart"}
        </span>
      </nav>

      <ol className="flex items-center gap-2 sm:gap-3" aria-label="Checkout progress">
        {STEPS.map((step, index) => {
          const done = index < activeIndex;
          const current = index === activeIndex;
          const Icon = step.icon;
          const clickable = index < activeIndex;

          const content = (
            <>
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors sm:h-9 sm:w-9 ${
                  done
                    ? "bg-[#1B4332] text-white"
                    : current
                    ? "bg-[#E07A5F] text-white ring-4 ring-[#E07A5F]/20"
                    : "bg-[#F0F0F0] text-[#8BA888]"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className="hidden min-w-0 sm:block">
                <span
                  className={`block truncate text-xs font-semibold sm:text-sm ${
                    current ? "text-[#1B4332]" : done ? "text-[#1B4332]" : "text-[#8BA888]"
                  }`}
                >
                  {step.label}
                </span>
              </span>
            </>
          );

          return (
            <li key={step.key} className="flex min-w-0 flex-1 items-center gap-2">
              {clickable ? (
                <Link
                  to={step.to}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-xl p-1 transition-colors hover:bg-[#1B4332]/5"
                >
                  {content}
                </Link>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2 p-1" aria-current={current ? "step" : undefined}>
                  {content}
                </div>
              )}
              {index < STEPS.length - 1 && (
                <div
                  className={`mx-1 h-0.5 flex-1 rounded-full sm:mx-2 ${
                    index < activeIndex ? "bg-[#1B4332]" : "bg-[#E5E5E5]"
                  }`}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </header>
  );
}

export function SummaryCard({ title, icon: Icon, children, className = "", testId }) {
  return (
    <aside
      className={`card-base overflow-hidden lg:sticky lg:top-24 ${className}`}
      data-testid={testId}
    >
      <div className="border-b border-[#E5E5E5]/80 bg-gradient-to-r from-[#1B4332]/5 to-transparent px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-[#1B4332]" />}
          <h2 className="font-heading text-lg font-semibold text-[#1B4332]">{title}</h2>
        </div>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </aside>
  );
}

export function FlowSection({ step, title, icon: Icon, children, className = "" }) {
  return (
    <section className={`card-base overflow-hidden ${className}`}>
      <div className="flex items-center gap-3 border-b border-[#E5E5E5]/80 bg-[#FAFAFA] px-4 py-3 sm:px-6 sm:py-4">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#1B4332] text-xs font-bold text-white">
          {step}
        </span>
        {Icon && <Icon className="h-5 w-5 text-[#1B4332]" />}
        <h2 className="font-heading text-base font-semibold text-[#1B4332] sm:text-lg">{title}</h2>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}
