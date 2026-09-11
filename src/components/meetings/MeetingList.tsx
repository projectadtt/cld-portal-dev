import { ArrowUpRight, CalendarClock } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/primitives/EmptyState";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { meta } from "@/lib/cn";
import {
  formatLongDate,
  relativeDateLabel,
  UNASSIGNED,
  type MeetingSummary,
} from "@/lib/selectors";
import { meetingRecordTone } from "@/lib/status";

/**
 * The record of meetings no longer ahead of us, most recent first.
 *
 * A three-column editorial row rather than a CRM table: when, who it was
 * with, and what came of it. The summary is the widest column because it is
 * the reason the record exists — squeezing it into a table cell would be
 * exactly the wrong trade.
 *
 * Both Completed and Cancelled meetings live here, so each row carries its
 * status: forest for one that happened, faint for one that did not. A
 * cancelled meeting is a diary change rather than a failure, so it is quiet
 * rather than red — and it is here at all because a record on neither tab has
 * effectively been deleted by the interface.
 *
 * The whole row is a link into the meeting record.
 */
export function MeetingList({ summaries }: { summaries: MeetingSummary[] }) {
  if (summaries.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        message="No meetings are on the record yet. Nothing has been held or cancelled."
      />
    );
  }

  return (
    <ul>
      {summaries.map(({ meeting, retailer, broker, followThrough }) => (
        <li
          key={meeting.id}
          className="border-t border-rule-soft first:border-t-0"
        >
          <Link
            href={"/meetings/" + meeting.id}
            className="group grid gap-x-10 gap-y-3 py-6 first:pt-0 lg:grid-cols-[7rem_1fr_1.4fr]"
          >
            <div className="lg:pt-0.5">
              <p className="text-[13px] leading-5 text-ink">
                {formatLongDate(meeting.date)}
              </p>
              {relativeDateLabel(meeting.date) ? (
                <p className="type-label mt-1">
                  {relativeDateLabel(meeting.date)}
                </p>
              ) : null}
            </div>

            <div className="min-w-0">
              <h3 className="flex items-start gap-1.5 font-display text-[1.0625rem] leading-snug tracking-[-0.005em] text-ink transition-colors group-hover:text-forest">
                {meeting.title}
                <ArrowUpRight
                  size={14}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className="mt-1 shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
                />
              </h3>
              {/* The whole row is already a link into the record, so the
                  broker is named rather than linked — BrokerName would nest
                  an anchor inside one. Same words as everywhere else. */}
              <p className="type-label mt-1.5">
                {meta(retailer.name, broker?.name ?? UNASSIGNED)}
              </p>

              {/* What became of it, so Completed and Cancelled are never read
                  as the same thing. Tone comes from the shared map. */}
              <StatusBadge
                label={meeting.status}
                tone={meetingRecordTone[meeting.status]}
                className="mt-2"
              />
            </div>

            <div className="min-w-0">
              {meeting.summary ? (
                <p className="max-w-[58ch] text-sm leading-relaxed text-ink-muted">
                  {meeting.summary}
                </p>
              ) : (
                <p className="text-sm leading-relaxed text-ink-faint">
                  Nothing written up yet.
                </p>
              )}

              <p className="type-label mt-2.5">
                {(meeting.decisions.length === 1
                  ? "1 decision"
                  : meeting.decisions.length + " decisions") +
                  " · " +
                  (followThrough.openActions.length === 0
                    ? "nothing outstanding"
                    : followThrough.openActions.length +
                      " open on this account")}
                {followThrough.overdue > 0 ? (
                  <span className="font-medium text-red">
                    {" · " + followThrough.overdue + " overdue"}
                  </span>
                ) : null}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
