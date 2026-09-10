import Link from "next/link";

import { cn } from "@/lib/cn";
import { getBrokerCoverageReport } from "@/lib/selectors";

const NUMERIC = [
  { key: "accounts", label: "Accounts" },
  { key: "contacted", label: "Contacted" },
  { key: "items", label: "Tracked items" },
  { key: "samplesOut", label: "Samples out" },
  { key: "nextSteps", label: "Open actions" },
] as const;

/** A zero is left faint rather than bold: nothing there is not a result. */
function Count({ value }: { value: number }) {
  return (
    <span
      className={cn("tabular-nums", value === 0 ? "text-ink-faint" : "text-ink")}
    >
      {value}
    </span>
  );
}

/**
 * REPORT 3 — who is carrying what.
 *
 * Reads straight off the broker scorecard the Brokers screen is built from,
 * so coverage cannot be reported two ways. The attention column counts the
 * accounts on that desk the shared attention layer has flagged — it is not a
 * performance score, and nothing here ranks one broker against another.
 */
export function CoverageReport() {
  const rows = getBrokerCoverageReport();

  return (
    /* Scrolls inside its own container so the page body never does. */
    <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[46rem] border-collapse text-left">
        <caption className="sr-only">
          Each broker&rsquo;s accounts, tracked items, open actions and flagged
          accounts
        </caption>

        <thead>
          <tr className="border-b border-rule">
            <th scope="col" className="type-label w-52 pb-2.5 pr-4 font-normal">
              Broker
            </th>
            {NUMERIC.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="type-label w-24 pb-2.5 pl-4 text-right font-normal"
              >
                {column.label}
              </th>
            ))}
            <th scope="col" className="type-label w-32 pb-2.5 pl-6 font-normal">
              Attention
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map(({ scorecard, needsAttention }) => (
            <tr
              key={scorecard.broker.id}
              className="border-b border-rule-soft align-top"
            >
              <th scope="row" className="py-3 pr-4 text-left font-normal">
                <Link
                  href={"/brokers/" + scorecard.broker.id}
                  className="text-sm leading-snug text-ink transition-colors hover:text-forest"
                >
                  {scorecard.broker.name}
                </Link>
                <span className="type-label mt-1 block">
                  {scorecard.broker.coverage}
                </span>
              </th>

              {NUMERIC.map((column) => (
                <td
                  key={column.key}
                  className="py-3 pl-4 text-right text-[13px] leading-5"
                >
                  <Count value={scorecard[column.key]} />
                </td>
              ))}

              <td className="py-3 pl-6 text-[13px] leading-5">
                {needsAttention === 0 ? (
                  <span className="text-ink-faint">Clear</span>
                ) : (
                  <span className="font-medium text-red">
                    {needsAttention === 1
                      ? "1 account"
                      : needsAttention + " accounts"}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
