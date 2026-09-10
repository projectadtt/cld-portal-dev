import { getOverviewMetrics } from "@/lib/selectors";

/**
 * Where things stand, in five figures.
 *
 * Set as an editorial rule rather than a row of KPI cards — no borders, no
 * tiles, no trend arrows. The numbers are context for the sections below,
 * not the point of the page (CLAUDE.md §7).
 */
export function ProgressSummary() {
  const m = getOverviewMetrics();

  const figures = [
    { value: m.activeBrokers, label: "Active brokers" },
    { value: m.retailersInProgress, label: "Retailers in progress" },
    /* Counted in SKUs, not retailers — the funnel below counts retailers,
       and two figures labelled the same way with different units confuse. */
    { value: m.samplesSent, label: "SKU samples sent" },
    { value: m.retailersInReview, label: "Retailers in review" },
    { value: m.buyerDiscussions, label: "Buyer discussions" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-8 border-y border-rule sm:grid-cols-3 sm:gap-x-0 lg:grid-cols-5">
      {figures.map((figure) => (
        <div
          key={figure.label}
          /* Two columns on mobile, three at sm, five at lg. The divider is
             suppressed on whichever cell starts a row at each breakpoint,
             otherwise a hairline floats at the left edge with nothing to
             divide. Below sm there are no dividers at all. */
          className="flex flex-col-reverse gap-1.5 py-6 sm:border-l sm:border-rule sm:pl-5 sm:first:border-l-0 sm:first:pl-0 sm:[&:nth-child(4)]:border-l-0 sm:[&:nth-child(4)]:pl-0 lg:[&:nth-child(4)]:border-l lg:[&:nth-child(4)]:pl-5"
        >
          <dt className="type-label">{figure.label}</dt>
          <dd className="font-display text-[1.75rem] leading-none text-ink">
            {figure.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
