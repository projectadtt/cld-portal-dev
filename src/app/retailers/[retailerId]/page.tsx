import { notFound } from "next/navigation";

import { SectionHeader } from "@/components/primitives/SectionHeader";
import { SectionLink } from "@/components/primitives/SectionLink";
import { RetailerFeedback } from "@/components/retailer/RetailerFeedback";
import { RetailerHeader } from "@/components/retailer/RetailerHeader";
import { RetailerItems } from "@/components/retailer/RetailerItems";
import { RetailerKeyDetails } from "@/components/retailer/RetailerKeyDetails";
import { RetailerMeetings } from "@/components/retailer/RetailerMeetings";
import {
  RetailerTabs,
  parseRetailerView,
} from "@/components/retailer/RetailerTabs";
import { RetailerTimeline } from "@/components/retailer/RetailerTimeline";
import { ActionList } from "@/components/shared/ActionList";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import { loadWorkspace } from "@/lib/db/workspace";
import { getRetailerDetail } from "@/lib/selectors";

/** How much history the overview carries before handing off to the tab. */
const TIMELINE_PREVIEW = 5;

/**
 * Both overview bands share one column template, so Key details sits over
 * Buyer feedback and Timeline over Next steps — the page reads as a grid
 * rather than as four sections that happen to be beside each other.
 */
const BAND = "grid gap-12 lg:grid-cols-[0.85fr_1fr] lg:gap-16";

export async function generateMetadata({
  params,
}: PageProps<"/retailers/[retailerId]">) {
  await loadWorkspace();
  const detail = getRetailerDetail((await params).retailerId);
  return { title: detail ? detail.retailer.name + " — Retailers" : "Retailer" };
}

/**
 * SCREEN 3 — the account workspace.
 *
 * The working view behind every retailer name in the portal, and the one page
 * built to be open during a client meeting.
 *
 * The account overview comes first as two paired bands — where the account
 * stands beside how it got here, then what the buyer said beside what happens
 * next. The item-level workstream sits below them, denser and quieter: it is
 * the evidence behind the account, not the opening statement.
 */
export default async function RetailerDetailPage({
  params,
  searchParams,
}: PageProps<"/retailers/[retailerId]">) {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  const detail = getRetailerDetail((await params).retailerId);
  if (!detail) notFound();

  const view = parseRetailerView((await searchParams).view);
  const { retailer, activities, meetings, timeline, itemRows, feedback } =
    detail;

  return (
    <>
      <RetailerHeader detail={detail} />

      <RetailerTabs retailerId={retailer.id} active={view} />

      {view === "overview" ? (
        <div className="mt-12 space-y-14 lg:mt-14 lg:space-y-16">
          <div className={BAND}>
            <section>
              <SectionHeader
                title="Key details"
                description="The account as it stands on the record."
              />
              <RetailerKeyDetails detail={detail} />
            </section>

            <section>
              <SectionHeader
                title="Timeline"
                description="Meetings and contact logged on this account."
                action={
                  timeline.length > TIMELINE_PREVIEW ? (
                    <SectionLink
                      href={"/retailers/" + retailer.id + "?view=activity"}
                    >
                      Full history
                    </SectionLink>
                  ) : undefined
                }
              />
              <RetailerTimeline events={timeline} limit={TIMELINE_PREVIEW} />
            </section>
          </div>

          <div className={BAND}>
            <section>
              <SectionHeader
                title="Buyer feedback"
                description="What the buyer said, and about which item."
              />
              <RetailerFeedback
                feedback={feedback}
                source={retailer.buyerContact}
              />
            </section>

            <section>
              <SectionHeader
                title="Next steps"
                description="Open work on this account."
                action={<SectionLink href="/actions">All actions</SectionLink>}
              />
              <ActionList
                actions={detail.openActions}
                emptyMessage="Nothing on the shared action list for this account yet."
              />
            </section>
          </div>

          <section>
            <SectionHeader
              title="Retail workstream"
              description="Every item on this account: where it stands, where its sample is, and what moves it forward."
              action={
                <SectionLink href={"/retailers/" + retailer.id + "/items/new"}>
                  Add an item
                </SectionLink>
              }
            />
            <RetailerItems
              rows={itemRows}
              newHref={"/retailers/" + retailer.id + "/items/new"}
            />
          </section>
        </div>
      ) : null}

      {view === "activity" ? (
        <section className="mt-12 lg:mt-14">
          <SectionHeader
            title="Activity"
            description="Everything logged on this account, most recent first."
          />
          <div className="max-w-[70ch]">
            <ActivityTimeline
              activities={activities}
              showRetailer={false}
              emptyMessage="No activity recorded on this account yet."
            />
          </div>
        </section>
      ) : null}

      {view === "notes" ? (
        <section className="mt-12 lg:mt-14">
          <SectionHeader
            title="Meeting notes"
            description="What was actually said in the room, and what was decided."
            action={
              <SectionLink
                href={"/retailers/" + retailer.id + "/meetings/new"}
              >
                Add a meeting
              </SectionLink>
            }
          />
          <RetailerMeetings meetings={meetings} />
        </section>
      ) : null}
    </>
  );
}
