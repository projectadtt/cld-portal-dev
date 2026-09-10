import Link from "next/link";

import { cn } from "@/lib/cn";

/**
 * The three ways of reading one account. Adding a view here is the only place
 * the vocabulary is defined.
 *
 * No Files tab: the prototype has no document store, and a tab that opens on
 * nothing would be the one dishonest thing on the page.
 */
export const RETAILER_VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
  { id: "notes", label: "Notes" },
] as const;

export type RetailerView = (typeof RETAILER_VIEWS)[number]["id"];

const DEFAULT_VIEW: RetailerView = "overview";

/** Anything unrecognised falls back to the overview rather than 404ing. */
export function parseRetailerView(
  value: string | string[] | undefined,
): RetailerView {
  const candidate = Array.isArray(value) ? value[0] : value;
  return RETAILER_VIEWS.some((view) => view.id === candidate)
    ? (candidate as RetailerView)
    : DEFAULT_VIEW;
}

/**
 * The view lives in the URL the way the broker filter does: the page stays a
 * server component, and a given tab is linkable mid-meeting.
 */
export function RetailerTabs({
  retailerId,
  active,
}: {
  retailerId: string;
  active: RetailerView;
}) {
  const base = "/retailers/" + retailerId;

  return (
    <nav
      aria-label="Account views"
      className="-mx-6 overflow-x-auto border-b border-rule px-6 sm:mx-0 sm:px-0"
    >
      <div className="flex min-w-max gap-8">
        {RETAILER_VIEWS.map((view) => {
          const selected = view.id === active;

          return (
            <Link
              key={view.id}
              href={view.id === DEFAULT_VIEW ? base : base + "?view=" + view.id}
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
