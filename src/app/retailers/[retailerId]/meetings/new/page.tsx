import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MeetingCreateForm } from "@/components/meetings/MeetingCreateForm";
import { loadWorkspace } from "@/lib/db/workspace";
import { DEMO_TODAY } from "@/lib/demo";
import { getRetailer, getRetailerDetail, pageTitle, UNASSIGNED } from "@/lib/selectors";

/** Always fresh: the broker shown is whoever carries the account right now. */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/retailers/[retailerId]/meetings/new">) {
  await loadWorkspace();
  const retailer = getRetailer((await params).retailerId);
  return {
    title: pageTitle(
      retailer ? "Add a meeting to " + retailer.name : "Add a meeting",
    ),
  };
}

/**
 * Putting one meeting on the book for one account.
 *
 * Only when it is, what it is called, and whether it is still ahead. What was
 * said and what was decided belong to the record once it exists — this page
 * creates the thing those are later written onto.
 */
export default async function NewMeetingPage({
  params,
}: PageProps<"/retailers/[retailerId]/meetings/new">) {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  const { retailerId } = await params;

  const retailer = getRetailer(retailerId);
  if (!retailer) notFound();

  /* Resolved here so the form stays a plain client component. The account may
     have no broker at all, which is a normal state and says so. */
  const broker = getRetailerDetail(retailerId)?.broker;

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
          Put a meeting on the book.
        </h1>

        <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
          {"For " + retailer.name +
            ". A meeting still ahead shows under Upcoming; one you are writing " +
            "up after the fact goes straight to the record."}
        </p>
      </header>

      <MeetingCreateForm
        retailerId={retailer.id}
        retailerName={retailer.name}
        brokerLabel={broker?.name ?? UNASSIGNED}
        today={DEMO_TODAY}
        cancelHref={"/retailers/" + retailer.id}
      />
    </>
  );
}
