import { getPortfolioMetrics } from "@/lib/selectors";

/**
 * The portfolio in four figures, every one counted from the data.
 *
 * All four count products, so they read against each other: how much of the
 * range is actually in front of a buyer, and how much of it has heard back.
 */
export function PortfolioSummary() {
  const m = getPortfolioMetrics();

  const figures = [
    { value: m.inPortfolio, label: "Products in portfolio" },
    { value: m.inWorkstream, label: "In retail conversations" },
    { value: m.withBuyerFeedback, label: "With buyer feedback" },
    { value: m.withSignals, label: "Carrying a signal" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-8 border-y border-rule sm:grid-cols-4 sm:gap-x-0">
      {figures.map((figure) => (
        <div
          key={figure.label}
          /* Two columns on mobile, four at sm. The divider is suppressed on
             whichever cell starts a row, otherwise a hairline floats at the
             left edge with nothing to divide. */
          className="flex flex-col-reverse gap-1.5 py-6 sm:border-l sm:border-rule sm:pl-5 sm:first:border-l-0 sm:first:pl-0"
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
