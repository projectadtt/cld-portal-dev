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
      {/* Who is looking and when, on one line above the title.
          It used to sit as a stacked block to the right of the headline,
          where it competed with it for the same corner. As a strip it is
          read once on arrival and then ignored, which is all it is for.

          Built here rather than in PageHeader because that component opens
          all ten screens, and this is the Overview's turn only. */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-b border-rule pb-4">
        <p className="type-label flex items-center gap-2">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-forest" />
          Client portal
        </p>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <p className="type-label text-ink">
            {"Client: " + client.name + " · " + client.workspace}
          </p>
          <p className="type-label">{"As of " + formatLongDate(DEMO_TODAY)}</p>
        </div>
      </div>

      <PageHeader
        title="Here's where things stand."
        description="Real progress. A clear plan. The right order."
      />

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

        {/* The one chart on the page, on its own band. In a side column it was
            cramped against its own labels and pulled the left stack out of
            balance; here it reads as the judgement layer it is, sitting
            between the work above and what CLD is holding back below.

            The section spans the measure so its heading stays on the same left
            margin as every other section; the drawing centres itself within
            it. Centring the whole section indented the heading and read as a
            mistake rather than as composition. */}
        <OpportunityMap />

        <NotYet />
      </div>
    </>
  );
}
