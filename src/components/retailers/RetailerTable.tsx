import { AlertCircle, SearchX } from "lucide-react";
import Link from "next/link";

import { BrokerName } from "@/components/primitives/BrokerName";
import { EmptyState } from "@/components/primitives/EmptyState";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { RetailerMark } from "@/components/retailer/RetailerMark";
import { cn } from "@/lib/cn";
import { countRetailers, formatDueDate, formatShortDate, getRetailerPipeline, type RetailerFilter, type RetailerPipelineRow } from "@/lib/selectors";
import { pipelineTone, sampleStatusTone } from "@/lib/status";

const COLUMNS = [
  { label: "Retailer", className: "w-56 pr-4" },
  { label: "Broker", className: "w-20 pr-4" },
  { label: "Last contact", className: "w-20 pr-4" },
  { label: "Samples", className: "w-24 pr-4" },
  { label: "Status", className: "w-32 pr-4" },
  { label: "Buyer feedback", className: "w-28 pr-4" },
  { label: "Next step", className: "" },
];

/** Nothing invented to fill a cell: an empty field reads as empty. */
function Blank() {
  return <span className="text-ink-faint">—</span>;
}

function Row({ row }: { row: RetailerPipelineRow }) {
  const { retailer, broker, nextAction, overdue } = row;

  return (
    <tr className="border-b border-rule-soft align-top">
      <th scope="row" className="py-4 pr-4 text-left font-normal">
        {/* The attention rule sits inside the first cell rather than on the
            row, because a border on a <tr> does not paint reliably. */}
        <span
          className={cn(
            "flex items-center gap-3 border-l-2 pl-3",
            row.attention ? "border-red" : "border-transparent",
          )}
        >
          <RetailerMark retailer={retailer} size="sm" />
          <span className="min-w-0">
            <Link
              href={"/retailers/" + retailer.id}
              className="text-sm leading-snug text-ink transition-colors hover:text-forest"
            >
              {retailer.name}
            </Link>
            {row.attention ? (
              <span className="mt-1 flex items-start gap-1.5 text-[13px] leading-5 text-red">
                <AlertCircle
                  size={12}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="mt-1 shrink-0"
                />
                Needs a decision
              </span>
            ) : null}
          </span>
        </span>
      </th>

      <td className="py-4 pr-4 text-[13px] leading-5">
        <BrokerName broker={broker} short className="text-ink" />
      </td>

      <td className="py-4 pr-4 text-[13px] leading-5 text-ink">
        {retailer.lastContact ? (
          formatShortDate(retailer.lastContact)
        ) : (
          <Blank />
        )}
      </td>

      <td className="py-4 pr-4">
        <StatusBadge
          label={retailer.sampleStatus}
          tone={sampleStatusTone[retailer.sampleStatus]}
          wrap
        />
      </td>

      <td className="py-4 pr-4">
        <StatusBadge
          label={retailer.overallStatus}
          tone={pipelineTone[retailer.overallStatus]}
          wrap
        />
      </td>

      <td className="py-4 pr-4 text-[13px] leading-5 text-ink">
        {row.feedbackSignal ?? <Blank />}
      </td>

      <td className="py-4 text-[13px] leading-5">
        {nextAction ? (
          <>
            <Link
              href="/actions"
              className="line-clamp-2 text-ink transition-colors hover:text-forest"
            >
              {nextAction.label}
            </Link>
            <span
              className={cn(
                "mt-1 block",
                overdue ? "font-medium text-red" : "text-ink-faint",
              )}
            >
              {formatDueDate(nextAction.due) + (overdue ? " · overdue" : "")}
            </span>
          </>
        ) : retailer.nextAction ? (
          <>
            <span className="line-clamp-2 text-ink">{retailer.nextAction}</span>
            {/* An undated step still says what it is; only the date is missing. */}
            {retailer.nextActionDate ? (
              <span className="mt-1 block text-ink-faint">
                {formatDueDate(retailer.nextActionDate)}
              </span>
            ) : null}
          </>
        ) : (
          <Blank />
        )}
      </td>
    </tr>
  );
}

/**
 * The book of accounts as one scannable table.
 *
 * Grouped by how far each account has travelled — furthest along first, so
 * the page opens on what is closest to a decision. The groups share a single
 * table rather than one table each, so a column means the same width the
 * whole way down and the eye can run straight through the book.
 *
 * Grouping by stage rather than by broker is what makes this a different
 * reading of the same tracker the workstream screen groups by owner.
 */
export function RetailerTable({ filter }: { filter: RetailerFilter }) {
  const groups = getRetailerPipeline(filter);

  if (groups.length === 0) {
    const nothingYet = countRetailers() === 0;
    return (
      <EmptyState
        icon={SearchX}
        message={
          nothingYet
            ? "No retailers in the pipeline yet. Add an account and it will appear here."
            : "No accounts match this combination of filters."
        }
      />
    );
  }

  return (
    /* Scrolls inside its own container so the page body never does. */
    <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[56rem] border-collapse text-left">
        <caption className="sr-only">
          Every retail account, grouped by how far it has travelled
        </caption>

        <thead>
          <tr className="border-b border-rule">
            {COLUMNS.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={cn("type-label pb-2.5 font-normal", column.className)}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        {groups.map(({ phase, rows }) => (
          <tbody key={phase.id}>
            <tr>
              <th
                scope="colgroup"
                colSpan={COLUMNS.length}
                className="type-label border-b border-rule pb-2.5 pt-9 text-left font-normal"
              >
                {phase.label +
                  " · " +
                  (rows.length === 1 ? "1 account" : rows.length + " accounts")}
              </th>
            </tr>

            {rows.map((row) => (
              <Row key={row.retailer.id} row={row} />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
