import { CheckCircle2 } from "lucide-react";

import { AttentionItem } from "@/components/overview/AttentionItem";
import { EmptyState } from "@/components/primitives/EmptyState";
import { SectionHeader } from "@/components/primitives/SectionHeader";
import { SectionLink } from "@/components/primitives/SectionLink";
import { getAttentionSignals } from "@/lib/selectors";

/** An overview should not carry more than a meeting can absorb. */
const LIMIT = 3;

/**
 * The page's focal point: accounts flagged by their broker, plus anything
 * whose next move has slipped past its due date.
 */
export function AttentionList() {
  const signals = getAttentionSignals().slice(0, LIMIT);

  return (
    <section>
      <SectionHeader
        lead
        title="What needs attention"
        description="Retailers waiting on a decision or a response."
        action={<SectionLink href="/workstream" cta>View all</SectionLink>}
      />

      {signals.length > 0 ? (
        <div className="space-y-7">
          {signals.map((signal) => (
            <AttentionItem key={signal.retailer.id} signal={signal} />
          ))}
        </div>
      ) : (
        /* Boxed: this sits in a column beside a section that is full, where a
           bare grey line reads as a failure to load rather than as good news.
           The second line says what the first one covers — every account on
           the book, not merely the ones in view. */
        <EmptyState
          boxed
          icon={CheckCircle2}
          message="Nothing is waiting on a decision right now."
          detail="Every account on the book is either moving or already answered."
        />
      )}
    </section>
  );
}
