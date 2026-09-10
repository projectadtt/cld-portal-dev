import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { BrokerName } from "@/components/primitives/BrokerName";
import { StageProgress } from "@/components/primitives/StageProgress";
import { StatusBadge } from "@/components/primitives/StatusBadge";
import { RetailerMark } from "@/components/retailer/RetailerMark";
import type { RetailerDetail } from "@/lib/selectors";
import { pipelineTone } from "@/lib/status";

/**
 * The account profile.
 *
 * Reads as an identity block rather than a page title: mark, account name,
 * where it sits in the market, and the person carrying it — then, set apart on
 * the right, where the relationship currently stands.
 */
export function RetailerHeader({ detail }: { detail: RetailerDetail }) {
  const { retailer, broker } = detail;

  return (
    <header className="mb-9">
      <Link
        href="/retailers"
        className="type-label inline-flex items-center gap-1.5 transition-colors hover:text-forest"
      >
        <ArrowLeft size={12} strokeWidth={2} aria-hidden="true" />
        Retailers
      </Link>

      <div className="mt-5 border-b border-rule pb-8">
        <div className="flex flex-col gap-7 md:flex-row md:items-start md:justify-between md:gap-10">
          <div className="flex min-w-0 items-start gap-5">
            <RetailerMark retailer={retailer} className="mt-1" />

            <div className="min-w-0">
              <h1 className="font-display text-[2.125rem] leading-[1.05] tracking-[-0.015em] text-ink sm:text-[2.5rem]">
                {retailer.name}
              </h1>

              {/* Each separator travels with the fact that follows it, so a
                wrapped line never opens on a stray middot. */}
              <p className="mt-2.5 flex flex-wrap items-center gap-x-2 text-[15px] leading-relaxed text-ink-muted">
                {[retailer.channel, retailer.geography]
                  .filter((fact) => fact !== undefined)
                  .map((fact, i) => (
                    <span key={fact} className="flex items-center gap-2">
                      {i > 0 ? <span aria-hidden="true">·</span> : null}
                      {fact}
                    </span>
                  ))}
              </p>

              <p className="type-label mt-3">
                <BrokerName broker={broker} />
                {broker?.role ? " · " + broker.role : ""}
              </p>
            </div>
          </div>

          <div className="shrink-0 md:w-52 md:text-right">
            <p className="type-label">Account status</p>
            <StatusBadge
              label={retailer.overallStatus}
              tone={pipelineTone[retailer.overallStatus]}
              className="mt-2 md:justify-end"
            />
            <StageProgress
              stage={retailer.overallStatus}
              className="mt-3 w-40 md:ml-auto"
            />
          </div>
        </div>

        {retailer.attention ? (
          <p className="mt-7 flex items-start gap-2.5 border-l-2 border-red py-1 pl-5 text-[15px] leading-relaxed text-ink">
            <AlertCircle
              size={15}
              strokeWidth={2}
              aria-hidden="true"
              className="mt-1 shrink-0 text-red"
            />
            {retailer.attention.reason}
          </p>
        ) : null}
      </div>
    </header>
  );
}
