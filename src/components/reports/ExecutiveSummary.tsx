import { AlertCircle } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/primitives/StatusBadge";
import { cn } from "@/lib/cn";
import {
  formatDueDate,
  getExecutiveSummary,
  getOwnerName,
  isActionOverdue,
} from "@/lib/selectors";
import { pipelineTone } from "@/lib/status";

/** A block of the snapshot. Four of these are the whole report. */
function Block({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 border-t border-rule-soft pt-5">
      <p className="type-label">{label}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * REPORT 1 — the executive snapshot.
 *
 * Four questions, answered from the records: where things stand, what is
 * waiting on a decision, what is genuinely moving, and what happens next.
 * Every figure opens the screen it was counted from, so this is a summary
 * with a way in — not a second Overview.
 */
export function ExecutiveSummary() {
  const summary = getExecutiveSummary();

  return (
    <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
      <Block label="Where things stand">
        <ul className="space-y-2">
          {summary.stands.map((stat) => (
            <li key={stat.label}>
              <Link
                href={stat.href}
                className="group flex items-baseline gap-2.5 text-sm leading-6 text-ink-muted"
              >
                <span className="w-6 shrink-0 text-right font-display text-[15px] tabular-nums text-ink">
                  {stat.value}
                </span>
                <span className="transition-colors group-hover:text-forest">
                  {stat.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Block>

      <Block label="What needs attention">
        <p className="text-sm leading-6 text-ink">
          <span className={cn(summary.attentionAccounts > 0 && "text-red")}>
            {summary.attentionAccounts === 1
              ? "1 account"
              : summary.attentionAccounts + " accounts"}
          </span>
          {" waiting on a decision · " +
            summary.overdueActions +
            " overdue · " +
            summary.blockedActions +
            " blocked"}
        </p>

        <ul className="mt-3 space-y-2.5">
          {summary.attention.map((signal) => (
            <li key={signal.retailer.id} className="flex items-start gap-2.5">
              {signal.overdue ? (
                <AlertCircle
                  size={13}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="mt-1 shrink-0 text-red"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="mt-[7px] size-1.5 shrink-0 rounded-full bg-ink-muted"
                />
              )}
              <p className="min-w-0 text-[13px] leading-5 text-ink-muted">
                <Link
                  href={"/retailers/" + signal.retailer.id}
                  className="text-ink transition-colors hover:text-forest"
                >
                  {signal.retailer.shortName}
                </Link>
                {" — " + signal.headline}
              </p>
            </li>
          ))}
        </ul>
      </Block>

      <Block label="What is moving">
        <ul className="space-y-2.5">
          {summary.moving.map((row) => (
            <li key={row.retailer.id} className="min-w-0">
              <Link
                href={"/retailers/" + row.retailer.id}
                className="text-sm leading-snug text-ink transition-colors hover:text-forest"
              >
                {row.retailer.name}
              </Link>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-3">
                <StatusBadge
                  label={row.retailer.overallStatus}
                  tone={pipelineTone[row.retailer.overallStatus]}
                />
                <span className="type-label">
                  {row.samplesOut +
                    " out · " +
                    row.feedbackCount +
                    " heard back"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Block>

      <Block label="What should happen next">
        <ul className="space-y-2.5">
          {summary.next.map((action) => {
            const overdue = isActionOverdue(action);

            return (
              <li key={action.id} className="min-w-0">
                <p className="text-sm leading-snug text-ink">{action.label}</p>
                <p className="type-label mt-1">
                  {getOwnerName(action.ownerId) + " · "}
                  <span className={cn(overdue && "font-medium text-red")}>
                    {formatDueDate(action.due)}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      </Block>
    </div>
  );
}
