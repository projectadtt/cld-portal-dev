import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RetailerStatusForm } from "@/components/retailers/RetailerStatusForm";
import { loadWorkspace } from "@/lib/db/workspace";
import { getRetailer, pageTitle } from "@/lib/selectors";

/** Always fresh: the form opens on where the account stands right now. */
export const dynamic = "force-dynamic";

/** An unrecorded figure is an empty box, never a zero — zero is an answer. */
const box = (value: number | undefined) => (value === undefined ? "" : String(value));

export async function generateMetadata({
  params,
}: PageProps<"/retailers/[retailerId]/edit">) {
  await loadWorkspace();
  const retailer = getRetailer((await params).retailerId);
  return { title: pageTitle(retailer ? "Edit " + retailer.name : "Edit account") };
}

/**
 * Moving an account along the pipeline.
 *
 * Scoped to the three fields that change as a conversation progresses, and —
 * in a second, separate form — the three planning figures the opportunity map
 * sizes an account from. The account's identity — its name, channel, logo and
 * broker — is not editable here, which is what makes this page safe to reach
 * from a live meeting: there is nothing on it that can rename a record or
 * disturb a relationship.
 */
export default async function EditRetailerStatusPage({
  params,
}: PageProps<"/retailers/[retailerId]/edit">) {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  const { retailerId } = await params;

  const retailer = getRetailer(retailerId);
  if (!retailer) notFound();

  return (
    <>
      <header className="mb-2">
        <Link
          href={"/retailers/" + retailer.id}
          className="type-label inline-flex items-center gap-1.5 transition-colors hover:text-forest"
        >
          <ArrowLeft size={12} strokeWidth={2} aria-hidden="true" />
          {retailer.name}
        </Link>

        <h1 className="mt-4 font-display text-[2.125rem] leading-[1.1] tracking-[-0.015em] text-ink sm:text-[2.5rem]">
          Where it stands.
        </h1>

        <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
          Moving this account changes the Overview funnel, where it sits in the
          workstream, and the phase it is grouped under on Retailers.
        </p>
      </header>

      <RetailerStatusForm
        retailerId={retailer.id}
        values={{
          currentTarget: retailer.currentTarget,
          pipelineStatus: retailer.overallStatus,
          standing: retailer.standing,
        }}
        sizing={{
          approximateDoors: box(retailer.approximateDoors),
          assumedSkus: box(retailer.assumedSkus),
          unitsPerStoreWeek: box(retailer.unitsPerStoreWeek),
        }}
        cancelHref={"/retailers/" + retailer.id}
      />
    </>
  );
}
