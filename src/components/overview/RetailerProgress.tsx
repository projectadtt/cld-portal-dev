import { SectionHeader } from "@/components/primitives/SectionHeader";
import { SectionLink } from "@/components/primitives/SectionLink";
import { getProgressFunnel } from "@/lib/selectors";

/**
 * How far the book of accounts has travelled — a funnel, not a reprint of the
 * workstream. Each step is a superset of the one below it, so the shape reads
 * as progression at a glance. One colour; length carries the meaning.
 *
 * The broker roster that used to sit underneath is now its own section,
 * `AssignedBrokers`, so it can line up with what buyers are telling us on the
 * Overview grid. It was never part of the funnel's reading — it was beneath it
 * for want of anywhere better.
 */
export function RetailerProgress() {
  const steps = getProgressFunnel();
  const widest = Math.max(...steps.map((step) => step.count), 1);

  return (
    <section>
      <SectionHeader
        lead
        title="Retailer progress"
        description="Retailers that have reached each stage."
        action={
          <SectionLink href="/workstream" cta>View retail workstream</SectionLink>
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
    </section>
  );
}
