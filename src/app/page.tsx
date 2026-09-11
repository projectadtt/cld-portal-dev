import { PageHeader } from "@/components/layout/PageHeader";
import { AssignedBrokers } from "@/components/overview/AssignedBrokers";
import { AttentionList } from "@/components/overview/AttentionList";
import { BuyerFeedback } from "@/components/overview/BuyerFeedback";
import { NextMoves } from "@/components/overview/NextMoves";
import { NotYet } from "@/components/overview/NotYet";
import { OpportunityMap } from "@/components/overview/OpportunityMap";
import { ProgressSummary } from "@/components/overview/ProgressSummary";
import { RetailerProgress } from "@/components/overview/RetailerProgress";
import { SectionHeader } from "@/components/primitives/SectionHeader";
import { SectionLink } from "@/components/primitives/SectionLink";
import { WorkspaceSetup } from "@/components/setup/WorkspaceSetup";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import { DEMO_TODAY } from "@/lib/demo";
import { getClient, formatLongDate, getRecentActivity } from "@/lib/selectors";
import { loadWorkspace } from "@/lib/db/workspace";

/** Enough recent activity to give context without becoming the activity screen. */
const ACTIVITY_PREVIEW = 4;

/**
 * SCREEN 1 — Client Overview.
 *
 * Reading order answers the four questions in turn: where are we (summary),
 * what needs attention, what happens next (moves), what is moving (progress
 * and activity), and finally the lightweight judgement layer — where the
 * opportunity is, what buyers are saying, and what CLD is holding back.
 */
export default async function OverviewPage() {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  const client = getClient();

  /* An empty database has no client, and nothing below this line has anything
     to render. The portal asks to be set up instead — the same page, at the
     only stage of its life where there is nothing to report. */
  if (!client) return <WorkspaceSetup />;

  const recent = getRecentActivity(ACTIVITY_PREVIEW);

  return (
    <>
      <PageHeader
        eyebrow="Client portal"
        title="Here's where things stand."
        description="Real progress. A clear plan. The right order."
      >
        <div className="sm:text-right">
          <p className="type-label">Client</p>
          <p className="mt-1.5 text-sm text-ink">
            {client.name + " · " + client.workspace}
          </p>
          <p className="type-label mt-3">{"As of " + formatLongDate(DEMO_TODAY)}</p>
        </div>
      </PageHeader>

      <ProgressSummary />

      <div className="mt-14 space-y-14 lg:mt-16 lg:space-y-16">
        {/* What is stuck, and what to do about it. */}
        <div className="grid gap-14 lg:grid-cols-[1.35fr_1fr] lg:gap-14">
          <AttentionList />
          <NextMoves />
        </div>

        {/* What is moving, in two bands rather than two free-running columns.
            Each section is placed on the grid explicitly, so the second band
            starts on one line across both columns: who is carrying the
            accounts sits level with what those accounts' buyers said, which is
            the pairing worth reading across. The cost is some air beneath a
            short activity list, and that is the right trade — a shared
            baseline is what makes the page read as composed rather than as two
            stacks that happen to be side by side.

            Source order is the reading order, so the stack below lg runs
            progress, brokers, activity, feedback without any reordering. */}
        <div className="grid items-start gap-14 lg:grid-cols-[1.35fr_1fr] lg:gap-x-14 lg:gap-y-16">
          <div className="lg:col-start-1 lg:row-start-1">
            <RetailerProgress />
          </div>

          <div className="lg:col-start-1 lg:row-start-2">
            <AssignedBrokers />
          </div>

          <section className="lg:col-start-2 lg:row-start-1">
            <SectionHeader
              title="Recent activity"
              description="Latest updates across retailers."
              action={
                <SectionLink href="/activity" cta>View all activity</SectionLink>
              }
            />
            <ActivityTimeline activities={recent} />
          </section>

          <div className="lg:col-start-2 lg:row-start-2">
            <BuyerFeedback />
          </div>
        </div>

        {/* The one chart on the page, given the full width and centred in it.
            In a side column it was cramped against its own labels and pulled
            the left stack out of balance; on its own band it reads as the
            judgement layer it is, sitting between the work above and what CLD
            is holding back below. */}
        <div className="mx-auto w-full max-w-[34rem]">
          <OpportunityMap />
        </div>

        <NotYet />
      </div>
    </>
  );
}
