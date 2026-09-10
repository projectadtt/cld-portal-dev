import { AlertCircle } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/cn";
import {
  formatDueDate,
  getMarketTakeaways,
  getOwnerName,
  isActionOverdue,
} from "@/lib/selectors";

/**
 * REPORT 5 — the reads, and what is carrying them.
 *
 * The five opportunity records with the evidence each one is standing on and
 * the open work already attached to it — the same intersection Market
 * Insights uses, so a read cannot claim more of the book in a report than it
 * does on the screen it came from.
 *
 * A read with nothing open beneath it says so. That gap is the reason this
 * report exists.
 */
export function OpportunityReport() {
  return (
    <ol className="border-t border-rule-soft">
      {getMarketTakeaways().map(
        ({ opportunity, evidence, products, retailers, openActions }, i) => {
          const accounts = new Set(evidence.map((e) => e.retailer.id)).size;
          const next = openActions[0];

          return (
            <li
              key={opportunity.id}
              className="grid gap-x-10 gap-y-3 border-b border-rule-soft py-4 lg:grid-cols-[1.4fr_1fr]"
            >
              <div className="flex min-w-0 gap-5">
                <span
                  aria-hidden="true"
                  className="mt-px flex size-7 shrink-0 items-center justify-center rounded-full border border-rule font-display text-[13px] text-forest"
                >
                  {i + 1}
                </span>

                <div className="min-w-0">
                  <h3 className="max-w-[40ch] font-display text-[1.0625rem] leading-snug tracking-[-0.005em] text-ink">
                    {opportunity.title}
                  </h3>
                  <p className="type-label mt-1.5">
                    {opportunity.type +
                      " · " +
                      opportunity.confidence +
                      " confidence"}
                  </p>
                  {/* Counts what has been heard; the accounts the read
                      actually names are listed on the right, and are
                      deliberately the wider set. */}
                  <p className="mt-2 text-[13px] leading-5 text-ink-muted">
                    {(evidence.length === 1
                      ? "1 buyer response"
                      : evidence.length + " buyer responses") +
                      " from " +
                      (accounts === 1 ? "1 account" : accounts + " accounts") +
                      " · read across " +
                      products.length +
                      " products"}
                  </p>
                </div>
              </div>

              <div className="min-w-0">
                <p className="type-label">Next move</p>
                {next ? (
                  <>
                    <p className="mt-1.5 text-[13px] leading-5 text-ink">
                      {next.label}
                    </p>
                    <p className="type-label mt-1">
                      {getOwnerName(next.ownerId) + " · "}
                      <span
                        className={cn(
                          isActionOverdue(next) && "font-medium text-red",
                        )}
                      >
                        {formatDueDate(next.due)}
                      </span>
                      {openActions.length > 1
                        ? " · +" + (openActions.length - 1) + " more"
                        : ""}
                    </p>
                  </>
                ) : (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-5 text-red">
                    <AlertCircle
                      size={13}
                      strokeWidth={2}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0"
                    />
                    No open action currently carries this read forward.
                  </p>
                )}

                <p className="mt-2 flex flex-wrap gap-x-1.5 text-[13px] leading-5">
                  {retailers.map((retailer, n) => (
                    <Link
                      key={retailer.id}
                      href={"/retailers/" + retailer.id}
                      className="text-ink-muted transition-colors hover:text-forest"
                    >
                      {retailer.shortName +
                        (n < retailers.length - 1 ? "," : "")}
                    </Link>
                  ))}
                </p>
              </div>
            </li>
          );
        },
      )}
    </ol>
  );
}
