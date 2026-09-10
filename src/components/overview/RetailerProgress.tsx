import Link from "next/link";

import { SectionHeader } from "@/components/primitives/SectionHeader";
import { SectionLink } from "@/components/primitives/SectionLink";
import { meta } from "@/lib/cn";
import {
  UNASSIGNED,
  getProgressFunnel,
  getWorkstreamGroups,
} from "@/lib/selectors";

/**
 * How far the book of accounts has travelled — a funnel, not a reprint of the
 * workstream. Each step is a superset of the one below it, so the shape reads
 * as progression at a glance. One colour; length carries the meaning.
 *
 * The broker roster sits underneath because broker assignment is the client's
 * first-named requirement, and it was otherwise visible only after navigating
 * to the workstream. Each name is a link straight into that broker's filtered
 * book, which is also how the coordination model gets demonstrated.
 */
export function RetailerProgress() {
  const steps = getProgressFunnel();
  const widest = Math.max(...steps.map((step) => step.count), 1);
  const groups = getWorkstreamGroups();

  return (
    <section>
      <SectionHeader
        lead
        title="Retailer progress"
        description="Retailers that have reached each stage."
        action={
          <SectionLink href="/workstream">View retail workstream</SectionLink>
        }
      />

      <dl className="space-y-4">
        {steps.map((step) => (
          <div
            key={step.label}
            className="grid grid-cols-[9.5rem_1fr_1.75rem] items-center gap-4"
          >
            <dt className="type-label truncate">{step.label}</dt>

            <div
              className="h-1.5 bg-rule-soft"
              role="img"
              aria-label={step.count + " retailers reached " + step.label.toLowerCase()}
            >
              <div
                className="h-full bg-forest"
                style={{ width: (step.count / widest) * 100 + "%" }}
              />
            </div>

            <dd className="text-right text-sm tabular-nums text-ink">
              {step.count}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 border-t border-rule-soft pt-5">
        <p className="type-label mb-3.5">Assigned brokers</p>

        <ul className="space-y-3">
          {groups.map(({ broker, rows }) => {
            const count =
              rows.length === 1 ? "1 account" : rows.length + " accounts";

            return (
              <li
                key={broker?.id ?? "unassigned"}
                className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1"
              >
                {/* Accounts with no broker are named here too. This block is
                    the client's first-named requirement — who is on what —
                    so an account with nobody on it is the one row that most
                    needs to be visible, not the one to leave out. */}
                {broker ? (
                  <Link
                    href={"/workstream?broker=" + broker.id}
                    className="text-sm text-ink transition-colors hover:text-forest"
                  >
                    {broker.name}
                  </Link>
                ) : (
                  <span className="text-sm text-ink-muted">{UNASSIGNED}</span>
                )}
                <p className="type-label">{meta(broker?.coverage, count)}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
