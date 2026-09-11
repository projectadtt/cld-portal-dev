import Link from "next/link";

import { SectionHeader } from "@/components/primitives/SectionHeader";
import { meta } from "@/lib/cn";
import { UNASSIGNED, getWorkstreamGroups } from "@/lib/selectors";

/**
 * Who is carrying which accounts.
 *
 * Broker assignment is the client's first-named requirement, so it reads as a
 * section of its own rather than as a footnote under the funnel — and it sits
 * opposite what buyers are saying, which is the other half of the same
 * question: who is in the room, and what came back.
 *
 * Each name links straight into that broker's filtered book, which is also how
 * the coordination model gets demonstrated.
 */
export function AssignedBrokers() {
  const groups = getWorkstreamGroups();

  return (
    <section>
      <SectionHeader
        title="Assigned brokers"
        description="Who is carrying which accounts."
      />

      <ul className="space-y-3">
        {groups.map(({ broker, rows }) => {
          const count =
            rows.length === 1 ? "1 account" : rows.length + " accounts";

          return (
            <li
              key={broker?.id ?? "unassigned"}
              className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1"
            >
              {/* Accounts with no broker are named here too. This block is
                  the client's first-named requirement — who is on what —
                  so an account with nobody on it is the one row that most
                  needs to be visible, not the one to leave out. */}
              {broker ? (
                <Link
                  href={"/workstream?broker=" + broker.id}
                  className="text-sm text-ink transition-colors hover:text-forest"
                >
                  {broker.name}
                </Link>
              ) : (
                <span className="text-sm text-ink-muted">{UNASSIGNED}</span>
              )}
              <p className="type-label">{meta(broker?.coverage, count)}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
