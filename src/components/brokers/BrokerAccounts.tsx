import { AlertCircle, ArrowUpRight, Building2 } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/primitives/EmptyState";
import { MetaPair } from "@/components/primitives/MetaPair";
import { StageProgress } from "@/components/primitives/StageProgress";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { cn } from "@/lib/cn";
import {
  formatDueDate,
  formatRelativeDate,
  type BrokerAccount,
} from "@/lib/selectors";
import { itemStatusTone, pipelineTone, sampleStatusTone } from "@/lib/status";

/**
 * The accounts one broker is responsible for, furthest along first.
 *
 * Deliberately leaner than the row on the Retailers screen: the broker is
 * already named by the page, so the space goes to what the buyer said and
 * what happens next instead of repeating ownership on every row.
 */
export function BrokerAccounts({ accounts }: { accounts: BrokerAccount[] }) {
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        message="No retail accounts are assigned to this broker."
      />
    );
  }

  return (
    <ul>
      {accounts.map((account) => {
        const { retailer, items, feedback, nextAction, overdue, lastActivity } =
          account;

        return (
          <li key={retailer.id} className="border-t border-rule-soft first:border-t-0">
            <article
              className={cn(
                "border-l-2 py-6 pl-6",
                account.attention ? "border-red" : "border-transparent",
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
                <div className="min-w-0">
                  <h3 className="font-display text-[1.125rem] leading-tight tracking-[-0.005em]">
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
                  <p className="type-label mt-1.5">
                    {retailer.channel + " · " + retailer.geography}
                  </p>
                </div>

                <div className="shrink-0 sm:w-48 sm:text-right">
                  <StatusBadge
                    label={retailer.overallStatus}
                    tone={pipelineTone[retailer.overallStatus]}
                    className="sm:justify-end"
                  />
                  <StageProgress
                    stage={retailer.overallStatus}
                    className="mt-2 w-36 sm:ml-auto"
                  />
                </div>
              </div>

              {account.attention ? (
                <p className="mt-3.5 flex items-start gap-2 text-sm leading-normal text-ink-muted">
                  <AlertCircle
                    size={14}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-red"
                  />
                  {account.attention}
                </p>
              ) : null}

              {feedback ? (
                <blockquote className="mt-3.5 max-w-[64ch] text-sm leading-relaxed text-ink-muted">
                  {"“" + feedback.quote + "”"}
                  <span className="type-label mt-1.5 block">
                    {feedback.product.name +
                      (feedback.theme ? " · " + feedback.theme : "")}
                  </span>
                </blockquote>
              ) : null}

              <div className="mt-4 grid gap-x-8 gap-y-3 border-t border-rule-soft pt-3.5 sm:grid-cols-2 lg:grid-cols-5">
                <MetaPair label="Items">
                  {items.length === 0 ? (
                    <span className="text-ink-faint">None yet</span>
                  ) : items.length === 1 ? (
                    "1 item"
                  ) : (
                    items.length + " items"
                  )}
                </MetaPair>

                <MetaPair label="Sample">
                  <StatusBadge
                    label={retailer.sampleStatus}
                    tone={sampleStatusTone[retailer.sampleStatus]}
                  />
                </MetaPair>

                <MetaPair label="Last activity">
                  {lastActivity ? (
                    formatRelativeDate(lastActivity.date)
                  ) : (
                    <span className="text-ink-faint">None recorded</span>
                  )}
                </MetaPair>

                <MetaPair label="Next action" className="lg:col-span-2">
                  {nextAction ? (
                    <>
                      <span className="block leading-snug">{nextAction.label}</span>
                      <span
                        className={cn(
                          "mt-1 block text-[13px]",
                          overdue ? "font-medium text-red" : "text-ink-faint",
                        )}
                      >
                        {"Due " +
                          formatDueDate(nextAction.due) +
                          (overdue ? " · overdue" : "")}
                      </span>
                    </>
                  ) : (
                    <span className="text-ink-faint">None set</span>
                  )}
                </MetaPair>
              </div>

              {items.length > 0 ? (
                <div className="mt-4 border-t border-rule-soft pt-3.5">
                  <p className="type-label">In the workstream</p>

                  <ul className="mt-2.5 space-y-2">
                    {items.map(({ record, product }) => (
                      <li
                        key={record.id}
                        className="flex flex-col gap-x-6 gap-y-1 sm:flex-row sm:items-baseline sm:justify-between"
                      >
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
                            className="sm:w-40"
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-4 border-t border-rule-soft pt-3.5 text-sm text-ink-faint">
                  No active product conversation yet.
                </p>
              )}
            </article>
          </li>
        );
      })}
    </ul>
  );
}
