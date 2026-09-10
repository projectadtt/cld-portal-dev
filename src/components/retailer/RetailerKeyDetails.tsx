import type { ReactNode } from "react";

import { BrokerName } from "@/components/primitives/BrokerName";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { cn, meta } from "@/lib/cn";
import {
  NOT_RECORDED,
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
 * Two kinds of absence, treated differently. A row the account has no business
 * having is left out entirely — an account nobody has spoken to has no "Last
 * contact" row at all. A row that belongs on every account but has not been
 * filled in keeps its label and says so: the label is already on screen, and
 * leaving the value blank reads as a rendering fault rather than as a fact
 * about the account.
 */

/** A field that belongs on the record but has not been filled in. */
function Unrecorded() {
  return <span className="text-ink-faint">{NOT_RECORDED}</span>;
}
export function RetailerKeyDetails({ detail }: { detail: RetailerDetail }) {
  const { retailer, broker, nextAction } = detail;

  const rows: { label: string; value: ReactNode }[] = [
    { label: "Broker", value: <BrokerName broker={broker} /> },
    { label: "Channel", value: retailer.channel },
    { label: "Geography", value: retailer.geography ?? <Unrecorded /> },
    {
      label: "Stores",
      /* A door count nobody has looked up is not a count of nought, so there
         is no "~0 stores" row to be read off in a meeting. */
      value:
        retailer.approximateDoors === undefined ? (
          <Unrecorded />
        ) : (
          "~" + retailer.approximateDoors.toLocaleString("en-US") + " stores"
        ),
    },
    /* Tier and Priority are the same kind of judgement — how big the prize is,
       and how hard CLD is pushing for it — so they read as a pair. */
    { label: "Tier", value: retailer.tier ?? <Unrecorded /> },
    { label: "Priority", value: retailer.priority ?? <Unrecorded /> },
    /* The other two fields the status form edits. The pipeline status itself
       is already carried by the header badge and the stage indicator, so it is
       not repeated here — but a change to either of these would otherwise be
       invisible on the page the form returns to. */
    { label: "Current / Target", value: retailer.currentTarget },
    { label: "Standing", value: retailer.standing },
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

  /* Placed by the row it belongs before rather than by a number: this used to
     be a bare index, and adding Tier above silently moved it. */
  if (retailer.lastContact) {
    const before = rows.findIndex((row) => row.label === "Samples");
    rows.splice(before === -1 ? rows.length : before, 0, {
      label: "Last contact",
      value: formatLongDate(retailer.lastContact),
    });
  }

  /* The tracked action is the truth when this step is formally on the action
     list; otherwise the record's own next step stands. */
  const overdue = nextAction ? isActionOverdue(nextAction) : false;

  /* The tracked action carries both a label and a date. The account's own
     planning text may carry either, both or neither, so the line is assembled
     from the parts that exist rather than formatted as though it always has
     all of them — formatDueDate on an undated step is where this page used to
     fail. */
  const step = nextAction ? nextAction.label : retailer.nextAction;
  const due = nextAction ? nextAction.due : retailer.nextActionDate;
  const owner = getOwnerName(
    nextAction ? nextAction.ownerId : retailer.assignedBrokerId,
  );

  rows.push({
    label: "Next step",
    value: (
      <>
        <span className="block leading-snug">{step ?? <Unrecorded />}</span>
        <span
          className={cn(
            "mt-1 block text-[13px]",
            overdue ? "font-medium text-red" : "text-ink-faint",
          )}
        >
          {meta(
            owner,
            due ? "due " + formatDueDate(due) : undefined,
            overdue ? "overdue" : undefined,
          )}
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
