import Link from "next/link";
import type { ReactNode } from "react";

import { StatusBadge } from "@/components/primitives/StatusBadge";
import { cn } from "@/lib/cn";
import {
  formatDueDate,
  formatLongDate,
  getOwnerName,
  isActionOverdue,
  type RetailerDetail,
} from "@/lib/selectors";
import { sampleStatusTone } from "@/lib/status";

/**
 * The account at a glance, as a label/value list.
 *
 * Only fields the record actually carries appear — an account nobody has
 * spoken to yet simply has no "Last contact" row, rather than a dash standing
 * in for a date that does not exist.
 */
export function RetailerKeyDetails({ detail }: { detail: RetailerDetail }) {
  const { retailer, broker, nextAction } = detail;

  const rows: { label: string; value: ReactNode }[] = [
    {
      label: "Broker",
      value: (
        <Link
          href={"/brokers/" + broker.id}
          className="transition-colors hover:text-forest"
        >
          {broker.name}
        </Link>
      ),
    },
    { label: "Channel", value: retailer.channel },
    { label: "Geography", value: retailer.geography },
    {
      label: "Stores",
      value: "~" + retailer.approximateDoors.toLocaleString("en-US") + " stores",
    },
    { label: "Priority", value: retailer.priority },
    {
      label: "Samples",
      value: (
        <StatusBadge
          label={retailer.sampleStatus}
          tone={sampleStatusTone[retailer.sampleStatus]}
        />
      ),
    },
  ];

  if (retailer.lastContact) {
    rows.splice(5, 0, {
      label: "Last contact",
      value: formatLongDate(retailer.lastContact),
    });
  }

  /* The tracked action is the truth when this step is formally on the action
     list; otherwise the record's own next step stands. */
  const overdue = nextAction ? isActionOverdue(nextAction) : false;

  rows.push({
    label: "Next step",
    value: (
      <>
        <span className="block leading-snug">
          {nextAction ? nextAction.label : retailer.nextAction}
        </span>
        <span
          className={cn(
            "mt-1 block text-[13px]",
            overdue ? "font-medium text-red" : "text-ink-faint",
          )}
        >
          {getOwnerName(
            nextAction ? nextAction.ownerId : retailer.assignedBrokerId,
          ) +
            " · due " +
            formatDueDate(
              nextAction ? nextAction.due : retailer.nextActionDate,
            ) +
            (overdue ? " · overdue" : "")}
        </span>
      </>
    ),
  });

  return (
    <dl>
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[7.5rem_1fr] gap-4 border-t border-rule-soft py-3 first:border-t-0 first:pt-0"
        >
          <dt className="type-label pt-0.5">{row.label}</dt>
          <dd className="min-w-0 text-sm text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
