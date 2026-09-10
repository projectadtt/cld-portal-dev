import { ArrowUpRight, PackageSearch } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/primitives/EmptyState";
import { MetaPair } from "@/components/primitives/MetaPair";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { cn, meta } from "@/lib/cn";
import {
  NOT_RECORDED,
  formatDueDate,
  getOwnerName,
  type BrokerRecordGroup,
} from "@/lib/selectors";
import { itemStatusTone, sampleStatusTone } from "@/lib/status";

/**
 * A drill-down from one column of the accountability table.
 *
 * The whole chain in one place — broker to retailer to item to status to
 * sample to what the buyer said to what happens next — grouped by the account
 * each record sits on.
 */
export function BrokerRecordList({
  groups,
  emptyMessage,
}: {
  groups: BrokerRecordGroup[];
  emptyMessage: string;
}) {
  if (groups.length === 0) {
    return <EmptyState icon={PackageSearch} message={emptyMessage} />;
  }

  return (
    <div className="space-y-10">
      {groups.map(({ retailer, records }) => (
        <section key={retailer.id}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule pb-3">
            <h3 className="font-display text-[1.0625rem] leading-tight tracking-[-0.005em]">
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
            <p className="type-label">
              {retailer.channel + " · " + retailer.overallStatus}
            </p>
          </div>

          <ul>
            {records.map(({ record, product, action, overdue }) => (
              <li
                key={record.id}
                className="border-t border-rule-soft py-4 first:border-t-0 first:pt-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-10">
                  <Link
                    href={"/products/" + product.id}
                    className="min-w-0 text-sm leading-snug text-ink transition-colors hover:text-forest"
                  >
                    {product.name}
                  </Link>

                  <span className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1">
                    <StatusBadge
                      label={record.itemStatus}
                      tone={itemStatusTone[record.itemStatus]}
                      className="sm:w-40"
                    />
                    <StatusBadge
                      label={record.sampleStatus}
                      tone={sampleStatusTone[record.sampleStatus]}
                      className="sm:w-44"
                    />
                  </span>
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

                <div className="mt-3">
                  <MetaPair label="Next action">
                    {action ? (
                      <>
                        <Link
                          href="/actions"
                          className="block leading-snug transition-colors hover:text-forest"
                        >
                          {action.label}
                        </Link>
                        <span
                          className={cn(
                            "mt-1 block text-[13px]",
                            overdue ? "font-medium text-red" : "text-ink-faint",
                          )}
                        >
                          {getOwnerName(action.ownerId) +
                            " · due " +
                            formatDueDate(action.due) +
                            " · " +
                            (overdue ? "overdue" : action.status)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="block leading-snug">
                          {record.nextAction ?? (
                            <span className="text-ink-faint">{NOT_RECORDED}</span>
                          )}
                        </span>
                        <span className="mt-1 block text-[13px] text-ink-faint">
                          {meta(
                            getOwnerName(record.ownerId),
                            record.nextActionDate
                              ? "due " + formatDueDate(record.nextActionDate)
                              : undefined,
                          )}
                        </span>
                      </>
                    )}
                  </MetaPair>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
