import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MetaPair } from "@/components/primitives/MetaPair";
import { SectionHeader } from "@/components/primitives/SectionHeader";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { ItemEditForm } from "@/components/workstream/ItemEditForm";
import type { OwnerId } from "@/lib/db/types";
import { loadWorkspace } from "@/lib/db/workspace";
import { DEMO_TODAY } from "@/lib/demo";
import {
  formatDueDate,
  formatLongDate,
  getOwnerName,
  getWorkstreamItem,
} from "@/lib/selectors";
import { actionStatusTone, itemStatusTone, sampleStatusTone } from "@/lib/status";

/**
 * The item workspace — the portal's first screen that writes.
 *
 * Always rendered fresh. A form is a picture of the current record, and a
 * cached one would offer yesterday's values as today's starting point.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/retailers/[retailerId]/items/[itemId]">) {
  await loadWorkspace();
  const item = getWorkstreamItem((await params).itemId);
  return { title: item ? item.product.name + " — " + item.retailer.name : "Item" };
}

export default async function WorkstreamItemPage({
  params,
}: PageProps<"/retailers/[retailerId]/items/[itemId]">) {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  const { retailerId, itemId } = await params;

  const item = getWorkstreamItem(itemId);
  /* The item has to belong to the account in the URL, or the breadcrumb would
     say one thing and the record be another. */
  if (!item || item.retailer.id !== retailerId) notFound();

  const { record, product, retailer, actions, tracked, feedback, samples } = item;

  return (
    <>
      <header className="mb-10 lg:mb-12">
        <Link
          href={"/retailers/" + retailer.id}
          className="type-label inline-flex items-center gap-1.5 transition-colors hover:text-forest"
        >
          <ArrowLeft size={12} strokeWidth={2} aria-hidden="true" />
          {retailer.name}
        </Link>

        <h1 className="mt-4 font-display text-[2.125rem] leading-[1.1] tracking-[-0.015em] text-ink sm:text-[2.5rem]">
          {product.name}
        </h1>

        <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
          This item at {retailer.name}, as {item.owner} is working it. Edits are
          written to the record everything else in the portal reads.
        </p>

        <div className="mt-8 grid gap-x-10 gap-y-5 border-t border-rule pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <MetaPair label="Item status">
            <StatusBadge
              label={record.itemStatus}
              tone={itemStatusTone[record.itemStatus]}
            />
          </MetaPair>
          <MetaPair label="Sample">
            <StatusBadge
              label={record.sampleStatus}
              tone={sampleStatusTone[record.sampleStatus]}
            />
          </MetaPair>
          <MetaPair label="Owner">{item.owner}</MetaPair>
          <MetaPair label="Item">{product.itemId}</MetaPair>
        </div>
      </header>

      <ItemEditForm
        itemId={record.id}
        retailerId={retailer.id}
        itemStatus={record.itemStatus}
        sampleStatus={record.sampleStatus}
        nextAction={record.nextAction}
        nextActionDate={record.nextActionDate}
        owner={item.owner}
        today={DEMO_TODAY}
        tracked={
          tracked
            ? {
                id: tracked.id,
                label: tracked.label,
                status: tracked.status,
                due: tracked.due,
                owner: getOwnerName(tracked.ownerId),
              }
            : undefined
        }
      />

      {/* -- what the record already holds --------------------------------- */}
      <div className="mt-16 space-y-14 lg:mt-20 lg:space-y-16">
        <section>
          <SectionHeader
            title="Feedback on this item"
            description="Every record, oldest first. Nothing here is ever edited or replaced."
          />
          {feedback.length === 0 ? (
            <p className="text-sm text-ink-faint">
              Nothing recorded from the buyer on this item yet.
            </p>
          ) : (
            <ol className="max-w-[70ch] space-y-6">
              {feedback.map((entry) => (
                <li key={entry.id} className="border-l-2 border-rule pl-5">
                  <p className="text-[15px] leading-relaxed text-ink-muted">
                    &ldquo;{entry.quote}&rdquo;
                  </p>
                  <p className="type-label mt-2">
                    {[
                      entry.theme,
                      entry.source,
                      entry.occurredAt ? formatLongDate(entry.occurredAt) : "no date recorded",
                      entry.recordedBy ? getOwnerName(entry.recordedBy as OwnerId) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <section>
            <SectionHeader
              title="Actions on this item"
              description="An item can carry as many as the work needs."
            />
            {actions.length === 0 ? (
              <p className="text-sm text-ink-faint">
                Nothing on the shared action list for this item.
              </p>
            ) : (
              <ul className="space-y-4">
                {actions.map((action) => (
                  <li
                    key={action.id}
                    className="border-t border-rule-soft pt-4 first:border-t-0 first:pt-0"
                  >
                    <p className="text-sm leading-normal text-ink">{action.label}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <StatusBadge
                        label={action.status}
                        tone={actionStatusTone[action.status]}
                      />
                      <span className="text-[13px] text-ink-faint">
                        {action.id} · {getOwnerName(action.ownerId)} · due{" "}
                        {formatDueDate(action.due)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <SectionHeader
              title="Samples"
              description="One row per physical send. Dates stay empty where none was recorded."
            />
            {samples.length === 0 ? (
              <p className="text-sm text-ink-faint">
                No sample has been raised for this item.
              </p>
            ) : (
              <ul className="space-y-4">
                {samples.map((sample, position) => (
                  <li
                    key={sample.id}
                    className="border-t border-rule-soft pt-4 first:border-t-0 first:pt-0"
                  >
                    <StatusBadge
                      label={sample.status}
                      tone={sampleStatusTone[sample.status]}
                    />
                    <p className="type-label mt-1.5">
                      {"Round " + (position + 1)}
                      {sample.sentAt ? " · sent " + formatLongDate(sample.sentAt) : " · no dates recorded"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
