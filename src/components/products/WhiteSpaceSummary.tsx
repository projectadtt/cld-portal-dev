import Link from "next/link";

import { getOpportunitySignals, getProduct } from "@/lib/selectors";

/**
 * Where the portfolio may have room to move next, in one line each.
 *
 * Every signal was read across more than one account, so this section names
 * the products it came from and leaves the evidence to the White space tab.
 * Nothing here is a market statistic — it is CLD's judgement, and the tab
 * shows the buyer words it was judged from.
 */
export function WhiteSpaceSummary() {
  const signals = getOpportunitySignals();

  return (
    <ul>
      {signals.map((opportunity) => (
        <li
          key={opportunity.id}
          className="grid gap-x-10 gap-y-2 border-t border-rule-soft py-5 first:border-t-0 first:pt-0 lg:grid-cols-[1.4fr_1fr]"
        >
          <div className="min-w-0">
            <h3 className="max-w-[38ch] font-display text-[1.0625rem] leading-snug tracking-[-0.005em] text-ink">
              {opportunity.title}
            </h3>
            <p className="type-label mt-1.5">
              {opportunity.type + " · " + opportunity.confidence + " confidence"}
            </p>
          </div>

          <div className="min-w-0">
            <p className="max-w-[46ch] text-sm leading-snug text-ink">
              {opportunity.recommendedAction}
            </p>
            <p className="type-label mt-1.5 flex flex-wrap gap-x-1.5">
              {opportunity.productIds.map((id, i) => (
                <Link
                  key={id}
                  href={"/products/" + id}
                  className="transition-colors hover:text-forest"
                >
                  {getProduct(id).name +
                    (i < opportunity.productIds.length - 1 ? "," : "")}
                </Link>
              ))}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
