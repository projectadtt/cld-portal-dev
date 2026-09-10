import type { Metadata } from "next";

import { BrokerList } from "@/components/brokers/BrokerList";
import { BrokerScorecardTable } from "@/components/brokers/BrokerScorecardTable";
import { BrokerSpotlight } from "@/components/brokers/BrokerSpotlight";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/primitives/SectionHeader";
import { SectionLink } from "@/components/primitives/SectionLink";
import { getBrokerScorecardTotals, pageTitle } from "@/lib/selectors";
import { loadWorkspace } from "@/lib/db/workspace";

export async function generateMetadata(): Promise<Metadata> {
  await loadWorkspace();
  return { title: pageTitle("Brokers") };
}

/**
 * SCREEN 6 — Brokers.
 *
 * The coordination layer, led by an accountability table: who owns what, and
 * what is happening inside each portfolio. Every figure opens the records it
 * was counted from, so a number is never the end of the road.
 *
 * The portfolio spotlight beneath it carries what a count cannot — what moved
 * last and what moves next on each desk.
 */
export default async function BrokersPage() {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  const totals = getBrokerScorecardTotals();

  return (
    <>
      <PageHeader
        eyebrow="Brokers"
        title="Who is moving the work forward."
        description="Your retail relationships, organized by the people responsible for moving them."
      >
        <div className="sm:text-right">
          <p className="type-label">Coverage</p>
          <p className="mt-1.5 text-sm text-ink">
            {totals.accounts + " retail accounts · " + totals.items + " items"}
          </p>
        </div>
      </PageHeader>

      {/* Table and spotlight sit side by side on desktop and stack on
          mobile — the panel is a pointer into the table, not a second
          reading of the page. */}
      <div className="grid gap-10 lg:grid-cols-[1fr_13rem] lg:gap-10">
        <section className="min-w-0">
          <SectionHeader
            title="Accountability"
            description="Where each broker's book stands right now. Select any figure to open the records behind it."
            lead
          />
          <BrokerScorecardTable />
        </section>

        <BrokerSpotlight />
      </div>

      <section className="mt-14 lg:mt-16">
        <SectionHeader
          title="Portfolios"
          description="What moved last and what moves next on each desk."
          action={<SectionLink href="/brokers/new">Add a broker</SectionLink>}
        />
        <BrokerList />
      </section>
    </>
  );
}
