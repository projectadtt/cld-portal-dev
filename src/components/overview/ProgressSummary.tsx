import { cn } from "@/lib/cn";
import { getOverviewMetrics } from "@/lib/selectors";

/**
 * Where things stand, in five figures.
 *
 * Tiles rather than the editorial rule the rest of the portal uses: these five
 * are the one place on the page where the reader is scanning for a number
 * instead of reading a sentence, and a tile is what makes a number findable.
 * They stay quiet about it — one radius, a hairline, and a shadow you have to
 * look for — so the page still opens with the headline rather than with a row
 * of panels.
 *
 * The 4px edge is the only colour, and it says which side of the relationship
 * the number describes: Forest for work CLD is doing, neutral for a fact with
 * no side to it, Amber for an account now waiting on the buyer, and Red for
 * the one count that is a live conversation. Only that last tile takes a
 * ground and a coloured figure, so the eye lands on it once and not five
 * times.
 */

const TONE = {
  /** Work CLD is doing. */
  work: { edge: "border-l-forest", ground: "bg-paper", figure: "text-ink", label: "text-ink-faint" },
  /** A fact with no side to it. */
  neutral: { edge: "border-l-rule", ground: "bg-paper", figure: "text-ink", label: "text-ink-faint" },
  /** Handed over — now waiting on the buyer. */
  review: { edge: "border-l-amber", ground: "bg-paper", figure: "text-ink", label: "text-ink-faint" },
  /** A live conversation. The only tile that colours its own figure. */
  buyer: { edge: "border-l-red", ground: "bg-red-tint/60", figure: "text-red", label: "text-red/80" },
} as const;

export function ProgressSummary() {
  const m = getOverviewMetrics();

  const figures = [
    { value: m.activeBrokers, label: "Active brokers", tone: "work" },
    { value: m.retailersInProgress, label: "Retailers in progress", tone: "work" },
    /* Counted in SKUs, not retailers — the funnel below counts retailers,
       and two figures labelled the same way with different units confuse. */
    { value: m.samplesSent, label: "SKU samples sent", tone: "neutral" },
    { value: m.retailersInReview, label: "Retailers in review", tone: "review" },
    { value: m.buyerDiscussions, label: "Buyer discussions", tone: "buyer" },
  ] as const;

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
      {figures.map((figure) => {
        const tone = TONE[figure.tone];

        return (
          <div
            key={figure.label}
            /* Two columns on mobile, three at sm, five at lg.

               The figures have to sit on one line across the row. Two things
               put them there. `justify-end` packs the content at the top of
               the tile — in a reversed column the main axis runs upward, so
               end is the top — which pins every figure to the same height
               however tall its tile grows. And the label reserves two lines
               whether it needs them or not, so a tile whose label wraps does
               not push its own figure up while its neighbour's stays down.
               Without both, the row staggered like a camel's back. */
            className={cn(
              "flex flex-col-reverse justify-end gap-2 rounded-card border border-rule border-l-4 px-4 py-4 shadow-card",
              tone.edge,
              tone.ground,
            )}
          >
            <dt className={cn("type-label min-h-8", tone.label)}>
              {figure.label}
            </dt>
            <dd className={cn("font-display text-[1.75rem] leading-none", tone.figure)}>
              {figure.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
