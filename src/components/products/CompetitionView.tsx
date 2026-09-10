import Link from "next/link";

import { getPositioningReads } from "@/lib/selectors";

/**
 * The competitive read this workspace can honestly support today.
 *
 * There is no syndicated data behind the portal, so nothing here is modelled
 * or benchmarked. It shows how each product is positioned and every place a
 * buyer has answered that positioning in their own words — which is the only
 * competitive evidence CLD actually holds.
 *
 * The early-stage note is deliberate: an empty promise would be worse than a
 * stated limit.
 */
export function CompetitionView() {
  const reads = getPositioningReads();

  return (
    <div>
      <p className="max-w-[62ch] border-l-2 border-rule pl-5 text-sm leading-relaxed text-ink-muted">
        Competitive benchmarking is not part of this workspace yet. What
        follows is drawn only from how each product is positioned and what
        buyers have said back — no market share, no syndicated data, nothing
        estimated.
      </p>

      <ul className="mt-10 space-y-10">
        {reads.map(({ product, positioning, challenges, signals }) => (
          <li
            key={product.id}
            className="border-t border-rule-soft pt-6 first:border-t-0 first:pt-0"
          >
            <div className="grid gap-x-10 gap-y-5 lg:grid-cols-[1fr_1.15fr]">
              <div className="min-w-0">
                <h3 className="font-display text-[1.0625rem] leading-snug tracking-[-0.005em]">
                  <Link
                    href={"/products/" + product.id}
                    className="text-ink transition-colors hover:text-forest"
                  >
                    {product.name}
                  </Link>
                </h3>
                <p className="type-label mt-1">{product.category}</p>
                <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-ink-muted">
                  {positioning ?? (
                    <span className="text-ink-faint">No positioning written yet</span>
                  )}
                </p>
              </div>

              <div className="min-w-0">
                <p className="type-label">
                  {challenges.length === 0
                    ? "Buyer response"
                    : challenges.length === 1
                      ? "1 buyer response"
                      : challenges.length + " buyer responses"}
                </p>

                {challenges.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-faint">
                    No buyer has responded to this positioning yet.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-4">
                    {challenges.map((challenge) => (
                      <li key={challenge.retailer.id}>
                        <blockquote className="text-sm leading-relaxed text-ink">
                          {"“" + challenge.quote + "”"}
                        </blockquote>
                        <p className="type-label mt-1.5">
                          <Link
                            href={"/retailers/" + challenge.retailer.id}
                            className="transition-colors hover:text-forest"
                          >
                            {challenge.retailer.name}
                          </Link>
                          {challenge.theme ? " · " + challenge.theme : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                {signals.length > 0 ? (
                  <p className="mt-4 text-[13px] text-ink-muted">
                    {(signals.length === 1
                      ? "1 signal reads across this product: "
                      : signals.length + " signals read across this product: ") +
                      signals.map((s) => s.title).join("; ")}
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
