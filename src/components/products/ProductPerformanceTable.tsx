import { Package } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/primitives/EmptyState";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { cn } from "@/lib/cn";
import {
  formatDueDate,
  getRetailerShortName,
  isActionOverdue,
  type ProductSummary,
} from "@/lib/selectors";
import { itemStatusTone } from "@/lib/status";

const COLUMNS = [
  { label: "Product", className: "w-56 pr-5" },
  { label: "Retail conversations", className: "w-40 pr-5" },
  { label: "Buyer feedback", className: "w-44 pr-5" },
  { label: "Current signal", className: "w-36 pr-5" },
  { label: "Next move", className: "" },
];

/**
 * How each worked product is actually progressing.
 *
 * The Item-Retailer tracker pivoted onto the product: how many accounts it is
 * in front of, how many have answered, how far the furthest one has got, and
 * what moves it from here. One row per product, so the range can be compared
 * against itself rather than read account by account.
 *
 * Products with no retail conversation are not here — they are visible in the
 * grid above, where an untouched SKU is itself the finding.
 */
export function ProductPerformanceTable({
  summaries,
}: {
  summaries: ProductSummary[];
}) {
  if (summaries.length === 0) {
    return (
      <EmptyState
        icon={Package}
        message="No products have been worked into a retailer yet."
      />
    );
  }

  return (
    /* Scrolls inside its own container so the page body never does. */
    <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[54rem] border-collapse text-left">
        <caption className="sr-only">
          Every product in a retail conversation, with its accounts, buyer
          responses, furthest item status and next move
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
          {summaries.map((summary) => {
            const { product, records, feedbackCount, openActions } = summary;
            const next = openActions[0];
            const overdue = next ? isActionOverdue(next) : false;

            /* Distinct themes, in the order the buyers raised them. */
            const themes = [
              ...new Set(
                records
                  .filter((r) => r.feedbackTheme)
                  .map((r) => r.feedbackTheme as string),
              ),
            ];

            return (
              <tr
                key={product.id}
                className="border-b border-rule-soft align-top"
              >
                <th scope="row" className="py-4 pr-5 text-left font-normal">
                  <Link
                    href={"/products/" + product.id}
                    className="text-sm leading-snug text-ink transition-colors hover:text-forest"
                  >
                    {product.name}
                  </Link>
                  <span className="type-label mt-1 block">
                    {product.category}
                  </span>
                </th>

                <td className="py-4 pr-5 text-[13px] leading-5">
                  <span className="block text-ink">
                    {summary.retailerCount === 1
                      ? "1 retailer"
                      : summary.retailerCount + " retailers"}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-x-1.5 text-ink-faint">
                    {records.map((record, i) => (
                      <Link
                        key={record.id}
                        href={"/retailers/" + record.retailerId}
                        className="transition-colors hover:text-forest"
                      >
                        {getRetailerShortName(record.retailerId) +
                          (i < records.length - 1 ? "," : "")}
                      </Link>
                    ))}
                  </span>
                </td>

                <td className="py-4 pr-5 text-[13px] leading-5">
                  {feedbackCount === 0 ? (
                    <span className="text-ink-faint">Nothing heard back yet</span>
                  ) : (
                    <>
                      <span className="block text-ink">
                        {feedbackCount + " of " + records.length + " answered"}
                      </span>
                      <span className="mt-1 block text-ink-faint">
                        {themes.join(" · ")}
                      </span>
                    </>
                  )}
                </td>

                <td className="py-4 pr-5">
                  {summary.furthestStatus ? (
                    <StatusBadge
                      label={summary.furthestStatus}
                      tone={itemStatusTone[summary.furthestStatus]}
                      wrap
                    />
                  ) : (
                    <span className="text-[13px] text-ink-faint">—</span>
                  )}
                </td>

                <td className="py-4 text-[13px] leading-5">
                  {next ? (
                    <>
                      <Link
                        href="/actions"
                        className="block text-ink transition-colors hover:text-forest"
                      >
                        {next.label}
                      </Link>
                      <span
                        className={cn(
                          "mt-1 block",
                          overdue ? "font-medium text-red" : "text-ink-faint",
                        )}
                      >
                        {"Due " +
                          formatDueDate(next.due) +
                          (overdue ? " · overdue" : "")}
                      </span>
                    </>
                  ) : (
                    <span className="text-ink-faint">Nothing open</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
