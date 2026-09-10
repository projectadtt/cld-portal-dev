import Link from "next/link";

import { BrokerAvatar } from "@/components/brokers/BrokerAvatar";
import { cn } from "@/lib/cn";
import {
  formatDueDate,
  getBrokerScorecards,
  getBrokerScorecardTotals,
  type BrokerScorecard,
} from "@/lib/selectors";

/**
 * A count that leads somewhere.
 *
 * A zero is left as plain text: linking it would promise a view with nothing
 * in it. Nothing is padded to make a column look busier than the work is.
 */
function Count({ value, href }: { value: number; href: string }) {
  if (value === 0) {
    return <span className="tabular-nums text-ink-faint">0</span>;
  }

  return (
    <Link
      href={href}
      className="tabular-nums text-ink underline-offset-4 transition-colors hover:text-forest hover:underline"
    >
      {value}
    </Link>
  );
}

const NUMERIC_COLUMNS: {
  key: string;
  label: string;
  view: string;
  value: (row: BrokerScorecard) => number;
  total: (t: ReturnType<typeof getBrokerScorecardTotals>) => number;
}[] = [
  {
    key: "contacted",
    label: "Retailers contacted",
    view: "accounts",
    value: (r) => r.contacted,
    total: (t) => t.contacted,
  },
  {
    key: "samples",
    label: "Samples sent",
    view: "samples",
    value: (r) => r.samplesOut,
    total: (t) => t.samplesOut,
  },
  {
    key: "under-review",
    label: "Under review",
    view: "under-review",
    value: (r) => r.underReview,
    total: (t) => t.underReview,
  },
  {
    key: "approved",
    label: "Approved",
    view: "approved",
    value: (r) => r.approved,
    total: (t) => t.approved,
  },
];

/**
 * Broker accountability, as a compact editorial table.
 *
 * The primary structure of the screen: who owns what, and what is happening
 * inside each portfolio. Every figure is counted from the Item-Retailer
 * tracker or the action list, and every non-zero figure opens the records
 * behind it rather than just reporting a number.
 *
 * Next steps carries the actual next action rather than a count — a name and
 * a date are what a client asks about, and the count is on the broker's own
 * page a click away.
 */
export function BrokerScorecardTable() {
  const rows = getBrokerScorecards();
  const totals = getBrokerScorecardTotals();

  return (
    /* Scrolls inside its own container so the page body never does. */
    <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[36rem] border-collapse text-left">
        <caption className="sr-only">
          Each broker&rsquo;s retail accounts and workstream records by state
        </caption>

        <thead>
          <tr className="border-b border-rule">
            <th scope="col" className="type-label pb-2.5 pr-4 font-normal">
              Broker
            </th>
            {NUMERIC_COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="type-label w-14 pb-2.5 pl-4 text-right font-normal"
              >
                {column.label}
              </th>
            ))}
            <th scope="col" className="type-label w-44 pb-2.5 pl-6 font-normal">
              Next steps
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.broker.id} className="border-b border-rule-soft">
              <th scope="row" className="py-5 pr-4 text-left font-normal">
                <span className="flex items-center gap-2.5">
                  <BrokerAvatar broker={row.broker} />
                  <span className="min-w-0">
                    <Link
                      href={"/brokers/" + row.broker.id}
                      className="whitespace-nowrap font-display text-[1.0625rem] leading-tight tracking-[-0.005em] text-ink transition-colors hover:text-forest"
                    >
                      {row.broker.name}
                    </Link>
                    <span className="type-label mt-0.5 block">
                      {row.broker.coverage}
                    </span>
                  </span>
                </span>
              </th>

              {NUMERIC_COLUMNS.map((column) => (
                <td
                  key={column.key}
                  className="py-5 pl-4 text-right align-top text-sm"
                >
                  <Count
                    value={column.value(row)}
                    href={"/brokers/" + row.broker.id + "?view=" + column.view}
                  />
                </td>
              ))}

              <td className="py-5 pl-6 align-top text-sm">
                {row.nextAction ? (
                  <Link
                    href={"/brokers/" + row.broker.id + "?view=next-steps"}
                    className="group block text-ink transition-colors hover:text-forest"
                  >
                    <span className="block leading-snug">
                      {row.nextAction.label}
                    </span>
                    <span
                      className={cn(
                        "mt-1 block text-[13px]",
                        row.overdue ? "font-medium text-red" : "text-ink-faint",
                      )}
                    >
                      {"Due " +
                        formatDueDate(row.nextAction.due) +
                        (row.overdue ? " · overdue" : "") +
                        (row.nextSteps > 1
                          ? " · " + row.nextSteps + " open"
                          : "")}
                    </span>
                  </Link>
                ) : (
                  <span className="text-ink-faint">Nothing outstanding</span>
                )}
              </td>
            </tr>
          ))}

          <tr>
            <th
              scope="row"
              className="type-label py-5 pr-4 text-left font-normal"
            >
              All brokers
            </th>
            {NUMERIC_COLUMNS.map((column) => (
              <td
                key={column.key}
                className="py-5 pl-4 text-right align-top text-sm tabular-nums text-ink-muted"
              >
                {column.total(totals)}
              </td>
            ))}
            <td className="type-label py-5 pl-6 align-top">
              {totals.nextSteps + " open actions"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
