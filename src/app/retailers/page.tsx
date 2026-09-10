import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/PageHeader";
import { SectionLink } from "@/components/primitives/SectionLink";
import { PipelineSummary } from "@/components/retailers/PipelineSummary";
import {
  RetailerFilters,
  parseRetailerFilter,
} from "@/components/retailers/RetailerFilters";
import { RetailerTable } from "@/components/retailers/RetailerTable";
import { countRetailers, pageTitle } from "@/lib/selectors";
import { loadWorkspace } from "@/lib/db/workspace";

export async function generateMetadata(): Promise<Metadata> {
  await loadWorkspace();
  return { title: pageTitle("Retailers") };
}

export default async function RetailersPage({
  searchParams,
}: PageProps<"/retailers">) {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  const filter = parseRetailerFilter(await searchParams);
  const shown = countRetailers(filter);
  const total = countRetailers();

  return (
    <>
      <PageHeader
        eyebrow="Retailers"
        title="Where we're building the retail path."
        description="Every target account, the broker responsible, what's moving, and what needs attention next."
      >
        {/* PageHeader's own slot for a right-side action, rather than a new
            section heading invented to hold one. */}
        <SectionLink href="/retailers/new">Add a retailer</SectionLink>
      </PageHeader>

      <PipelineSummary />

      <div className="mt-10 lg:mt-12">
        <RetailerFilters active={filter} />
      </div>

      <div className="mt-9 lg:mt-10">
        <RetailerTable filter={filter} />
      </div>

      {/* A truthful count rather than pagination: nine accounts fit on one
          page, and a pager would be a control that never does anything. */}
      <p className="type-label mt-6">
        {shown === total
          ? total + " retail accounts"
          : "Showing " + shown + " of " + total + " retail accounts"}
      </p>
    </>
  );
}
