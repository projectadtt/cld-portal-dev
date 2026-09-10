import Link from "next/link";

import type { Broker } from "@/data/types";
import { cn } from "@/lib/cn";
import { UNASSIGNED } from "@/lib/selectors";

/**
 * Names the broker carrying an account — or says plainly that nobody is.
 *
 * assigned_broker_id is nullable, so every screen that names a broker has to
 * answer for the account that has none. Doing it here means the Overview, the
 * pipeline table, the workstream and the account page cannot drift into three
 * different words for the same gap, and none of them can be handed a
 * stand-in broker to link to.
 *
 * Unassigned is deliberately quiet rather than red: an account waiting for a
 * broker is a normal state on the way in, not a blocker CLD has failed to
 * clear. Red is reserved for accounts the attention layer has actually
 * flagged.
 */
export function BrokerName({
  broker,
  /** Table columns and dense rows want the short name. */
  short = false,
  className,
}: {
  broker: Broker | undefined;
  short?: boolean;
  className?: string;
}) {
  if (!broker) {
    return <span className={cn("text-ink-faint", className)}>{UNASSIGNED}</span>;
  }

  return (
    <Link
      href={"/brokers/" + broker.id}
      className={cn("transition-colors hover:text-forest", className)}
    >
      {short ? broker.shortName : broker.name}
    </Link>
  );
}
