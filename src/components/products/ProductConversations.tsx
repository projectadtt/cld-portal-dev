import { MessagesSquare } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/primitives/EmptyState";
import { MetaPair } from "@/components/primitives/MetaPair";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { cn, meta } from "@/lib/cn";
import {
  NOT_RECORDED,
  UNASSIGNED,
  formatDueDate,
  getOwnerName,
  isActionOverdue,
  type ProductConversation,
} from "@/lib/selectors";
import { itemStatusTone, sampleStatusTone } from "@/lib/status";

/**
 * The whole chain for one product, one row per retailer:
 * retailer, broker, item status, sample, what the buyer said, what happens
 * next. This is the relationship the portal exists to make legible.
 *
 * A pairing just entered carries almost none of this — no fit, no doors, no
 * dated step — so every one of those reads as unrecorded rather than as a
 * figure somebody worked out.
 */

/** A field that belongs on the record but has not been filled in. */
function Unrecorded() {
  return <span className="text-ink-faint">{NOT_RECORDED}</span>;
}
export function ProductConversations({
  conversations,
}: {
  conversations: ProductConversation[];
}) {
  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={MessagesSquare}
        message="This product has not been taken to a retailer yet."
      />
    );
  }

  return (
    <ul>
      {conversations.map(({ record, retailer, broker, action }) => {
        const overdue = action ? isActionOverdue(action) : false;
        /* The tracked action carries the date when there is one; otherwise the
           record's own, which may not have been set. */
        const due = action ? action.due : record.nextActionDate;

        return (
          <li
            key={record.id}
            className="border-t border-rule-soft py-5 first:border-t-0 first:pt-0"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
              <div className="min-w-0">
                <h3 className="font-display text-[1.0625rem] leading-tight tracking-[-0.005em]">
                  <Link
                    href={"/retailers/" + retailer.id}
                    className="text-ink transition-colors hover:text-forest"
                  >
                    {retailer.name}
                  </Link>
                </h3>
                <p className="type-label mt-1">
                  {retailer.channel + " · "}
                  {broker ? (
                    <Link
                      href={"/workstream?broker=" + broker.id}
                      className="transition-colors hover:text-forest"
                    >
                      {broker.name}
                    </Link>
                  ) : (
                    UNASSIGNED
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 sm:shrink-0 sm:justify-end">
                <StatusBadge
                  label={record.itemStatus}
                  tone={itemStatusTone[record.itemStatus]}
                />
                <StatusBadge
                  label={record.sampleStatus}
                  tone={sampleStatusTone[record.sampleStatus]}
                />
              </div>
            </div>

            {record.buyerFeedback ? (
              <blockquote className="mt-3 max-w-[64ch] text-sm leading-relaxed text-ink-muted">
                {"“" + record.buyerFeedback + "”"}
                {record.feedbackTheme ? (
                  <span className="type-label mt-1.5 block">
                    {record.feedbackTheme}
                  </span>
                ) : null}
              </blockquote>
            ) : null}

            <div className="mt-3.5 grid gap-x-8 gap-y-3 border-t border-rule-soft pt-3 sm:grid-cols-3">
              <MetaPair label="Fit">
                {record.fit ?? <Unrecorded />}
              </MetaPair>

              {/* A door count nobody has estimated is not an estimate of
                  nought — the figure is absent, not zero. */}
              <MetaPair label="Estimated doors">
                {record.estimatedDoors === undefined ? (
                  <Unrecorded />
                ) : (
                  record.estimatedDoors.toLocaleString("en-US")
                )}
              </MetaPair>

              <MetaPair label="Next action">
                <span className="block leading-snug">
                  {(action ? action.label : record.nextAction) ?? <Unrecorded />}
                </span>
                <span
                  className={cn(
                    "mt-1 block text-[13px]",
                    overdue ? "font-medium text-red" : "text-ink-faint",
                  )}
                >
                  {meta(
                    getOwnerName(record.ownerId),
                    due ? "due " + formatDueDate(due) : undefined,
                    overdue ? "overdue" : undefined,
                  )}
                </span>
              </MetaPair>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
