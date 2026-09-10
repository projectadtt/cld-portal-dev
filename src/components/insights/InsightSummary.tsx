import { getInsightMetrics } from "@/lib/selectors";

/**
 * What this page is standing on, in four figures.
 *
 * Deliberately counts of evidence rather than market numbers: how much has
 * actually been heard, from how many accounts, about how much of the range —
 * and how many reads CLD has drawn from it. Nothing here is a rate or a
 * projection, because there is nothing in the data to project from.
 */
export function InsightSummary() {
  const m = getInsightMetrics();

  const figures = [
    { value: m.buyerResponses, label: "Buyer responses" },
    { value: m.accountsHeardFrom, label: "Accounts heard from" },
    { value: m.productsWithSignal, label: "Products with a signal" },
    { value: m.reads, label: "Reads drawn" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-8 border-y border-rule sm:grid-cols-4 sm:gap-x-0">
      {figures.map((figure) => (
        <div
          key={figure.label}
          /* Two columns on mobile, four at sm. The divider is suppressed on
             whichever cell starts a row, otherwise a hairline floats at the
             left edge with nothing to divide. */
          className="flex flex-col-reverse gap-1.5 py-5 sm:border-l sm:border-rule sm:pl-5 sm:first:border-l-0 sm:first:pl-0"
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
