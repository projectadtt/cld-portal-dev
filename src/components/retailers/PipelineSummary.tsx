import { getPipelineMetrics } from "@/lib/selectors";

/**
 * The book of accounts in four figures, every one counted from the data.
 *
 * "Needs attention" is the only figure that can pick up red, and only when
 * there is actually something to decide.
 */
export function PipelineSummary() {
  const m = getPipelineMetrics();

  const figures = [
    { value: m.targetAccounts, label: "Target accounts", attention: false },
    { value: m.inConversation, label: "In conversation", attention: false },
    { value: m.samplesWithBuyers, label: "Samples with buyers", attention: false },
    {
      value: m.needsAttention,
      label: "Needs attention",
      attention: m.needsAttention > 0,
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-8 border-y border-rule sm:grid-cols-4 sm:gap-x-0">
      {figures.map((figure) => (
        <div
          key={figure.label}
          className="flex flex-col-reverse gap-1.5 py-6 sm:border-l sm:border-rule sm:pl-5 sm:first:border-l-0 sm:first:pl-0"
        >
          <dt className="type-label">{figure.label}</dt>
          <dd
            className={
              "font-display text-[1.75rem] leading-none " +
              (figure.attention ? "text-red" : "text-ink")
            }
          >
            {figure.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
