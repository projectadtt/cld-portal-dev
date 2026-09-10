import Link from "next/link";

import type { Opportunity } from "@/data/types";
import { getProduct, getRetailerName, getOpportunitySignals } from "@/lib/selectors";

/**
 * Where the portfolio may have room to move next.
 *
 * Every signal traces back to buyer feedback already recorded on the tracker,
 * so each card names the products and accounts it was read from. Nothing here
 * is a market statistic — this is CLD's judgement, shown with its evidence.
 */
export function WhiteSpaceView() {
  const signals = getOpportunitySignals();

  return (
    <ul className="space-y-12">
      {signals.map((signal) => (
        <li
          key={signal.id}
          className="border-t border-rule-soft pt-7 first:border-t-0 first:pt-0"
        >
          <OpportunityEntry opportunity={signal} />
        </li>
      ))}
    </ul>
  );
}

function OpportunityEntry({ opportunity }: { opportunity: Opportunity }) {
  return (
    <article className="grid gap-x-10 gap-y-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="min-w-0">
        <p className="type-label">
          {opportunity.type + " · " + opportunity.confidence + " confidence"}
        </p>

        <h3 className="mt-2 max-w-[32ch] font-display text-[1.25rem] leading-snug tracking-[-0.005em] text-ink">
          {opportunity.title}
        </h3>

        <p className="mt-3.5 max-w-[58ch] text-[15px] leading-relaxed text-ink-muted">
          {opportunity.signal}
        </p>

        <p className="mt-5 max-w-[58ch] border-l-2 border-forest pl-5 text-[15px] leading-relaxed text-ink">
          {opportunity.recommendation}
        </p>
      </div>

      <div className="min-w-0 space-y-5">
        <div>
          <p className="type-label">Read from</p>
          <p className="mt-1.5 flex flex-wrap gap-x-1.5 text-sm leading-snug">
            {opportunity.productIds.map((id, i) => (
              <Link
                key={id}
                href={"/products/" + id}
                className="text-ink transition-colors hover:text-forest"
              >
                {getProduct(id).name +
                  (i < opportunity.productIds.length - 1 ? "," : "")}
              </Link>
            ))}
          </p>
        </div>

        <div>
          <p className="type-label">At</p>
          <p className="mt-1.5 flex flex-wrap gap-x-1.5 text-sm leading-snug">
            {opportunity.retailerIds.map((id, i) => (
              <Link
                key={id}
                href={"/retailers/" + id}
                className="text-ink transition-colors hover:text-forest"
              >
                {getRetailerName(id) +
                  (i < opportunity.retailerIds.length - 1 ? "," : "")}
              </Link>
            ))}
          </p>
        </div>

        <div className="border-t border-rule-soft pt-4">
          <p className="type-label">Next move</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">
            {opportunity.recommendedAction}
          </p>
        </div>
      </div>
    </article>
  );
}
