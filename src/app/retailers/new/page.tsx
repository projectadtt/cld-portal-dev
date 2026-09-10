import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ImagePlate } from "@/components/media/ImagePlate";
import { BLANK_RETAILER, RetailerForm } from "@/components/retailers/RetailerForm";
import { loadWorkspace } from "@/lib/db/workspace";
import { getAllBrokers, getClient, pageTitle } from "@/lib/selectors";

/** Always fresh: the form has to know which names and brokers already exist. */
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  await loadWorkspace();
  return { title: pageTitle("New retailer") };
}

export default async function NewRetailerPage() {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();

  /* An account belongs to a client. Without a workspace there is nothing to
     file it under, so the portal asks for that first. */
  if (!getClient()) redirect("/");

  /* Resolved here so the form stays a plain client component: it receives a
     list of names and ids, and never reaches the data layer itself. */
  const brokers = getAllBrokers().map((broker) => ({
    id: broker.id,
    name: broker.name,
  }));

  return (
    <>
      <header className="mb-2">
        <Link
          href="/retailers"
          className="type-label inline-flex items-center gap-1.5 transition-colors hover:text-forest"
        >
          <ArrowLeft size={12} strokeWidth={2} aria-hidden="true" />
          Retailers
        </Link>

        <h1 className="mt-4 font-display text-[2.125rem] leading-[1.1] tracking-[-0.015em] text-ink sm:text-[2.5rem]">
          Add a retail account.
        </h1>

        <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
          Three things are needed to start: what the account is called, the
          short name every table shows, and what kind of retailer it is. Every
          status below already sits where a new account starts.
        </p>
      </header>

      <RetailerForm
        values={BLANK_RETAILER}
        brokers={brokers}
        submitLabel="Add retailer"
        cancelHref="/retailers"
        imagePlaceholder={<ImagePlate primary="No logo yet" secondary="Optional" />}
      />
    </>
  );
}
