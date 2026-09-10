import Link from "next/link";

import { cn } from "@/lib/cn";

/**
 * The four ways of reading the same portfolio. Adding a view here is the only
 * place the vocabulary is defined.
 */
export const PRODUCT_VIEWS = [
  { id: "portfolio", label: "Portfolio" },
  { id: "retail-fit", label: "Retail fit" },
  { id: "competition", label: "Competition" },
  { id: "white-space", label: "White space" },
] as const;

export type ProductView = (typeof PRODUCT_VIEWS)[number]["id"];

const DEFAULT_VIEW: ProductView = "portfolio";

/** Anything unrecognised falls back to the portfolio rather than 404ing. */
export function parseProductView(value: string | string[] | undefined): ProductView {
  const candidate = Array.isArray(value) ? value[0] : value;
  return PRODUCT_VIEWS.some((view) => view.id === candidate)
    ? (candidate as ProductView)
    : DEFAULT_VIEW;
}

/**
 * The view lives in the URL, the way the broker filter does. That keeps this
 * a server component, makes a given view linkable mid-meeting, and lets
 * back/forward behave the way the client expects.
 */
export function ProductTabs({ active }: { active: ProductView }) {
  return (
    <nav
      aria-label="Product views"
      className="-mx-6 overflow-x-auto border-b border-rule px-6 sm:mx-0 sm:px-0"
    >
      <div className="flex min-w-max gap-8">
        {PRODUCT_VIEWS.map((view) => {
          const selected = view.id === active;

          return (
            <Link
              key={view.id}
              href={
                view.id === DEFAULT_VIEW ? "/products" : "/products?view=" + view.id
              }
              aria-current={selected ? "page" : undefined}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 pb-3 text-sm transition-colors",
                selected
                  ? "border-forest font-medium text-forest"
                  : "border-transparent text-ink-muted hover:border-rule hover:text-ink",
              )}
            >
              {view.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
