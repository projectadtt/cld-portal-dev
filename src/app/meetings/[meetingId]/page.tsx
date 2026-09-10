import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SectionHeader } from "@/components/primitives/SectionHeader";
import { SectionLink } from "@/components/primitives/SectionLink";
import { RetailerItems } from "@/components/retailer/RetailerItems";
import { ActionList } from "@/components/shared/ActionList";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import { loadWorkspace } from "@/lib/db/workspace";
import {
  formatLongDate,
  getMeetingDetail,
  relativeDateLabel,
} from "@/lib/selectors";

export async function generateMetadata({
  params,
}: PageProps<"/meetings/[meetingId]">) {
  await loadWorkspace();
  const detail = getMeetingDetail((await params).meetingId);
  return { title: detail ? detail.meeting.title + " — Meetings" : "Meeting" };
}

/**
 * One meeting record.
 *
 * Reads the way the conversation actually travels: who it was with, what was
 * said, what was decided, what has to happen because of it, and what all of
 * that is doing to the items on the account.
 *
 * Actions and workstream records belong to the account, not to this meeting —
 * the data records no link from a meeting to an item — so they are presented
 * as the state of the account rather than as this meeting's output.
 */
export default async function MeetingDetailPage({
  params,
}: PageProps<"/meetings/[meetingId]">) {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  const detail = getMeetingDetail((await params).meetingId);
  if (!detail) notFound();

  const { meeting, retailer, broker, openActions, items, activities } = detail;

  return (
    <>
      <header className="mb-9">
        <Link
          href="/meetings?view=past"
          className="type-label inline-flex items-center gap-1.5 transition-colors hover:text-forest"
        >
          <ArrowLeft size={12} strokeWidth={2} aria-hidden="true" />
          Meetings &amp; Notes
        </Link>

        <div className="mt-5 border-b border-rule pb-8">
          <p className="type-label">
            <Link
              href={"/retailers/" + retailer.id}
              className="transition-colors hover:text-forest"
            >
              {retailer.name}
            </Link>
            {" · " + retailer.channel}
          </p>

          <h1 className="mt-2.5 max-w-[24ch] font-display text-[2rem] leading-[1.1] tracking-[-0.015em] text-ink sm:text-[2.25rem]">
            {meeting.title}
          </h1>

          <p className="type-label mt-3.5">
            {formatLongDate(meeting.date) +
              (relativeDateLabel(meeting.date)
                ? " · " + relativeDateLabel(meeting.date)
                : "") +
              " · "}
            <Link
              href={"/brokers/" + broker.id}
              className="transition-colors hover:text-forest"
            >
              {broker.name}
            </Link>
          </p>

          <p className="type-label mt-2">
            {"In the room · " + meeting.attendees.join(", ")}
          </p>
        </div>
      </header>

      <div className="space-y-14 lg:space-y-16">
        {/* Notes beside decisions: what was said, and what it settled. */}
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <section>
            <SectionHeader
              title="Meeting notes"
              description="What was actually said in the room."
            />
            <p className="max-w-[62ch] text-[15px] leading-relaxed text-ink">
              {meeting.summary}
            </p>
          </section>

          {/* Only rendered when the record actually settled something. */}
          {meeting.decisions.length > 0 ? (
            <section>
              <SectionHeader
                title="Decisions"
                description="What the meeting settled, and what moved the account as a result."
              />
              <ul className="space-y-3">
                {meeting.decisions.map((decision) => (
                  <li
                    key={decision}
                    className="flex max-w-[58ch] gap-2.5 text-[15px] leading-relaxed text-ink"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[9px] size-1 shrink-0 rounded-full bg-forest"
                    />
                    {decision}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <section>
          <SectionHeader
            title="Follow-through"
            description={
              "Tracked work still open on " +
              retailer.name +
              ". These carry an owner and a date; the meeting record's own notes do not."
            }
            action={<SectionLink href="/actions">All actions</SectionLink>}
          />
          <div className="max-w-[70ch]">
            <ActionList
              actions={openActions}
              emptyMessage="Nothing on the shared action list for this account yet."
            />
          </div>
        </section>

        <section>
          <SectionHeader
            title="Workstream impact"
            description={
              "Where the items on " +
              retailer.name +
              " stand today. The account carries these, not this meeting alone."
            }
            action={
              <SectionLink href={"/retailers/" + retailer.id}>
                The account
              </SectionLink>
            }
          />
          <RetailerItems rows={items} />
        </section>

        <section>
          <SectionHeader
            title="Related activity"
            description="Everything else logged on this account, most recent first."
          />
          <div className="max-w-[70ch]">
            <ActivityTimeline
              activities={activities}
              showRetailer={false}
              emptyMessage="Nothing else has been logged on this account."
            />
          </div>
        </section>
      </div>
    </>
  );
}
