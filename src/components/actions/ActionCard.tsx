import { AlertCircle } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/primitives/StatusBadge";
import { cn } from "@/lib/cn";
import {
  formatDueDate,
  formatShortDate,
  type ResolvedAction,
} from "@/lib/selectors";
import {
  actionStatusTone,
  itemStatusTone,
  sampleStatusTone,
} from "@/lib/status";

/**
 * One piece of work, with the context that produced it.
 *
 * Reads the way the question is asked out loud: what has to happen, who owes
 * it and on which account, where that item currently stands, and by when.
 *
 * Owner, retailer, product and the tracker row are all real keys on the
 * record. The meeting is not — the data holds no link from a meeting to an
 * action — so it is labelled as the account's last conversation rather than
 * as the reason this action exists.
 */
export function ActionCard({ row }: { row: ResolvedAction }) {
  const { action, broker, ownerName, retailer, product, record, lastMeeting } =
    row;

  return (
    <li className="grid gap-x-10 gap-y-4 border-t border-rule-soft py-6 first:border-t-0 first:pt-0 lg:grid-cols-[1fr_9rem]">
      <div className="min-w-0">
        <h3 className="max-w-[52ch] font-display text-[1.0625rem] leading-snug tracking-[-0.005em] text-ink">
          {action.label}
        </h3>

        <p className="type-label mt-2 flex flex-wrap gap-x-1.5">
          {broker ? (
            <Link
              href={"/brokers/" + broker.id}
              className="transition-colors hover:text-forest"
            >
              {broker.name}
            </Link>
          ) : (
            <span>{ownerName}</span>
          )}

          <span aria-hidden="true">·</span>
          <Link
            href={"/retailers/" + retailer.id}
            className="transition-colors hover:text-forest"
          >
            {retailer.name}
          </Link>

          {product ? (
            <>
              <span aria-hidden="true">·</span>
              <Link
                href={"/products/" + product.id}
                className="transition-colors hover:text-forest"
              >
                {product.name}
              </Link>
            </>
          ) : null}
        </p>

        {/* Where the item itself stands — the tracker row that names this
            action as its next step. Not the whole record, just the state. */}
        {record ? (
          <p className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-rule-soft pt-3">
            <StatusBadge
              label={record.itemStatus}
              tone={itemStatusTone[record.itemStatus]}
            />
            <StatusBadge
              label={record.sampleStatus}
              tone={sampleStatusTone[record.sampleStatus]}
            />
            {record.feedbackTheme ? (
              <span className="text-[13px] leading-5 text-ink-muted">
                {record.feedbackTheme}
              </span>
            ) : null}
          </p>
        ) : null}

        {lastMeeting ? (
          /* Sentence case, not the uppercase label used for names: a meeting
             title is a sentence, and shouting it ten times down the page
             buries the work it sits under. */
          <p className="mt-2.5 text-[13px] leading-5 text-ink-faint">
            {"Last meeting · "}
            <Link
              href={"/meetings/" + lastMeeting.id}
              className="text-ink-muted transition-colors hover:text-forest"
            >
              {lastMeeting.title}
            </Link>
            {", " + formatShortDate(lastMeeting.date)}
          </p>
        ) : null}
      </div>

      <div className="lg:text-right">
        <p
          className={cn(
            "flex items-center gap-1.5 text-sm leading-5 lg:justify-end",
            row.overdue ? "font-medium text-red" : "text-ink",
          )}
        >
          {row.overdue ? (
            <AlertCircle size={13} strokeWidth={2} aria-hidden="true" />
          ) : null}
          {"Due " + formatDueDate(action.due)}
        </p>

        <StatusBadge
          label={row.overdue ? "Overdue" : action.status}
          tone={row.overdue ? "attention" : actionStatusTone[action.status]}
          className="mt-1.5 lg:justify-end"
        />

        {/* The way into the action workspace, where this record is worked.
            One quiet word: the list is read far more often than it is
            changed, and it is still a list of work, not a control panel. */}
        <Link
          href={"/actions/" + action.id}
          className="mt-2.5 inline-block text-[13px] text-ink-faint transition-colors hover:text-forest"
        >
          Open
          <span className="sr-only">{" " + action.label}</span>
        </Link>
      </div>
    </li>
  );
}
