import { StatusBadge } from "@/components/primitives/StatusBadge";
import { SectionHeader } from "@/components/primitives/SectionHeader";
import { SectionLink } from "@/components/primitives/SectionLink";
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
 * to browse. Overdue reuses the derived attention treatment — the stored
 * status stays Open.
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

      <ol className="space-y-5">
        {moves.map((action, index) => {
          const overdue = isActionOverdue(action);

          return (
            <li key={action.id} className="flex gap-4">
              <span className="mt-0.5 shrink-0 font-display text-[13px] leading-5 text-ink-faint tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-ink">{action.label}</p>

                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-5 gap-y-1">
                  {/* Retailer is left off: it is already named in the action
                      itself, and a shorter line keeps the status inline. */}
                  <p className="type-label">
                    {getOwnerName(action.ownerId) +
                      " · due " +
                      formatDueDate(action.due)}
                  </p>

                  <StatusBadge
                    label={overdue ? "Overdue" : action.status}
                    tone={overdue ? "attention" : actionStatusTone[action.status]}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
