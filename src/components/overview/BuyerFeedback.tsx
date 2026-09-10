import { SectionHeader } from "@/components/primitives/SectionHeader";
import { getBuyerFeedback } from "@/lib/selectors";

/**
 * What buyers are actually saying, pulled from the item-level feedback in the
 * workstream rather than a parallel list of quotes.
 *
 * Set as pull quotes: the buyer's words carry the section, attribution stays
 * quiet underneath.
 */
export function BuyerFeedback() {
  const quotes = getBuyerFeedback(3);

  return (
    <section>
      <SectionHeader
        title="What buyers are telling us"
        description="Themes from the most recent conversations."
      />

      <ul className="space-y-5">
        {quotes.map((quote) => (
          <li
            key={quote.retailer.id}
            className="border-t border-rule-soft pt-4 first:border-t-0 first:pt-0"
          >
            <blockquote className="text-[15px] leading-relaxed text-ink">
              {"“" + quote.quote + "”"}
            </blockquote>
            <p className="type-label mt-2">
              {quote.retailer.name + " buyer · " + quote.product.name}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
