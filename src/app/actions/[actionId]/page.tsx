import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionEditForm } from "@/components/actions/ActionEditForm";
import { MetaPair } from "@/components/primitives/MetaPair";
import { SectionHeader } from "@/components/primitives/SectionHeader";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { loadWorkspace } from "@/lib/db/workspace";
import {
  formatDueDate,
  getActionDetail,
  getOwnerName,
} from "@/lib/selectors";
import { actionStatusTone, itemStatusTone, sampleStatusTone } from "@/lib/status";

/**
 * The action workspace.
 *
 * The Actions screen answers "what has to happen next" across the whole book;
 * this answers "what is happening with this one" — and is the only place the
 * record can be changed.
 *
 * Always rendered fresh: a form is a picture of the current record, and a
 * cached one would offer yesterday's values as today's starting point.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/actions/[actionId]">) {
  await loadWorkspace();
  const detail = getActionDetail((await params).actionId);
  return { title: detail ? detail.action.label + " — Actions" : "Action" };
}

export default async function ActionPage({
  params,
}: PageProps<"/actions/[actionId]">) {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  const detail = getActionDetail((await params).actionId);
  if (!detail) notFound();

  const { action, retailer, product, record, siblings, owners, overdue } = detail;

  return (
    <>
      <header className="mb-8">
        <Link
          href="/actions"
          className="type-label inline-flex items-center gap-1.5 transition-colors hover:text-forest"
        >
          <ArrowLeft size={12} strokeWidth={2} aria-hidden="true" />
          Actions
        </Link>

        <h1 className="mt-4 max-w-[24ch] font-display text-[1.75rem] leading-[1.15] tracking-[-0.015em] text-ink sm:text-[2.125rem]">
          {action.label}
        </h1>

        <div className="mt-8 grid gap-x-10 gap-y-5 border-t border-rule pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <MetaPair label="Status">
            <StatusBadge
              label={overdue ? "Overdue" : action.status}
              tone={overdue ? "attention" : actionStatusTone[action.status]}
            />
          </MetaPair>
          <MetaPair label="Due">{formatDueDate(action.due)}</MetaPair>
          <MetaPair label="Owner">{getOwnerName(action.ownerId)}</MetaPair>
          <MetaPair label="Reference">{action.id}</MetaPair>
        </div>
      </header>

      <ActionEditForm
        actionId={action.id}
        status={action.status}
        due={action.due}
        ownerId={action.ownerId}
        owners={owners.map((broker) => ({ id: broker.id, name: broker.name }))}
        backHref="/actions"
      />

      {/* -- the record this work belongs to ------------------------------- */}
      <div className="mt-16 space-y-14 lg:mt-20 lg:space-y-16">
        <section>
          <SectionHeader
            title="What this work is on"
            description="Fixed by the record, not by this form."
          />

          <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            <MetaPair label="Account">
              <Link
                href={"/retailers/" + retailer.id}
                className="transition-colors hover:text-forest"
              >
                {retailer.name}
              </Link>
            </MetaPair>

            <MetaPair label="Product">
              {product ? (
                <Link
                  href={"/products/" + product.id}
                  className="transition-colors hover:text-forest"
                >
                  {product.name}
                </Link>
              ) : (
                <span className="text-ink-faint">Not tied to one item</span>
              )}
            </MetaPair>

            <MetaPair label="Item">
              {record ? (
                <>
                  <Link
                    href={"/retailers/" + retailer.id + "/items/" + record.id}
                    className="transition-colors hover:text-forest"
                  >
                    {record.id}
                  </Link>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <StatusBadge
                      label={record.itemStatus}
                      tone={itemStatusTone[record.itemStatus]}
                    />
                    <StatusBadge
                      label={record.sampleStatus}
                      tone={sampleStatusTone[record.sampleStatus]}
                    />
                  </span>
                </>
              ) : (
                <span className="text-ink-faint">On the account, not an item</span>
              )}
            </MetaPair>
          </div>
        </section>

        {record ? (
          <section>
            <SectionHeader
              title="Other work on the same item"
              description="An item carries as many actions as the work needs; each one is its own record."
            />
            {siblings.length === 0 ? (
              <p className="text-sm text-ink-faint">
                This is the only action on {record.id}.
              </p>
            ) : (
              <ul className="max-w-[70ch] space-y-4">
                {siblings.map((sibling) => (
                  <li
                    key={sibling.id}
                    className="border-t border-rule-soft pt-4 first:border-t-0 first:pt-0"
                  >
                    <Link
                      href={"/actions/" + sibling.id}
                      className="text-sm leading-normal text-ink transition-colors hover:text-forest"
                    >
                      {sibling.label}
                    </Link>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <StatusBadge
                        label={sibling.status}
                        tone={actionStatusTone[sibling.status]}
                      />
                      <span className="text-[13px] text-ink-faint">
                        {sibling.id} · {getOwnerName(sibling.ownerId)} · due{" "}
                        {formatDueDate(sibling.due)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </>
  );
}
