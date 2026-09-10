import { ArrowUpRight, NotebookPen } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/primitives/EmptyState";
import type { Meeting } from "@/lib/db/types";
import { formatLongDate, getOwnerName } from "@/lib/selectors";

/**
 * Meetings held on this account, most recent first.
 *
 * What was said, and what was decided as a result — the decisions are what
 * moved the account to where it stands, so they are given their own list
 * rather than folded into the summary.
 *
 * Each title opens its meeting record, where the decisions carry through to
 * the actions and the items they moved.
 */
export function RetailerMeetings({ meetings }: { meetings: Meeting[] }) {
  if (meetings.length === 0) {
    return (
      <EmptyState
        icon={NotebookPen}
        message="No meetings have been held on this account yet."
      />
    );
  }

  return (
    <ul className="space-y-10">
      {meetings.map((meeting) => (
        <li
          key={meeting.id}
          className="border-t border-rule-soft pt-6 first:border-t-0 first:pt-0"
        >
          <p className="type-label">
            {formatLongDate(meeting.date) +
              " · " +
              getOwnerName(meeting.brokerId)}
          </p>

          <h3 className="mt-1.5 font-display text-[1.0625rem] leading-tight tracking-[-0.005em]">
            <Link
              href={"/meetings/" + meeting.id}
              className="group inline-flex items-start gap-1.5 text-ink transition-colors hover:text-forest"
            >
              {meeting.title}
              <ArrowUpRight
                size={14}
                strokeWidth={1.75}
                aria-hidden="true"
                className="mt-1 shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
              />
            </Link>
          </h3>

          {meeting.summary ? (
            <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-ink-muted">
              {meeting.summary}
            </p>
          ) : (
            <p className="mt-3 text-sm text-ink-faint">
              Nothing was written up from this meeting.
            </p>
          )}

          {meeting.decisions.length > 0 ? (
            <div className="mt-5">
              <p className="type-label">Decisions</p>
              <ul className="mt-2 space-y-2">
                {meeting.decisions.map((decision) => (
                  <li
                    key={decision}
                    className="flex max-w-[64ch] gap-2.5 text-sm leading-snug text-ink"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[7px] size-1 shrink-0 rounded-full bg-forest"
                    />
                    {decision}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="type-label mt-5">
            {"In the room · " + meeting.attendees.join(", ")}
          </p>
        </li>
      ))}
    </ul>
  );
}
