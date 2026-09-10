import Link from "next/link";

import { cn } from "@/lib/cn";
import type { BrokerScorecard } from "@/lib/selectors";

/**
 * The five readings of one broker's book. Adding a view here is the only
 * place the vocabulary is defined.
 */
export const BROKER_VIEWS = [
  { id: "accounts", label: "Accounts" },
  { id: "samples", label: "Samples out" },
  { id: "under-review", label: "Under review" },
  { id: "approved", label: "Approved" },
  { id: "next-steps", label: "Next steps" },
] as const;

export type BrokerView = (typeof BROKER_VIEWS)[number]["id"];

const DEFAULT_VIEW: BrokerView = "accounts";

/** Anything unrecognised falls back to the full portfolio rather than 404ing. */
export function parseBrokerView(value: string | string[] | undefined): BrokerView {
  const candidate = Array.isArray(value) ? value[0] : value;
  return BROKER_VIEWS.some((view) => view.id === candidate)
    ? (candidate as BrokerView)
    : DEFAULT_VIEW;
}

/**
 * The same cuts as the accountability table, carried onto the broker's own
 * page so a drill-down can be changed without going back.
 *
 * Counts sit beside the labels because the point of the view is the number —
 * and a view with nothing in it says so before it is opened.
 */
export function BrokerViewTabs({
  brokerId,
  active,
  scorecard,
}: {
  brokerId: string;
  active: BrokerView;
  scorecard: BrokerScorecard;
}) {
  const counts: Record<BrokerView, number> = {
    accounts: scorecard.accounts,
    samples: scorecard.samplesOut,
    "under-review": scorecard.underReview,
    approved: scorecard.approved,
    "next-steps": scorecard.nextSteps,
  };

  return (
    <nav
      aria-label="Portfolio views"
      className="-mx-6 overflow-x-auto border-b border-rule px-6 sm:mx-0 sm:px-0"
    >
      <div className="flex min-w-max gap-8">
        {BROKER_VIEWS.map((view) => {
          const selected = view.id === active;

          return (
            <Link
              key={view.id}
              href={
                view.id === DEFAULT_VIEW
                  ? "/brokers/" + brokerId
                  : "/brokers/" + brokerId + "?view=" + view.id
              }
              aria-current={selected ? "page" : undefined}
              className={cn(
                "-mb-px flex items-baseline gap-2 whitespace-nowrap border-b-2 pb-3 text-sm transition-colors",
                selected
                  ? "border-forest font-medium text-forest"
                  : "border-transparent text-ink-muted hover:border-rule hover:text-ink",
              )}
            >
              {view.label}
              <span
                className={cn(
                  "text-[13px] tabular-nums",
                  counts[view.id] === 0 ? "text-ink-faint" : "text-ink-muted",
                )}
              >
                {counts[view.id]}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
