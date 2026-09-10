import { MessageSquareQuote } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/primitives/EmptyState";
import type { ResolvedItem } from "@/lib/selectors";

/**
 * What the buyer actually said, set as prose.
 *
 * The most quotable thing on the account and the part a spreadsheet cannot
 * hold, so it carries editorial weight rather than a table cell. Attribution
 * is the item it was said about and the buyer role it came from — feedback is
 * never general, and the portal holds roles rather than invented names.
 */
export function RetailerFeedback({
  feedback,
  source,
}: {
  feedback: ResolvedItem[];
  /** The account's buyer contact, as recorded on the retailer. */
  source: string;
}) {
  if (feedback.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareQuote}
        message="No buyer feedback recorded yet."
      />
    );
  }

  return (
    <ul className="space-y-8">
      {feedback.map(({ record, product }) => (
        <li
          key={record.id}
          className="border-t border-rule-soft pt-6 first:border-t-0 first:pt-0"
        >
          <blockquote className="font-display text-[1.0625rem] leading-[1.55] tracking-[-0.005em] text-ink">
            {"“" + record.buyerFeedback + "”"}
          </blockquote>

          <p className="mt-3.5 text-[13px] leading-5 text-ink-muted">{source}</p>

          <p className="type-label mt-2.5">
            <Link
              href={"/products/" + product.id}
              className="transition-colors hover:text-forest"
            >
              {product.name}
            </Link>
            {record.feedbackTheme ? " · " + record.feedbackTheme : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
