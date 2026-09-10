import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/primitives/SectionHeader";
import { SectionLink } from "@/components/primitives/SectionLink";
import { CoverageReport } from "@/components/reports/CoverageReport";
import { ExecutiveSummary } from "@/components/reports/ExecutiveSummary";
import { OpportunityReport } from "@/components/reports/OpportunityReport";
import { PipelineReport } from "@/components/reports/PipelineReport";
import { ProductReadReport } from "@/components/reports/ProductReadReport";
import { ReportLibrary } from "@/components/reports/ReportLibrary";
import { ReportSummary } from "@/components/reports/ReportSummary";
import { loadWorkspace } from "@/lib/db/workspace";
import { pageTitle } from "@/lib/selectors";

export async function generateMetadata(): Promise<Metadata> {
  await loadWorkspace();
  return { title: pageTitle("Reports") };
}

/**
 * SCREEN 10 — Reports.
 *
 * A consulting report index, not a document editor: five client-ready views
 * of the work already recorded, each concise enough to decide from and each
 * handing off to the live workspace behind it.
 *
 * Nothing here is generated or stored. Every figure is composed from the
 * selector the matching screen already uses, so a report and the workspace
 * can never quote different numbers for the same idea.
 */
export default async function ReportsPage() {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="What we can see. What we can share."
        description="Client-ready views of the retail work, product signals, and decisions recorded in the workspace."
      />

      <ReportSummary />

      <div className="mt-12 space-y-12 lg:mt-14 lg:space-y-14">
        <section>
          <SectionHeader
            title="Report library"
            description="Five views of the same book. Each one opens the workspace behind it."
            lead
          />
          <ReportLibrary />
        </section>

        <section id="executive-summary" className="scroll-mt-8">
          <SectionHeader
            title="Executive Summary"
            description="Where the book stands, and what is waiting on a decision."
            lead
            action={<SectionLink href="/">The overview</SectionLink>}
          />
          <ExecutiveSummary />
        </section>

        <section id="retailer-pipeline" className="scroll-mt-8">
          <SectionHeader
            title="Retailer Pipeline"
            description="Every account, furthest along first."
            lead
            action={<SectionLink href="/retailers">The pipeline</SectionLink>}
          />
          <PipelineReport />
        </section>

        <section id="broker-coverage" className="scroll-mt-8">
          <SectionHeader
            title="Broker & Account Coverage"
            description="Who is carrying which accounts, and how much sits there."
            lead
            action={<SectionLink href="/brokers">The desks</SectionLink>}
          />
          <CoverageReport />
        </section>

        <section id="product-read" className="scroll-mt-8">
          <SectionHeader
            title="Product & Retail Read"
            description="How the portfolio is travelling through retail."
            lead
            action={<SectionLink href="/products">The portfolio</SectionLink>}
          />
          <ProductReadReport />
        </section>

        <section id="opportunities" className="scroll-mt-8">
          <SectionHeader
            title="Opportunities & Next Moves"
            description="The reads drawn from the work, and what carries them."
            lead
            action={
              <SectionLink href="/market-insights">Market insights</SectionLink>
            }
          />
          <OpportunityReport />
        </section>

        {/* Stated plainly and last: a limit acknowledged reads as judgement,
            a limit hidden reads as a claim. */}
        <section className="border-t border-rule pt-8">
          <p className="type-label">About these reports</p>

          <div className="mt-4 grid gap-x-12 gap-y-6 lg:grid-cols-2">
            <p className="max-w-[58ch] text-[13px] leading-relaxed text-ink-muted">
              <span className="text-ink">
                Document export is not connected yet.
              </span>{" "}
              These views are live summaries of the workspace, not generated
              files — every figure is counted from the records at the moment
              the page is opened, so a report cannot go stale on a shelf.
            </p>

            <p className="max-w-[58ch] text-[13px] leading-relaxed text-ink-muted">
              <span className="text-ink">Nothing here is a forecast.</span> The
              workspace holds no history to compare against and no market data
              behind it, so these reports carry counts and current status only
              — no trends, no projections, no performance scoring.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
