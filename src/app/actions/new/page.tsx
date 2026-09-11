import type { Metadata } from "next";
import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";

import { ActionCreateForm } from "@/components/actions/ActionCreateForm";
import { EmptyState } from "@/components/primitives/EmptyState";
import { loadWorkspace } from "@/lib/db/workspace";
import { DEMO_TODAY } from "@/lib/demo";
import { getAllBrokers, getAllRetailers, pageTitle } from "@/lib/selectors";

/** Always fresh: the accounts and brokers offered are whoever is live now. */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  await loadWorkspace();
  return { title: pageTitle("Add an action") };
}

/**
 * Writing down one piece of work.
 *
 * The account and the owner are both offered from this client's own live
 * records — the read layer already excludes archived ones, so the selects
 * cannot offer something the write layer would refuse.
 *
 * An action needs an account to be on and a broker to carry it, so with neither
 * recorded there is nothing this page can ask for. It says so rather than
 * rendering two empty selects.
 */
export default async function NewActionPage({
  searchParams,
}: PageProps<"/actions/new">) {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();

  const retailers = getAllRetailers();
  const owners = getAllBrokers();

  /* Arriving from an account pre-selects it. Validated by the write layer like
     any other field, so a bad value in the query string is refused there rather
     than trusted here. */
  const { retailer } = await searchParams;
  const preselected = typeof retailer === "string" ? retailer : undefined;

  const header = (
    <header className="mb-2">
      <Link
        href="/actions"
        className="type-label inline-flex items-center gap-1.5 transition-colors hover:text-forest"
      >
        <ArrowLeft size={12} strokeWidth={2} aria-hidden="true" />
        Actions
      </Link>

      <h1 className="mt-4 font-display text-[2.125rem] leading-[1.1] tracking-[-0.015em] text-ink sm:text-[2.5rem]">
        What has to happen next.
      </h1>

      <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
        One piece of work, on one account, with an owner and a date. It joins the
        shared action list, the account&rsquo;s next steps and the Overview.
      </p>
    </header>
  );

  if (retailers.length === 0 || owners.length === 0) {
    return (
      <>
        {header}
        <div className="mt-10">
          <EmptyState
            boxed
            icon={Users}
            message={
              retailers.length === 0
                ? "There is no account to put work against yet."
                : "There is no broker to carry the work yet."
            }
            detail={
              retailers.length === 0
                ? "Add a retail account first, then come back and write down the first move on it."
                : "Add a broker first — an action with no owner is work nobody does."
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      {header}

      <ActionCreateForm
        retailers={retailers.map((r) => ({ id: r.id, name: r.name }))}
        owners={owners.map((b) => ({ id: b.id, name: b.name }))}
        retailerId={preselected}
        today={DEMO_TODAY}
        cancelHref="/actions"
      />
    </>
  );
}
