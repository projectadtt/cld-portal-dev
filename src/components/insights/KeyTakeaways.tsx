import { ChevronDown } from "lucide-react";
import Link from "next/link";

import { getMarketTakeaways, type MarketTakeaway } from "@/lib/selectors";

/**
 * One read, compressed to a row that can be scanned in a second.
 *
 * The row carries only what decides whether to read further: the rank, the
 * claim, and how much of the book it is standing on. The argument beneath it
 * opens on demand, so the section scans at a glance and can still be defended
 * line by line when a client asks where a read came from.
 *
 * The disclosure is a native <details>. It reveals; it never records. Nothing
 * on this page writes anything.
 */
function Takeaway({
  takeaway,
  rank,
}: {
  takeaway: MarketTakeaway;
  /** Position in the ranking, so the order on the page is legible as one. */
  rank: number;
}) {
  const { opportunity, evidence, products, retailers } = takeaway;
  const accounts = new Set(evidence.map((e) => e.retailer.id)).size;

  /* Counts what has actually been heard. The account names on the line below
     are the read's scope, which is deliberately the wider set — a read can
     name an account that has not answered yet, and that gap is worth seeing. */
  const evidenceLine =
    evidence.length === 0
      ? "Read across the accounts rather than from a recorded response"
      : (evidence.length === 1
          ? "1 buyer response"
          : evidence.length + " buyer responses") +
        " from " +
        (accounts === 1 ? "1 account" : accounts + " accounts");

  return (
    <li className="border-t border-rule-soft first:border-t-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start gap-5 py-4 [&::-webkit-details-marker]:hidden">
          {/* The list is ordered by confidence; numbering it makes that
              ordering visible instead of leaving it to be inferred, and gives
              the actions below something to refer back to. */}
          <span
            aria-hidden="true"
            className="mt-px flex size-7 shrink-0 items-center justify-center rounded-full border border-rule font-display text-[13px] text-forest"
          >
            {rank}
          </span>

          <div className="grid min-w-0 flex-1 gap-x-10 gap-y-2 lg:grid-cols-[1.4fr_1fr]">
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
            </div>

            <div className="min-w-0">
              <p className="text-[13px] leading-5 text-ink">{evidenceLine}</p>
              <p className="type-label mt-1">
                {"Across " + retailers.map((r) => r.shortName).join(", ")}
              </p>
            </div>
          </div>

          <span className="mt-0.5 hidden shrink-0 items-center gap-1.5 text-[13px] text-ink-muted transition-colors group-hover:text-forest sm:flex">
            <span className="group-open:hidden">The evidence</span>
            <span className="hidden group-open:inline">Less</span>
            <ChevronDown
              size={14}
              strokeWidth={1.75}
              aria-hidden="true"
              className="transition-transform group-open:rotate-180"
            />
          </span>

          <ChevronDown
            size={14}
            strokeWidth={1.75}
            aria-hidden="true"
            className="mt-1 shrink-0 text-ink-faint transition-transform group-open:rotate-180 sm:hidden"
          />
        </summary>

        <div className="grid gap-x-10 gap-y-6 pb-8 pl-0 sm:pl-12 lg:grid-cols-[1.4fr_1fr]">
          <div className="min-w-0">
            <p className="max-w-[58ch] text-[15px] leading-relaxed text-ink-muted">
              {opportunity.signal}
            </p>
            <p className="mt-5 max-w-[58ch] border-l-2 border-forest pl-5 text-[15px] leading-relaxed text-ink">
              {opportunity.recommendation}
            </p>
          </div>

          <div className="min-w-0 space-y-5">
            {evidence.length > 0 ? (
              <div>
                <p className="type-label">What was said</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink">
                  {evidence.map((e) => e.theme ?? e.product.name).join(", ") +
                    "."}
                </p>
              </div>
            ) : null}

            <div>
              <p className="type-label">Read from</p>
              <p className="mt-1.5 flex flex-wrap gap-x-1.5 text-sm leading-snug">
                {products.map((product, i) => (
                  <Link
                    key={product.id}
                    href={"/products/" + product.id}
                    className="text-ink transition-colors hover:text-forest"
                  >
                    {product.name + (i < products.length - 1 ? "," : "")}
                  </Link>
                ))}
              </p>
            </div>

            <div>
              <p className="type-label">At</p>
              <p className="mt-1.5 flex flex-wrap gap-x-1.5 text-sm leading-snug">
                {retailers.map((retailer, i) => (
                  <Link
                    key={retailer.id}
                    href={"/retailers/" + retailer.id}
                    className="text-ink transition-colors hover:text-forest"
                  >
                    {retailer.name + (i < retailers.length - 1 ? "," : "")}
                  </Link>
                ))}
              </p>
            </div>

            <div className="border-t border-rule-soft pt-4">
              <p className="type-label">Next move</p>
              <p className="mt-1.5 max-w-[46ch] text-sm leading-relaxed text-ink">
                {opportunity.recommendedAction}
              </p>
            </div>
          </div>
        </div>
      </details>
    </li>
  );
}

export function KeyTakeaways() {
  return (
    <ul>
      {getMarketTakeaways().map((takeaway, i) => (
        <Takeaway
          key={takeaway.opportunity.id}
          takeaway={takeaway}
          rank={i + 1}
        />
      ))}
    </ul>
  );
}
