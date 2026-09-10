import { cn } from "@/lib/cn";
import { getActionMetrics } from "@/lib/selectors";

/**
 * The book of work in four figures, every one counted from the same ten
 * action records the rest of the portal reads.
 *
 * No rates, no trends, no comparisons: there is no history in the data to
 * compare against, and a percentage here would be invented.
 *
 * Overdue is the one figure allowed to carry red, and only when it is not
 * zero — a book with nothing late should not display an alarm.
 */
export function ActionSummary() {
  const m = getActionMetrics();

  const figures = [
    { value: m.open, label: "Open", attention: false },
    { value: m.overdue, label: "Overdue", attention: m.overdue > 0 },
    { value: m.dueNext, label: "Due within a week", attention: false },
    { value: m.blocked, label: "Blocked", attention: false },
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
          <dd
            className={cn(
              "font-display text-[1.75rem] leading-none",
              figure.attention ? "text-red" : "text-ink",
            )}
          >
            {figure.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
