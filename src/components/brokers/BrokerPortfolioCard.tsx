import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { MetaPair } from "@/components/primitives/MetaPair";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { cn, meta } from "@/lib/cn";
import {
  formatDueDate,
  formatPastDate,
  type BrokerPortfolio,
} from "@/lib/selectors";
import { pipelineTone } from "@/lib/status";

/**
 * One broker as a working portfolio, not a directory entry.
 *
 * Supporting content beneath the accountability table: the counts live in
 * the table, so the card carries what a number cannot — what moved last, what
 * moves next, and which accounts sit under this name.
 */
export function BrokerPortfolioCard({
  portfolio,
}: {
  portfolio: BrokerPortfolio;
}) {
  const { broker, retailers, nextAction, overdue, lastActivity } = portfolio;

  return (
    <li className="border-t border-rule-soft first:border-t-0">
      <article className="py-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-10">
          <div className="min-w-0">
            <h3 className="font-display text-[1.25rem] leading-tight tracking-[-0.005em]">
              <Link
                href={"/brokers/" + broker.id}
                className="group inline-flex items-center gap-1.5 text-ink transition-colors hover:text-forest"
              >
                {broker.name}
                <ArrowUpRight
                  size={15}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className="text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
                />
              </Link>
            </h3>
            <p className="type-label mt-1.5">
              {meta(broker.coverage, broker.role)}
            </p>
          </div>

          <p className="type-label shrink-0 sm:text-right">
            {portfolio.accounts === 1
              ? "1 account"
              : portfolio.accounts + " accounts"}
          </p>
        </div>

        <div className="mt-5 grid gap-x-10 gap-y-4 border-t border-rule-soft pt-4 lg:grid-cols-2">
          <MetaPair label="Next move">
            {nextAction ? (
              <>
                <span className="block leading-snug">{nextAction.label}</span>
                <span
                  className={cn(
                    "mt-1 block text-[13px]",
                    overdue ? "font-medium text-red" : "text-ink-faint",
                  )}
                >
                  {"Due " + formatDueDate(nextAction.due) + (overdue ? " · overdue" : "")}
                </span>
              </>
            ) : (
              <span className="text-ink-faint">Nothing outstanding</span>
            )}
          </MetaPair>

          <MetaPair label="Last activity">
            {lastActivity ? (
              <>
                <span className="block leading-snug">
                  {lastActivity.description}
                </span>
                <span className="mt-1 block text-[13px] text-ink-faint">
                  {formatPastDate(lastActivity.date)}
                </span>
              </>
            ) : (
              <span className="text-ink-faint">None recorded</span>
            )}
          </MetaPair>
        </div>

        <div className="mt-5 border-t border-rule-soft pt-4">
          <p className="type-label">Accounts</p>

          <ul className="mt-2.5 space-y-2">
            {retailers.map((retailer) => (
              <li
                key={retailer.id}
                className="flex flex-col gap-x-6 gap-y-1 sm:flex-row sm:items-baseline sm:justify-between"
              >
                <Link
                  href={"/retailers/" + retailer.id}
                  className="min-w-0 text-sm leading-snug text-ink transition-colors hover:text-forest"
                >
                  {retailer.name}
                </Link>

                <span className="flex flex-wrap items-center gap-x-5 gap-y-1 sm:shrink-0">
                  <span className="type-label shrink-0 sm:w-52 sm:text-right">
                    {retailer.channel}
                  </span>
                  <StatusBadge
                    label={retailer.overallStatus}
                    tone={pipelineTone[retailer.overallStatus]}
                    className="sm:w-56"
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </article>
    </li>
  );
}
