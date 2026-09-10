import { SectionHeader } from "@/components/primitives/SectionHeader";
import { getNotYet } from "@/lib/selectors";

/**
 * What CLD is deliberately holding.
 *
 * The counterpart to the workstream: naming what the client should not chase
 * this quarter is part of the advice, not an omission.
 */
export function NotYet() {
  const items = getNotYet();

  return (
    <section>
      <SectionHeader
        title="Not yet"
        description="Worth doing later. Deliberately not now."
      />

      <dl className="grid gap-x-10 gap-y-7 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.id}>
            <dt className="text-sm leading-snug text-ink">{item.label}</dt>
            <dd className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
              {item.reason}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
