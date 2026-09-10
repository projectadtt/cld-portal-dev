import Link from "next/link";

import { StatusBadge } from "@/components/primitives/StatusBadge";
import { cn } from "@/lib/cn";
import { getPositioningReads } from "@/lib/selectors";
import { itemStatusTone } from "@/lib/status";

const COLUMNS = [
  { label: "Product", className: "w-44 pr-4" },
  { label: "How it is positioned", className: "pr-4" },
  { label: "Buyer signal", className: "w-36 pr-4" },
  { label: "Retail read", className: "w-36" },
];

/**
 * How the range is positioned, against what buyers have said back to it.
 *
 * Positioning is the claim CLD is making; the buyer signal is the answer that
 * claim has drawn; the retail read is how far the item has actually travelled
 * on the back of it. Reading the three together is the whole point — a strong
 * claim with no answer and no movement is a claim that has not been tested.
 *
 * Nothing here is benchmarked against anything outside this workspace.
 */
export function PositioningTable() {
  const reads = getPositioningReads();

  return (
    /* Scrolls inside its own container so the page body never does. */
    <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[50rem] border-collapse text-left">
        <caption className="sr-only">
          Each worked product, how it is positioned, the buyer signal it has
          drawn, and how far it has travelled in retail
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
          {reads.map(({ product, summary, positioning, challenges }) => {
            const themes = [
              ...new Set(
                challenges
                  .filter((c) => c.theme)
                  .map((c) => c.theme as string),
              ),
            ];

            return (
              <tr key={product.id} className="border-b border-rule-soft align-top">
                <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                  <Link
                    href={"/products/" + product.id}
                    className="text-sm leading-snug text-ink transition-colors hover:text-forest"
                  >
                    {product.name}
                  </Link>
                </th>

                <td className="py-2.5 pr-4">
                  <p className="text-[13px] leading-5 text-ink-muted">
                    {positioning ?? (
                      <span className="text-ink-faint">No positioning written yet</span>
                    )}
                  </p>
                </td>

                <td className="py-2.5 pr-4 text-[13px] leading-5">
                  {themes.length > 0 ? (
                    <span className="text-ink">{themes.join(" · ")}</span>
                  ) : (
                    <span className="text-ink-faint">Untested so far</span>
                  )}
                </td>

                <td className="py-2.5 text-[13px] leading-5">
                  {summary.furthestStatus ? (
                    <StatusBadge
                      label={summary.furthestStatus}
                      tone={itemStatusTone[summary.furthestStatus]}
                      wrap
                    />
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                  <span className="mt-0.5 block text-ink-faint">
                    {summary.retailerCount === 1
                      ? "1 account"
                      : summary.retailerCount + " accounts"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
