import { CalendarClock } from "lucide-react";

import { EmptyState } from "@/components/primitives/EmptyState";
import { cn } from "@/lib/cn";
import {
  formatRelativeDate,
  getOwnerName,
  type RetailerEvent,
} from "@/lib/selectors";

/**
 * The account's history as a vertical thread.
 *
 * Every entry is a meeting or a logged activity that already exists in the
 * data. Short histories stay short — an account contacted once shows one
 * event rather than filler.
 *
 * A meeting still on the books sits at the top with an open marker, so the
 * thread reads forward as well as back.
 */
export function RetailerTimeline({
  events,
  limit,
}: {
  events: RetailerEvent[];
  limit?: number;
}) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        message="Nothing logged on this account yet."
      />
    );
  }

  const shown = limit === undefined ? events : events.slice(0, limit);

  return (
    <ol className="border-l border-rule pl-6">
      {shown.map((event) => (
        <li key={event.id} className="relative pb-7 last:pb-0">
          <span
            aria-hidden="true"
            className={cn(
              "absolute -left-[28px] top-[7px] size-[7px] rounded-full",
              event.upcoming
                ? "border border-forest bg-paper"
                : "bg-ink-muted",
            )}
          />

          <p className="type-label">
            {formatRelativeDate(event.date) +
              " · " +
              event.label +
              (event.personId ? " · " + getOwnerName(event.personId) : "")}
          </p>

          <p className="mt-1.5 max-w-[62ch] text-sm leading-snug text-ink">
            {event.headline}
          </p>

          {event.detail ? (
            <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-ink-muted">
              {event.detail}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
