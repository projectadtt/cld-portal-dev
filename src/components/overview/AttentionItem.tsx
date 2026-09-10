import { AlertCircle } from "lucide-react";
import Link from "next/link";

import { cn, meta } from "@/lib/cn";
import {
  UNASSIGNED,
  formatDueDate,
  getOwnerName,
  type AttentionSignal,
} from "@/lib/selectors";

/**
 * One account waiting on a decision.
 *
 * Compact by design — retailer, what is wrong, who owns the next move. Red is
 * carried by the left rule, the glyph, and an overdue date. Nothing else.
 */
export function AttentionItem({ signal }: { signal: AttentionSignal }) {
  const { retailer, broker, headline, nextAction, overdue } = signal;

  return (
    <article className="border-l-2 border-red py-1 pl-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="font-display text-[1.0625rem] leading-tight tracking-[-0.005em]">
          <Link
            href={"/retailers/" + retailer.id}
            className="text-ink transition-colors hover:text-forest"
          >
            {retailer.name}
          </Link>
        </h3>

        {nextAction ? (
          <p
            className={cn(
              "flex items-center gap-1.5 text-[13px] leading-5",
              overdue ? "font-medium text-red" : "text-ink-faint",
            )}
          >
            {overdue ? (
              <AlertCircle size={13} strokeWidth={2} aria-hidden="true" />
            ) : null}
            {meta(broker?.name ?? UNASSIGNED, "due " + formatDueDate(nextAction.due))}
            {overdue ? " · overdue" : ""}
          </p>
        ) : null}
      </div>

      <p className="mt-1.5 text-sm leading-normal text-ink-muted">{headline}</p>

      {/* Named only when the owner differs from the broker on the account.
          With no broker assigned there is nothing to differ from, so the
          action's owner is always worth naming. */}
      {nextAction && nextAction.ownerId !== broker?.id ? (
        <p className="type-label mt-1.5">
          {"Owner · " + getOwnerName(nextAction.ownerId)}
        </p>
      ) : null}
    </article>
  );
}
