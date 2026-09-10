import { ArrowUpRight, CalendarClock } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/primitives/EmptyState";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { cn } from "@/lib/cn";
import {
  formatDueDate,
  formatLongDate,
  getOwnerName,
  isActionOverdue,
  relativeDateLabel,
  type UpcomingMeeting,
} from "@/lib/selectors";

/**
 * Meetings still ahead, and what to walk in with.
 *
 * These are not meeting records. A meeting only becomes a record once it has
 * been held and there is something to write down, so what is on the books is
 * read off the account instead — which is also why these rows open the
 * retailer rather than a meeting page.
 *
 * Each row carries the two things worth knowing beforehand: what was decided
 * last time, and what is still outstanding going in.
 */
export function UpcomingMeetings({ meetings }: { meetings: UpcomingMeeting[] }) {
  if (meetings.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        message="No meetings are on the books. Nothing has been scheduled or requested on any account."
      />
    );
  }

  return (
    <ul>
      {meetings.map(({ retailer, broker, status, date, lastMeeting, openActions }) => {
        const next = openActions[0];
        const overdue = next ? isActionOverdue(next) : false;

        return (
          <li
            key={retailer.id}
            className="grid gap-x-10 gap-y-3 border-t border-rule-soft py-6 first:border-t-0 first:pt-0 lg:grid-cols-[7rem_1fr_1.4fr]"
          >
            <div className="lg:pt-0.5">
              {date ? (
                <>
                  <p className="text-[13px] leading-5 text-ink">
                    {formatLongDate(date)}
                  </p>
                  {relativeDateLabel(date) ? (
                    <p className="type-label mt-1">{relativeDateLabel(date)}</p>
                  ) : null}
                </>
              ) : (
                <p className="text-[13px] leading-5 text-ink-faint">
                  Date not set
                </p>
              )}
            </div>

            <div className="min-w-0">
              <h3 className="font-display text-[1.0625rem] leading-snug tracking-[-0.005em]">
                <Link
                  href={"/retailers/" + retailer.id}
                  className="group inline-flex items-start gap-1.5 text-ink transition-colors hover:text-forest"
                >
                  {retailer.name}
                  <ArrowUpRight
                    size={14}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className="mt-1 shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </Link>
              </h3>

              <p className="type-label mt-1.5">
                <Link
                  href={"/brokers/" + broker.id}
                  className="transition-colors hover:text-forest"
                >
                  {broker.name}
                </Link>
              </p>

              <StatusBadge
                label={status}
                tone={status === "Scheduled" ? "active" : "neutral"}
                className="mt-2"
              />
            </div>

            <div className="min-w-0">
              {lastMeeting ? (
                <>
                  <p className="type-label">
                    {"Last met " + formatLongDate(lastMeeting.date)}
                  </p>
                  <p className="mt-1.5 max-w-[58ch] text-sm leading-snug">
                    <Link
                      href={"/meetings/" + lastMeeting.id}
                      className="text-ink transition-colors hover:text-forest"
                    >
                      {lastMeeting.title}
                    </Link>
                  </p>
                  {lastMeeting.decisions.length > 0 ? (
                    <p className="mt-2 max-w-[58ch] text-sm leading-relaxed text-ink-muted">
                      {lastMeeting.decisions.join(" · ")}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-ink-faint">
                  No meeting has been held with this account yet.
                </p>
              )}

              <p className="mt-3 border-t border-rule-soft pt-3">
                {next ? (
                  <>
                    <Link
                      href="/actions"
                      className="block text-sm leading-snug text-ink transition-colors hover:text-forest"
                    >
                      {next.label}
                    </Link>
                    <span
                      className={cn(
                        "mt-1 block text-[13px]",
                        overdue ? "font-medium text-red" : "text-ink-faint",
                      )}
                    >
                      {getOwnerName(next.ownerId) +
                        " · due " +
                        formatDueDate(next.due) +
                        (overdue ? " · overdue" : "") +
                        (openActions.length > 1
                          ? " · " + openActions.length + " open"
                          : "")}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-ink-faint">
                    Nothing outstanding on this account.
                  </span>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
