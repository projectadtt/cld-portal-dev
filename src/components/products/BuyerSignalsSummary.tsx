import { MessageSquareQuote } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/primitives/EmptyState";
import { getBuyerSignals } from "@/lib/selectors";

/**
 * What buyers have actually said about the range.
 *
 * The only competitive evidence this workspace holds, so the limit is stated
 * rather than papered over: there is no syndicated data behind the portal and
 * nothing here is modelled, benchmarked, or estimated.
 *
 * Ordered by how far the item has travelled, so the responses carrying the
 * most decision weight lead. The Competition tab pairs each of these back to
 * the positioning it was answering.
 */
export function BuyerSignalsSummary({ limit = 4 }: { limit?: number }) {
  const signals = getBuyerSignals(limit);

  return (
    <div>
      <p className="max-w-[62ch] border-l-2 border-rule pl-5 text-sm leading-relaxed text-ink-muted">
        Competitive benchmarking is not connected to this workspace. What
        follows is drawn only from what buyers have said back — no market
        share, no syndicated data, nothing estimated.
      </p>

      {signals.length === 0 ? (
        <EmptyState
          icon={MessageSquareQuote}
          message="No buyer has responded to the range yet."
          className="mt-6"
        />
      ) : (
        <ul className="mt-8 grid gap-x-12 gap-y-8 lg:grid-cols-2">
          {signals.map(({ record, product, retailer, quote, theme }) => (
            <li key={record.id} className="border-t border-rule-soft pt-5">
              <blockquote className="max-w-[46ch] font-display text-[1.0625rem] leading-[1.55] tracking-[-0.005em] text-ink">
                {"“" + quote + "”"}
              </blockquote>

              <p className="type-label mt-3 flex flex-wrap gap-x-1.5">
                <Link
                  href={"/products/" + product.id}
                  className="transition-colors hover:text-forest"
                >
                  {product.name}
                </Link>
                <span aria-hidden="true">·</span>
                <Link
                  href={"/retailers/" + retailer.id}
                  className="transition-colors hover:text-forest"
                >
                  {retailer.shortName}
                </Link>
                {theme ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{theme}</span>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
