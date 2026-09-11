import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MeetingEditForm } from "@/components/meetings/MeetingEditForm";
import { BrokerName } from "@/components/primitives/BrokerName";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { loadWorkspace } from "@/lib/db/workspace";
import { formatLongDate, getMeetingDetail, pageTitle } from "@/lib/selectors";
import { meetingRecordTone } from "@/lib/status";

/** Always fresh: a form is a picture of the record as it stands now. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/meetings/[meetingId]/edit">) {
  await loadWorkspace();
  const detail = getMeetingDetail((await params).meetingId);
  return {
    title: pageTitle(
      detail ? "Write up " + detail.meeting.title : "Write up meeting",
    ),
  };
}

/**
 * Writing up one meeting.
 *
 * The record is named above the form rather than inside it — the account, the
 * day, the broker and where the meeting currently stands are context, not
 * fields. What can be changed is what a conversation produces: the notes, the
 * decisions, and whether it has happened yet.
 */
export default async function EditMeetingPage({
  params,
}: PageProps<"/meetings/[meetingId]/edit">) {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  const { meetingId } = await params;

  const detail = getMeetingDetail(meetingId);
  if (!detail) notFound();

  const { meeting, retailer, broker } = detail;

  return (
    <>
      <header className="mb-2">
        <Link
          href={"/meetings/" + meeting.id}
          className="type-label inline-flex items-center gap-1.5 transition-colors hover:text-forest"
        >
          <ArrowLeft size={12} strokeWidth={2} aria-hidden="true" />
          {meeting.title}
        </Link>

        <h1 className="mt-4 font-display text-[2.125rem] leading-[1.1] tracking-[-0.015em] text-ink sm:text-[2.5rem]">
          Write up the meeting.
        </h1>

        {/* Which meeting, stated plainly. None of it is editable here: a
            record is a fact about a conversation that took place, and a form
            able to rewrite which conversation it was is not an edit. */}
        <div className="mt-5 border-y border-rule py-4">
          <p className="type-label flex flex-wrap gap-x-1.5">
            <Link
              href={"/retailers/" + retailer.id}
              className="transition-colors hover:text-forest"
            >
              {retailer.name}
            </Link>
            <span aria-hidden="true">·</span>
            <span>{formatLongDate(meeting.date)}</span>
            <span aria-hidden="true">·</span>
            <BrokerName broker={broker} />
          </p>

          <p className="mt-2.5">
            <StatusBadge
              label={meeting.status}
              tone={meetingRecordTone[meeting.status]}
            />
          </p>
        </div>

        <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
          The account, the day and the broker are part of what this meeting is,
          so they are not edited here. What a conversation produces is.
        </p>
      </header>

      <MeetingEditForm
        meetingId={meeting.id}
        values={{
          summary: meeting.summary ?? "",
          /* text[] shown the way it is entered: one decision per line. */
          decisions: meeting.decisions.join("\n"),
          status: meeting.status,
        }}
        cancelHref={"/meetings/" + meeting.id}
      />
    </>
  );
}
