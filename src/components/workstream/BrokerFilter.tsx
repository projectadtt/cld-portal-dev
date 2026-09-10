import Link from "next/link";

import type { BrokerId } from "@/data/types";
import { cn } from "@/lib/cn";
import { getAllBrokers } from "@/lib/selectors";

/**
 * Filtering lives in the URL rather than in component state.
 *
 * That keeps this a server component, makes a filtered view linkable during a
 * meeting, and lets back/forward behave the way the client expects.
 */
export function BrokerFilter({ active }: { active?: BrokerId }) {
  const options = [
    { id: undefined, label: "All brokers", href: "/workstream" },
    ...getAllBrokers().map((broker) => ({
      id: broker.id,
      label: broker.name,
      href: "/workstream?broker=" + broker.id,
    })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <p className="type-label">Broker</p>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.id === active;

          return (
            <Link
              key={option.label}
              href={option.href}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "rounded-sm border px-3.5 py-1.5 text-[13px] leading-5 transition-colors",
                selected
                  ? "border-forest bg-forest-tint font-medium text-forest"
                  : "border-rule text-ink-muted hover:border-ink-faint hover:text-ink",
              )}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
