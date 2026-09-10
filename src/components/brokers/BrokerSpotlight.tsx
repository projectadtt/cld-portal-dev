import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { getSpotlightBroker } from "@/lib/selectors";

/**
 * One broker brought forward — whoever has the most accounts waiting on a
 * buyer decision. The selection is derived, never written down.
 *
 * The same four figures as their row in the table, set large enough to read
 * across a meeting table. Deliberately a single quiet panel rather than a row
 * of tiles: it is a pointer to a person, not a dashboard.
 */
export function BrokerSpotlight() {
  const spotlight = getSpotlightBroker();

  /* With nobody on the book there is nobody to bring forward. The panel says
     so rather than disappearing, so the column keeps its shape. */
  if (!spotlight) {
    return (
      <aside className="border border-rule bg-surface px-6 py-7">
        <p className="type-label">Broker spotlight</p>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          No brokers assigned yet. Once a broker is carrying accounts, whoever
          has the most waiting on a buyer decision appears here.
        </p>
      </aside>
    );
  }

  const { broker } = spotlight;

  const figures = [
    { value: spotlight.contacted, label: "Retailers contacted" },
    { value: spotlight.samplesOut, label: "Samples sent" },
    { value: spotlight.underReview, label: "Under review" },
    { value: spotlight.approved, label: "Approved" },
  ];

  return (
    <aside className="border border-rule bg-surface px-6 py-7">
      <p className="type-label">Broker spotlight</p>

      {/* No avatar here: the panel is narrow, and the mark beside the name
          pushed it onto two lines. The table carries the faces. */}
      <div className="mt-4">
        <p className="font-display text-[1.125rem] leading-tight tracking-[-0.005em] text-ink">
          {broker.name}
        </p>
        <p className="type-label mt-1">{broker.coverage}</p>
      </div>

      <dl className="mt-7 space-y-5">
        {figures.map((figure) => (
          <div key={figure.label} className="flex flex-col-reverse gap-1">
            <dt className="type-label">{figure.label}</dt>
            <dd
              className={
                "font-display text-[1.75rem] leading-none " +
                (figure.value === 0 ? "text-ink-faint" : "text-ink")
              }
            >
              {figure.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-8 border-t border-rule pt-5">
        <Link
          href={"/brokers/" + broker.id}
          className="group inline-flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors hover:text-forest"
        >
          View full profile
          <ArrowRight
            size={13}
            strokeWidth={1.75}
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </p>
    </aside>
  );
}
