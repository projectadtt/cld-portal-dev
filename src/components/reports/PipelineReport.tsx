import { AlertCircle } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/primitives/StatusBadge";
import { cn } from "@/lib/cn";
import {
  formatDueDate,
  getPipelineReport,
} from "@/lib/selectors";
import { pipelineTone } from "@/lib/status";

const COLUMNS = [
  { label: "Account", className: "w-44 pr-4" },
  { label: "Broker", className: "w-20 pr-4" },
  { label: "Status", className: "w-40 pr-4" },
  { label: "Samples", className: "w-16 pr-4 text-right" },
  { label: "Heard back", className: "w-20 pr-4 text-right" },
  { label: "Next step", className: "" },
];

/**
 * REPORT 2 — the account book, furthest-along first.
 *
 * Ordered by the same pipeline ladder the Retailers screen groups by, so the
 * report and the pipeline can never disagree about where an account stands.
 * Every account is listed: nine is short enough that summarising them would
 * hide more than it saved.
 */
export function PipelineReport() {
  const rows = getPipelineReport();

  return (
    /* Scrolls inside its own container so the page body never does. */
    <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[50rem] border-collapse text-left">
        <caption className="sr-only">
          Every retail account, its broker, pipeline status, samples and next
          step
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

        <tbody>
          {rows.map((row) => (
            <tr
              key={row.retailer.id}
              className="border-b border-rule-soft align-top"
            >
              <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                <Link
                  href={"/retailers/" + row.retailer.id}
                  className="text-sm leading-snug text-ink transition-colors hover:text-forest"
                >
                  {row.retailer.name}
                </Link>
              </th>

              <td className="py-2.5 pr-4 text-[13px] leading-5">
                <Link
                  href={"/brokers/" + row.broker.id}
                  className="text-ink-muted transition-colors hover:text-forest"
                >
                  {row.broker.shortName}
                </Link>
              </td>

              <td className="py-2.5 pr-4">
                <StatusBadge
                  label={row.retailer.overallStatus}
                  tone={pipelineTone[row.retailer.overallStatus]}
                  wrap
                />
              </td>

              <td className="py-2.5 pr-4 text-right text-[13px] leading-5">
                <span
                  className={cn(
                    "tabular-nums",
                    row.samplesOut === 0 ? "text-ink-faint" : "text-ink",
                  )}
                >
                  {row.samplesOut}
                </span>
              </td>

              <td className="py-2.5 pr-4 text-right text-[13px] leading-5">
                <span
                  className={cn(
                    "tabular-nums",
                    row.feedbackCount === 0 ? "text-ink-faint" : "text-ink",
                  )}
                >
                  {row.feedbackCount}
                </span>
              </td>

              <td className="py-2.5 text-[13px] leading-5">
                {row.nextAction ? (
                  <>
                    <span className="text-ink">{row.nextAction.label}</span>
                    <span
                      className={cn(
                        "mt-0.5 flex items-center gap-1.5",
                        row.overdue ? "font-medium text-red" : "text-ink-faint",
                      )}
                    >
                      {row.overdue ? (
                        <AlertCircle
                          size={12}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      ) : null}
                      {formatDueDate(row.nextAction.due)}
                    </span>
                  </>
                ) : (
                  <span className="text-ink-faint">No next step recorded</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
