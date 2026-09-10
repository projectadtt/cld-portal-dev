import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/PageHeader";
import { MeetingList } from "@/components/meetings/MeetingList";
import {
  MeetingTabs,
  parseMeetingView,
} from "@/components/meetings/MeetingTabs";
import { UpcomingMeetings } from "@/components/meetings/UpcomingMeetings";
import { getMeetingSummaries, getUpcomingMeetings, pageTitle } from "@/lib/selectors";
import { loadWorkspace } from "@/lib/db/workspace";

export async function generateMetadata(): Promise<Metadata> {
  await loadWorkspace();
  return { title: pageTitle("Meetings & Notes") };
}

/**
 * SCREEN 7 — Meetings & Notes.
 *
 * The record of what was actually said, and the thread from a conversation to
 * the work it created: meeting to notes to decision to action to workstream.
 *
 * Upcoming and past are read from different places on purpose. A meeting only
 * becomes a record once it has been held, so what is still ahead is read off
 * the account and what has happened is read off the meeting book.
 */
export default async function MeetingsPage({
  searchParams,
}: PageProps<"/meetings">) {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  const view = parseMeetingView((await searchParams).view);
  const upcoming = getUpcomingMeetings();
  const past = getMeetingSummaries();

  return (
    <>
      <PageHeader
        eyebrow="Meetings & Notes"
        title="What happened. What's next."
        description="Meeting notes, decisions, and follow-through connected to the retail work."
      >
        <div className="sm:text-right">
          <p className="type-label">On the record</p>
          <p className="mt-1.5 text-sm text-ink">
            {past.length + " meetings held · " + upcoming.length + " on the books"}
          </p>
        </div>
      </PageHeader>

      <div className="mt-2">
        <MeetingTabs
          active={view}
          counts={{ upcoming: upcoming.length, past: past.length }}
        />
      </div>

      <div className="mt-10 lg:mt-12">
        {view === "upcoming" ? (
          <section>
            {/* Said plainly, because the two tabs are read from different
                places and that difference is the honest part. */}
            <p className="mb-9 max-w-[62ch] border-l-2 border-rule pl-5 text-sm leading-relaxed text-ink-muted">
              What each account has on the books, with the last conversation
              and anything still outstanding. These become meeting records once
              they have been held.
            </p>
            <UpcomingMeetings meetings={upcoming} />
          </section>
        ) : (
          <section>
            <MeetingList summaries={past} />
          </section>
        )}
      </div>
    </>
  );
}
