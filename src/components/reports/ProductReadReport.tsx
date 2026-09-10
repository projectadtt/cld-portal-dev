import Link from "next/link";

import { StatusBadge } from "@/components/primitives/StatusBadge";
import { cn } from "@/lib/cn";
import { getProductSummaries } from "@/lib/selectors";
import { itemStatusTone } from "@/lib/status";

const COLUMNS = [
  { label: "Product", className: "w-52 pr-4" },
  { label: "Conversations", className: "w-28 pr-4 text-right" },
  { label: "Heard back", className: "w-24 pr-4 text-right" },
  { label: "Current signal", className: "w-44 pr-4" },
  { label: "Next move", className: "" },
];

/**
 * REPORT 4 — how the portfolio is travelling.
 *
 * The same product summaries the Products screen is built from, in the same
 * order: most retail conversation first, so the SKUs carrying the book lead
 * and the untouched ones fall to the end rather than being hidden. A product
 * nobody has opened a conversation on is itself a finding worth reporting.
 */
export function ProductReadReport() {
  const rows = getProductSummaries();

  return (
    /* Scrolls inside its own container so the page body never does. */
    <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[50rem] border-collapse text-left">
        <caption className="sr-only">
          Each product, how many retail conversations it is in, what buyers
          have said, and the next move on it
        </caption>

        <thead>
          <tr className="border-b border-rule">
            {COLUMNS.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={cn("type-label pb-2.5 font-normal", column.className)}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((summary) => (
            <tr
              key={summary.product.id}
              className="border-b border-rule-soft align-top"
            >
              <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                <Link
                  href={"/products/" + summary.product.id}
                  className="text-sm leading-snug text-ink transition-colors hover:text-forest"
                >
                  {summary.product.name}
                </Link>
              </th>

              <td className="py-2.5 pr-4 text-right text-[13px] leading-5">
                <span
                  className={cn(
                    "tabular-nums",
                    summary.retailerCount === 0
                      ? "text-ink-faint"
                      : "text-ink",
                  )}
                >
                  {summary.retailerCount}
                </span>
              </td>

              <td className="py-2.5 pr-4 text-right text-[13px] leading-5">
                <span
                  className={cn(
                    "tabular-nums",
                    summary.feedbackCount === 0
                      ? "text-ink-faint"
                      : "text-ink",
                  )}
                >
                  {summary.feedbackCount}
                </span>
              </td>

              <td className="py-2.5 pr-4 text-[13px] leading-5">
                {summary.furthestStatus ? (
                  <StatusBadge
                    label={summary.furthestStatus}
                    tone={itemStatusTone[summary.furthestStatus]}
                    wrap
                  />
                ) : (
                  <span className="text-ink-faint">Not yet in retail</span>
                )}
              </td>

              <td className="py-2.5 text-[13px] leading-5">
                {summary.openActions.length > 0 ? (
                  <span className="text-ink">
                    {summary.openActions[0].label}
                  </span>
                ) : (
                  <span className="text-ink-faint">No open action</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
