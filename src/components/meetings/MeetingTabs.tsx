import Link from "next/link";

import { cn } from "@/lib/cn";

/**
 * Two readings of the same book of meetings. Adding a view here is the only
 * place the vocabulary is defined.
 */
export const MEETING_VIEWS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past meetings" },
] as const;

export type MeetingView = (typeof MEETING_VIEWS)[number]["id"];

const DEFAULT_VIEW: MeetingView = "upcoming";

/** Anything unrecognised falls back to the default rather than 404ing. */
export function parseMeetingView(
  value: string | string[] | undefined,
): MeetingView {
  const candidate = Array.isArray(value) ? value[0] : value;
  return MEETING_VIEWS.some((view) => view.id === candidate)
    ? (candidate as MeetingView)
    : DEFAULT_VIEW;
}

/**
 * The view lives in the URL the way it does on every other screen: the page
 * stays server-rendered, and a given tab is linkable mid-meeting.
 */
export function MeetingTabs({
  active,
  counts,
}: {
  active: MeetingView;
  counts: Record<MeetingView, number>;
}) {
  return (
    <nav
      aria-label="Meeting views"
      className="-mx-6 overflow-x-auto border-b border-rule px-6 sm:mx-0 sm:px-0"
    >
      <div className="flex min-w-max gap-8">
        {MEETING_VIEWS.map((view) => {
          const selected = view.id === active;

          return (
            <Link
              key={view.id}
              href={
                view.id === DEFAULT_VIEW ? "/meetings" : "/meetings?view=" + view.id
              }
              aria-current={selected ? "page" : undefined}
              className={cn(
                "-mb-px flex items-baseline gap-2 whitespace-nowrap border-b-2 pb-3 text-sm transition-colors",
                selected
                  ? "border-forest font-medium text-forest"
                  : "border-transparent text-ink-muted hover:border-rule hover:text-ink",
              )}
            >
              {view.label}
              <span className="type-label">{counts[view.id]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
