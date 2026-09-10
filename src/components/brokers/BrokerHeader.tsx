import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { BrokerAvatar } from "@/components/brokers/BrokerAvatar";
import { meta } from "@/lib/cn";
import type { BrokerPortfolio } from "@/lib/selectors";

/**
 * The opening of a broker workspace.
 *
 * The portfolio description is the account list itself rather than a written
 * summary — the names are the substance, and nothing has to be authored to
 * keep them true.
 */
export function BrokerHeader({ portfolio }: { portfolio: BrokerPortfolio }) {
  const { broker, retailers } = portfolio;

  return (
    <header className="mb-12 sm:mb-14">
      <Link
        href="/brokers"
        className="group mb-8 inline-flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors hover:text-forest"
      >
        <ArrowLeft
          size={13}
          strokeWidth={1.75}
          aria-hidden="true"
          className="transition-transform group-hover:-translate-x-0.5"
        />
        All brokers
      </Link>

      {/* The portrait belongs here as much as on the roster: a broker's own
          page was the one screen that never showed the picture uploaded for
          them. Same disc, same treatment, at the size the retailer page gives
          an account mark, so the two detail headers read as a pair. */}
      <div className="flex items-start gap-5">
        <BrokerAvatar broker={broker} size="lg" className="mt-1" />

        <div className="min-w-0">
          {broker.coverage ? (
            <p className="type-label mb-3">{broker.coverage}</p>
          ) : null}

          <h1 className="font-display text-[2.125rem] leading-[1.1] tracking-[-0.015em] text-ink sm:text-[2.5rem]">
            {broker.name}
          </h1>

          {/* Assembled from the parts that exist: role is optional on the
              record, and concatenating an absent one printed the word "null"
              at the head of the line. */}
          <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
            {meta(
              broker.role,
              portfolio.accounts === 1
                ? "1 account"
                : portfolio.accounts + " accounts",
              retailers.map((r) => r.name).join(", ") || undefined,
            )}
          </p>
        </div>
      </div>
    </header>
  );
}
