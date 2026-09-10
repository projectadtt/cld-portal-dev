import { ArrowLeft } from "lucide-react";
import Link from "next/link";

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

      <p className="type-label mb-3">{broker.coverage}</p>

      <h1 className="font-display text-[2.125rem] leading-[1.1] tracking-[-0.015em] text-ink sm:text-[2.5rem]">
        {broker.name}
      </h1>

      <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
        {broker.role +
          " · " +
          (portfolio.accounts === 1
            ? "1 account"
            : portfolio.accounts + " accounts") +
          " · " +
          retailers.map((r) => r.name).join(", ")}
      </p>
    </header>
  );
}
