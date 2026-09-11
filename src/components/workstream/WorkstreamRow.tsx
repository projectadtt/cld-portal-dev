import { AlertCircle, ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { MetaPair } from "@/components/primitives/MetaPair";
import { StageProgress } from "@/components/primitives/StageProgress";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { cn } from "@/lib/cn";
import {
  formatDueDate,
  formatPastDate,
  getOwnerName,
  isActionOverdue,
  type WorkstreamRow as WorkstreamRowData,
} from "@/lib/selectors";
import { pipelineTone, sampleStatusTone } from "@/lib/status";

/**
 * One retailer in the workstream.
 *
 * Weighted for a single scan — retailer, stage, what happens next — with
 * sample, items and last activity kept quiet beneath (CLAUDE.md §13).
 *
 * Attention is carried by a red left rule and a single red glyph. The row
 * itself stays on paper so a list of twelve never reads as a wall of alerts.
 */
export function WorkstreamRow({ row }: { row: WorkstreamRowData }) {
  const { retailer, itemCount, nextAction, lastActivity } = row;
  const attention = retailer.attention;
  const overdue = nextAction ? isActionOverdue(nextAction) : false;

  /* An attention reason is the more decision-useful line; feedback stands in
     when the account is simply progressing. Both live on the detail page. */
  const note = attention?.reason ?? row.feedback;

  return (
    <li className="border-t border-rule-soft first:border-t-0">
      <article
        className={cn(
          "border-l-2 py-5 pl-6",
          attention ? "border-red" : "border-transparent",
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-display text-[1.0625rem] leading-tight tracking-[-0.005em]">
              <Link
                href={"/retailers/" + retailer.id}
                className="group inline-flex items-center gap-1.5 text-ink transition-colors hover:text-forest"
              >
                {retailer.name}
                <ArrowUpRight
                  size={14}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className="text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
                />
              </Link>

            </h3>

            <p className="mt-1 text-[13px] text-ink-faint">{retailer.channel}</p>
          </div>

          <div className="shrink-0 sm:w-44 sm:text-right">
            {/* The longest pipeline label is wider than this column, and
                nowrap made it push the page 13px sideways at 768px. The badge
                already knows how to break; this is the case it was for. */}
            <StatusBadge
              label={retailer.overallStatus}
              tone={pipelineTone[retailer.overallStatus]}
              wrap
              className="sm:justify-end sm:text-right"
            />
            <StageProgress
              stage={retailer.overallStatus}
              className="mt-2 w-32 sm:ml-auto"
            />
          </div>
        </div>

        {/* Fixed-height slot: a retailer with nothing to report still occupies
            one line, so rows keep a steady cadence down the list without any
            filler content being invented. */}
        <div className="mt-3 min-h-[1.3125rem]">
          {note ? (
            <p className="flex items-start gap-2 text-sm leading-normal text-ink-muted">
              {attention ? (
                <AlertCircle
                  size={14}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-red"
                />
              ) : null}
              {note}
            </p>
          ) : null}
        </div>

        <div className="mt-3.5 grid gap-x-8 gap-y-3 border-t border-rule-soft pt-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetaPair label="Next action" className="lg:col-span-2">
            {nextAction ? (
              <span className="block leading-snug">{nextAction.label}</span>
            ) : (
              <span className="block leading-snug text-ink-faint">None set</span>
            )}

            {/* Owner and due date keep their line even when nothing is
                scheduled, so an account with no next action does not sit
                shorter than the rows around it. */}
            <span
              className={cn(
                "mt-1 block min-h-[1.25rem] text-[13px]",
                overdue ? "font-medium text-red" : "text-ink-faint",
              )}
            >
              {nextAction
                ? getOwnerName(nextAction.ownerId) +
                  " · due " +
                  formatDueDate(nextAction.due) +
                  (overdue ? " · overdue" : "")
                : null}
            </span>
          </MetaPair>

          <MetaPair label="Sample">
            <StatusBadge
              label={retailer.sampleStatus}
              tone={sampleStatusTone[retailer.sampleStatus]}
            />
          </MetaPair>

          <MetaPair label="Items">
            {itemCount === 0 ? (
              <span className="text-ink-faint">None yet</span>
            ) : itemCount === 1 ? (
              "1 item"
            ) : (
              itemCount + " items"
            )}
          </MetaPair>

          <MetaPair label="Last activity">
            {lastActivity ? (
              formatPastDate(lastActivity.date)
            ) : (
              <span className="text-ink-faint">None recorded</span>
            )}
          </MetaPair>
        </div>
      </article>
    </li>
  );
}
