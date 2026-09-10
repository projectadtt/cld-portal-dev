import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/PageHeader";
import { BuyerSignalsSummary } from "@/components/products/BuyerSignalsSummary";
import { CompetitionView } from "@/components/products/CompetitionView";
import { PortfolioSummary } from "@/components/products/PortfolioSummary";
import { ProductGrid } from "@/components/products/ProductGrid";
import { ProductPerformanceTable } from "@/components/products/ProductPerformanceTable";
import { ProductTabs, parseProductView } from "@/components/products/ProductTabs";
import { RetailFitMatrix } from "@/components/products/RetailFitMatrix";
import { RetailFitSummary } from "@/components/products/RetailFitSummary";
import { WhiteSpaceSummary } from "@/components/products/WhiteSpaceSummary";
import { WhiteSpaceView } from "@/components/products/WhiteSpaceView";
import { SectionHeader } from "@/components/primitives/SectionHeader";
import { SectionLink } from "@/components/primitives/SectionLink";
import { getBuyerSignals, getProductSummaries, getWorkedProducts, pageTitle } from "@/lib/selectors";
import { loadWorkspace } from "@/lib/db/workspace";

export async function generateMetadata(): Promise<Metadata> {
  await loadWorkspace();
  return { title: pageTitle("Products") };
}

/**
 * SCREEN 4 — Products.
 *
 * Four readings of one dataset. Portfolio is the range itself; retail fit is
 * the same items seen against the accounts; competition is the positioning
 * being tested; white space is where the pattern says to go next.
 *
 * The Portfolio landing composes a short version of each of the other three
 * beneath the range, so the page walks the whole question in order — what do
 * we have, what is moving, where does it sit, what are buyers saying, where
 * do we go next — and hands off to the tab that answers each one in full.
 *
 * The view lives in the URL so every tab stays server-rendered and linkable.
 */
export default async function ProductsPage({
  searchParams,
}: PageProps<"/products">) {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  const view = parseProductView((await searchParams).view);
  const signalCount = getBuyerSignals().length;

  return (
    <>
      <PageHeader
        eyebrow="Products"
        title="A stronger portfolio. A bigger tomorrow."
        description="Which products are moving through retail, where buyers are responding, and where the range may have room to grow."
      />

      <PortfolioSummary />

      <div className="mt-12 lg:mt-14">
        <ProductTabs active={view} />
      </div>

      <div className="mt-10 space-y-14 lg:mt-12 lg:space-y-16">
        {view === "portfolio" ? (
          <>
            <section>
              <SectionHeader
                title="Your products"
                description="The full range, ordered by how much retail conversation each item is carrying."
                action={<SectionLink href="/products/new">Add a product</SectionLink>}
                lead
              />
              <ProductGrid summaries={getProductSummaries()} />
            </section>

            <section>
              <SectionHeader
                title="Product performance"
                description="Every product in front of a buyer: how many accounts it is in, who has answered, and what moves it from here."
                lead
              />
              <ProductPerformanceTable summaries={getWorkedProducts()} />
            </section>

            <section>
              <SectionHeader
                title="Retailer fit"
                description="Where the range sits across the accounts. Every filled square opens the account it belongs to."
                action={
                  <SectionLink href="/products?view=retail-fit">
                    Full matrix
                  </SectionLink>
                }
              />
              <RetailFitSummary />
            </section>

            <section>
              <SectionHeader
                title="Buyer signals"
                description="What buyers have said back to the range, strongest decision weight first."
                action={
                  <SectionLink href="/products?view=competition">
                    {signalCount + " responses"}
                  </SectionLink>
                }
              />
              <BuyerSignalsSummary />
            </section>

            <section>
              <SectionHeader
                title="White space"
                description="Patterns read across more than one account, and the move each one suggests."
                action={
                  <SectionLink href="/products?view=white-space">
                    The evidence
                  </SectionLink>
                }
              />
              <WhiteSpaceSummary />
            </section>
          </>
        ) : null}

        {view === "retail-fit" ? (
          <section>
            <SectionHeader
              title="Retail fit"
              description="Where each product has been taken, and how well it lands there."
              lead
            />
            <RetailFitMatrix />
          </section>
        ) : null}

        {view === "competition" ? (
          <section>
            <SectionHeader
              title="How the range is positioned"
              description="What each product claims, and what buyers have said back."
              lead
            />
            <CompetitionView />
          </section>
        ) : null}

        {view === "white-space" ? (
          <section>
            <SectionHeader
              title="Where the portfolio may have room to move next"
              description="Patterns read across more than one account, with the evidence behind each."
              lead
            />
            <WhiteSpaceView />
          </section>
        ) : null}
      </div>
    </>
  );
}
