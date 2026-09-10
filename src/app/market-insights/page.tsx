import type { Metadata } from "next";

import { BuyerSignalTable } from "@/components/insights/BuyerSignalTable";
import { ChannelSignalTable } from "@/components/insights/ChannelSignalTable";
import { InsightSummary } from "@/components/insights/InsightSummary";
import { KeyTakeaways } from "@/components/insights/KeyTakeaways";
import { PositioningTable } from "@/components/insights/PositioningTable";
import { SignalActions } from "@/components/insights/SignalActions";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/primitives/SectionHeader";
import { SectionLink } from "@/components/primitives/SectionLink";
import { loadWorkspace } from "@/lib/db/workspace";
import { pageTitle } from "@/lib/selectors";

export async function generateMetadata(): Promise<Metadata> {
  await loadWorkspace();
  return { title: pageTitle("Market Insights") };
}

/**
 * SCREEN 9 — Market Insights.
 *
 * The interpretation layer. It reads down the way a consulting read is
 * argued: here is what we conclude, here is the evidence underneath it, here
 * is how the range is positioned against that evidence, here is what it looks
 * like by channel, and here is the work already moving because of it.
 *
 * Everything on the page is counted or quoted from the tracker. There is no
 * syndicated market data behind this workspace, and the page says so rather
 * than filling the gap with something modelled.
 */
export default async function MarketInsightsPage() {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  return (
    <>
      <PageHeader
        eyebrow="Market Insights"
        title="Read the market. Know what to do next."
        description="What buyers are telling us, what it adds up to, and what should happen next — drawn from the retail work itself."
      />

      <InsightSummary />

      <div className="mt-12 space-y-12 lg:mt-14 lg:space-y-14">
        <section>
          <SectionHeader
            title="What matters now"
            description="Ranked by confidence. Open one for the evidence beneath it."
            lead
            action={
              <SectionLink href="/products?view=white-space">
                The full analysis
              </SectionLink>
            }
          />
          <KeyTakeaways />
        </section>

        <section>
          <SectionHeader
            title="Buyer signals"
            description="Every buyer response recorded on the tracker."
            action={<SectionLink href="/products">Every product</SectionLink>}
            lead
          />
          <BuyerSignalTable />
        </section>

        <section>
          <SectionHeader
            title="Product positioning"
            description="What each product claims, and what buyers answered."
            lead
            action={
              <SectionLink href="/products?view=competition">
                Positioning in full
              </SectionLink>
            }
          />
          <PositioningTable />
        </section>

        <section>
          <SectionHeader
            title="Channel signals"
            description="The same tracker cut by channel rather than by account."
            lead
            action={<SectionLink href="/retailers">The pipeline</SectionLink>}
          />
          <ChannelSignalTable />
        </section>

        <section>
          <SectionHeader
            title="What should happen next"
            description="Open work already carrying these reads forward."
            lead
            action={<SectionLink href="/actions">All actions</SectionLink>}
          />
          <SignalActions />
        </section>

        {/* Stated plainly and last: a limit acknowledged reads as judgement,
            a limit hidden reads as a claim. */}
        <section className="border-t border-rule pt-8">
          <p className="type-label">What this view does not include</p>

          <div className="mt-4 grid gap-x-12 gap-y-6 lg:grid-cols-2">
            <p className="max-w-[58ch] text-[13px] leading-relaxed text-ink-muted">
              <span className="text-ink">
                Formal competitive benchmarking is not connected to this
                workspace yet.
              </span>{" "}
              Every read above is drawn from product positioning and what
              buyers have said back. There is no market share, no category
              growth, no competitor pricing and no distribution data behind
              any figure on this page.
            </p>

            <p className="max-w-[58ch] text-[13px] leading-relaxed text-ink-muted">
              <span className="text-ink">A future market data layer</span>{" "}
              could sit alongside this one. Connected retail-market data would
              add verified category size, distribution, growth and competitive
              views underneath the same signals — the structure here is built
              to take it, and deliberately says nothing it cannot yet support.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
