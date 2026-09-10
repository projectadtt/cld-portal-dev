import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BLANK_BROKER, BrokerForm } from "@/components/brokers/BrokerForm";
import { ImagePlate } from "@/components/media/ImagePlate";
import { loadWorkspace } from "@/lib/db/workspace";
import { getClient, pageTitle } from "@/lib/selectors";

/** Always fresh: the form has to know which names are already on the books. */
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  await loadWorkspace();
  return { title: pageTitle("New broker") };
}

export default async function NewBrokerPage() {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();

  /* A broker belongs to a client. Without a workspace there is nothing to
     file them under, so the portal asks for that first. */
  if (!getClient()) redirect("/");

  return (
    <>
      <header className="mb-2">
        <Link
          href="/brokers"
          className="type-label inline-flex items-center gap-1.5 transition-colors hover:text-forest"
        >
          <ArrowLeft size={12} strokeWidth={2} aria-hidden="true" />
          Brokers
        </Link>

        <h1 className="mt-4 font-display text-[2.125rem] leading-[1.1] tracking-[-0.015em] text-ink sm:text-[2.5rem]">
          Add a broker.
        </h1>

        <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
          Two things are needed to start: what they are called, and the short
          name every table and owner column shows. How they are reached and what
          they cover can follow later.
        </p>
      </header>

      <BrokerForm
        values={BLANK_BROKER}
        submitLabel="Add broker"
        cancelHref="/brokers"
        imagePlaceholder={
          <ImagePlate primary="No portrait yet" secondary="Optional" circle />
        }
      />
    </>
  );
}
