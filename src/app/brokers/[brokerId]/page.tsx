import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { BrokerAccounts } from "@/components/brokers/BrokerAccounts";
import { BrokerHeader } from "@/components/brokers/BrokerHeader";
import { BrokerRecordList } from "@/components/brokers/BrokerRecordList";
import { loadWorkspace } from "@/lib/db/workspace";
import {
  BrokerViewTabs,
  parseBrokerView,
} from "@/components/brokers/BrokerViewTabs";
import { MetaPair } from "@/components/primitives/MetaPair";
import { SectionHeader } from "@/components/primitives/SectionHeader";
import { MeetingNotes } from "@/components/retailer/MeetingNotes";
import { ActionList } from "@/components/shared/ActionList";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import { cn } from "@/lib/cn";
import {
  countBrokerRecords,
  getAllBrokerIds,
  getBrokerDetail,
  getBrokerRecords,
  type BrokerRecordView,
} from "@/lib/selectors";

/** All three brokers are known at build time. */
export async function generateStaticParams() {
  await loadWorkspace();
  return getAllBrokerIds().map((brokerId) => ({ brokerId }));
}

export async function generateMetadata({
  params,
}: PageProps<"/brokers/[brokerId]">) {
  await loadWorkspace();
  const detail = getBrokerDetail((await params).brokerId);
  return { title: detail ? detail.portfolio.broker.name + " — Brokers" : "Broker" };
}

/** Copy for the three drill-downs that read the item tracker. */
const RECORD_VIEWS: Record<
  BrokerRecordView,
  { title: string; description: string; empty: string }
> = {
  samples: {
    title: "Samples out",
    description: "Items physically with a buyer right now.",
    empty: "No samples are with a buyer on this broker's accounts yet.",
  },
  "under-review": {
    title: "Under review",
    description: "Items a buyer is holding while they form a decision.",
    empty: "Nothing is with a buyer for review on this broker's accounts yet.",
  },
  approved: {
    title: "Approved",
    description: "Items a buyer has accepted.",
    empty: "No item has been accepted on this broker's accounts yet.",
  },
};

/**
 * Broker workspace.
 *
 * Ordered the way the question gets asked in a client meeting: who is this,
 * what are they carrying, what is moving, what is stuck, what happens next.
 *
 * The focused section answers whichever figure was selected on the
 * accountability table; the view lives in the URL, so a drill-down stays
 * server-rendered and linkable mid-meeting.
 */
export default async function BrokerDetailPage({
  params,
  searchParams,
}: PageProps<"/brokers/[brokerId]">) {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  const detail = getBrokerDetail((await params).brokerId);
  if (!detail) notFound();

  const view = parseBrokerView((await searchParams).view);
  const { portfolio, scorecard, accounts, openActions, activities, notes } =
    detail;
  const brokerId = portfolio.broker.id;

  const facts: { label: string; value: ReactNode }[] = [
    {
      label: "Accounts in motion",
      value: portfolio.inMotion + " of " + portfolio.accounts,
    },
    {
      label: "Items in workstream",
      value: portfolio.items === 1 ? "1 item" : portfolio.items + " items",
    },
    {
      label: "Samples with buyers",
      value: portfolio.samplesOut === 0 ? "None out" : String(portfolio.samplesOut),
    },
    {
      label: "Needs attention",
      value:
        portfolio.needsAttention === 0 ? (
          "Nothing flagged"
        ) : (
          <span className="font-medium text-red">
            {portfolio.needsAttention === 1
              ? "1 account"
              : portfolio.needsAttention + " accounts"}
          </span>
        ),
    },
  ];

  const recordView =
    view === "accounts" || view === "next-steps" ? null : view;
  const groups = recordView ? getBrokerRecords(brokerId, recordView) : [];
  const matched = countBrokerRecords(groups);

  return (
    <>
      <BrokerHeader portfolio={portfolio} />

      <div className="grid grid-cols-2 border-y border-rule sm:grid-cols-4">
        {facts.map((fact, i) => (
          <div
            key={fact.label}
            className={cn(
              "py-6",
              i % 2 === 1 && "border-l border-rule pl-5",
              "sm:border-l sm:border-rule sm:pl-5 sm:first:border-l-0 sm:first:pl-0",
            )}
          >
            <MetaPair label={fact.label}>{fact.value}</MetaPair>
          </div>
        ))}
      </div>

      <div className="mt-12 lg:mt-14">
        <BrokerViewTabs
          brokerId={brokerId}
          active={view}
          scorecard={scorecard}
        />
      </div>

      <div className="mt-10 space-y-14 lg:mt-12 lg:space-y-16">
        {view === "accounts" ? (
          <section>
            <SectionHeader
              title="Account portfolio"
              description="The retail relationships this broker is responsible for, furthest along first."
              lead
            />
            <BrokerAccounts accounts={accounts} />
          </section>
        ) : null}

        {recordView ? (
          <section>
            <SectionHeader
              title={RECORD_VIEWS[recordView].title}
              description={RECORD_VIEWS[recordView].description}
              lead
              action={
                matched > 0 ? (
                  <p className="type-label">
                    {(matched === 1 ? "1 item" : matched + " items") +
                      " across " +
                      (groups.length === 1
                        ? "1 account"
                        : groups.length + " accounts")}
                  </p>
                ) : null
              }
            />
            <BrokerRecordList
              groups={groups}
              emptyMessage={RECORD_VIEWS[recordView].empty}
            />
          </section>
        ) : null}

        {view === "next-steps" ? (
          <section>
            <SectionHeader
              title="Next steps"
              description="Open work on this broker's desk, soonest first."
              lead
            />
            <ActionList
              actions={openActions}
              emptyMessage="No open actions on this broker's desk."
            />
          </section>
        ) : null}

        <div className="grid gap-14 lg:grid-cols-[1fr_1.35fr] lg:gap-14">
          {/* Suppressed under the Next steps view, where the same list is
              already the focus of the page. */}
          {view === "next-steps" ? null : (
            <section>
              <SectionHeader
                title="Next moves"
                description="Open work on this broker's desk."
              />
              <ActionList
                actions={openActions}
                emptyMessage="No open actions on this broker's desk."
              />
            </section>
          )}

          <section className={view === "next-steps" ? "lg:col-span-2" : undefined}>
            <SectionHeader
              title="Recent activity"
              description="What this broker has logged, most recent first."
            />
            <ActivityTimeline
              activities={activities}
              emptyMessage="No activity recorded for this broker yet."
            />
          </section>
        </div>

        <section>
          <SectionHeader
            title="Meetings"
            description="Conversations this broker ran, and what came out of them."
          />
          <div className="max-w-[68ch]">
            <MeetingNotes notes={notes} />
          </div>
        </section>
      </div>
    </>
  );
}
