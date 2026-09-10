import { SearchX } from "lucide-react";

import { EmptyState } from "@/components/primitives/EmptyState";
import { SectionHeader } from "@/components/primitives/SectionHeader";
import { WorkstreamRow } from "@/components/workstream/WorkstreamRow";
import type { BrokerId } from "@/data/types";
import { UNASSIGNED, getAllBrokers, getWorkstreamGroups } from "@/lib/selectors";

/**
 * The workstream, grouped by broker.
 *
 * The broker heading carries the assignment without becoming a card — a name,
 * their coverage, and the size of their book, over a hairline rule.
 */
export function WorkstreamList({ brokerId }: { brokerId?: BrokerId }) {
  const groups = getWorkstreamGroups(brokerId);

  if (groups.length === 0) {
    /* Two different empty screens. One means the filter excluded everything;
       the other means the work has not started. Saying "no results" to
       someone who has not entered anything yet reads as a failure. */
    const nothingYet = getAllBrokers().length === 0 || !brokerId;
    return (
      <EmptyState
        icon={SearchX}
        message={
          nothingYet
            ? "No retail work is active yet. Assign a broker to an account and it will appear here."
            : "No retail accounts are assigned to this broker."
        }
      />
    );
  }

  return (
    <div className="space-y-10">
      {groups.map(({ broker, rows }) => (
        /* The trailing group has no broker: accounts nobody is carrying yet.
           They are headed as such rather than left off the screen, because
           work with no owner is precisely what this view is for. */
        <section key={broker?.id ?? "unassigned"}>
          <SectionHeader
            title={broker?.name ?? UNASSIGNED}
            description={
              broker
                ? broker.coverage
                : "No broker has been assigned to these accounts yet."
            }
            action={
              <p className="type-label">
                {rows.length === 1 ? "1 account" : rows.length + " accounts"}
              </p>
            }
          />

          <ul>
            {rows.map((row) => (
              <WorkstreamRow key={row.retailer.id} row={row} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
