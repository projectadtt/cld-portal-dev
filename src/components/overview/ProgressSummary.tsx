import { cn } from "@/lib/cn";
import { getOverviewMetrics } from "@/lib/selectors";

/**
 * Where things stand, in five figures.
 *
 * Still an editorial rule rather than a row of KPI cards — no tiles, no
 * shadows, no trend arrows, no icons. The numbers are context for the sections
 * below, not the point of the page (CLAUDE.md §7).
 *
 * Each figure carries a 2px edge and a very pale ground so the five read as
 * five distinct counts rather than one block of digits. The colour says which
 * side of the relationship the number describes: forest for the work CLD is
 * doing, and a single restrained warm figure for the accounts that have
 * reached a conversation with the buyer — the one count that is about them
 * rather than about us. The figures themselves stay in Ink and the labels stay
 * quiet, so the accent differentiates without competing.
 */

/** Forest for the work being done; warm, once only, for the buyer's side. */
const TONE = {
  work: "border-forest bg-forest-tint/40",
  buyer: "border-red/60 bg-red-tint/50",
} as const;

export function ProgressSummary() {
  const m = getOverviewMetrics();

  const figures = [
    { value: m.activeBrokers, label: "Active brokers", tone: "work" },
    { value: m.retailersInProgress, label: "Retailers in progress", tone: "work" },
    /* Counted in SKUs, not retailers — the funnel below counts retailers,
       and two figures labelled the same way with different units confuse. */
    { value: m.samplesSent, label: "SKU samples sent", tone: "work" },
    { value: m.retailersInReview, label: "Retailers in review", tone: "work" },
    { value: m.buyerDiscussions, label: "Buyer discussions", tone: "buyer" },
  ] as const;

  return (
    <dl className="grid grid-cols-2 gap-3 border-y border-rule py-5 sm:grid-cols-3 lg:grid-cols-5">
      {figures.map((figure) => (
        <div
          key={figure.label}
          /* Two columns on mobile, three at sm, five at lg — unchanged. The
             per-cell edge replaces the hairline divider it used to carry,
             which is what removes the old per-breakpoint suppression: every
             cell now owns its own rule, so none has to be cancelled at the
             start of a row. */
          className={cn(
            "flex flex-col-reverse gap-1.5 border-l-2 py-1 pl-3.5",
            TONE[figure.tone],
          )}
        >
          <dt className="type-label">{figure.label}</dt>
          <dd className="font-display text-[1.75rem] leading-none text-ink">
            {figure.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
