import { getReportMetrics } from "@/lib/selectors";

/**
 * What the reporting layer is drawing on, in four figures.
 *
 * Each one is lifted from the selector the matching screen already uses, so
 * these are the same numbers the workspace shows — not a reporting copy of
 * them. Nothing here is a rate, a trend or a comparison, because there is no
 * history in the workbook to compare against.
 */
export function ReportSummary() {
  const m = getReportMetrics();

  const figures = [
    { value: m.retailAccounts, label: "Target accounts" },
    { value: m.workstreamItems, label: "Tracked items" },
    { value: m.openActions, label: "Open actions" },
    { value: m.buyerResponses, label: "Buyer responses" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-8 border-y border-rule sm:grid-cols-4 sm:gap-x-0">
      {figures.map((figure) => (
        <div
          key={figure.label}
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
