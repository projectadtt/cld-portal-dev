import { ListChecks } from "lucide-react";

import { EmptyState } from "@/components/primitives/EmptyState";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { SectionHeader } from "@/components/primitives/SectionHeader";
import { SectionLink } from "@/components/primitives/SectionLink";
import { cn } from "@/lib/cn";
import {
  formatDueDate,
  getOwnerName,
  getUpcomingActions,
  isActionOverdue,
} from "@/lib/selectors";
import { actionStatusTone } from "@/lib/status";

/**
 * The three most urgent open actions, numbered.
 *
 * The ordinal is the point: this is a sequence to work through, not a backlog
 * to browse. Each move is a tile because each is a separate thing to pick up —
 * the numbers and the dates have to be findable at a glance, which a running
 * list does not do as well.
 *
 * The date moves to a pill on the right, where it can be read down the column
 * without tracking across each line. Overdue reuses the derived attention
 * treatment — the stored status stays Open — and it is the only thing here
 * that may turn red.
 */
export function NextMoves() {
  const moves = getUpcomingActions(3);

  return (
    <section>
      <SectionHeader
        lead
        title="Next 3 moves"
        description="The most urgent actions right now."
        action={<SectionLink href="/actions" cta>View all actions</SectionLink>}
      />

      {/* An account book with nothing open on it is a real state, and a
          common one early on — it is also what the section beside this one
          already says out loud rather than leaving blank. Without this the
          heading sat over empty space and read as something that had failed
          to load. */}
      {moves.length === 0 ? (
        <EmptyState
          boxed
          icon={ListChecks}
          message="Nothing is on the action list right now."
          detail="Next moves appear here as soon as work is assigned a date."
        />
      ) : (
        <ol className="space-y-3">
          {moves.map((action, index) => {
            const overdue = isActionOverdue(action);

            return (
              <li
                key={action.id}
                className="flex items-start gap-3.5 rounded-card border border-rule bg-paper px-4 py-4 shadow-card"
              >
                {/* The ordinal, as a mark rather than as text: it is the one
                    thing that has to survive a glance down the column. */}
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md font-display text-[12px] leading-none tabular-nums",
                    overdue
                      ? "bg-red-tint text-red"
                      : "bg-rule-soft text-ink-muted",
                  )}
                >
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug font-medium text-ink">
                    {action.label}
                  </p>

                  {/* Retailer is left off: it is already named in the action
                      itself. Owner and status stay — a Blocked move that
                      looked like an ordinary one would be the worst thing
                      this section could do. */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <p className="type-label">{getOwnerName(action.ownerId)}</p>
                    <StatusBadge
                      label={overdue ? "Overdue" : action.status}
                      tone={overdue ? "attention" : actionStatusTone[action.status]}
                    />
                  </div>
                </div>

                <span
                  className={cn(
                    "type-label shrink-0 rounded-full px-2.5 py-1",
                    overdue
                      ? "bg-red-tint text-red"
                      : "bg-rule-soft text-ink-muted",
                  )}
                >
                  {formatDueDate(action.due)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
