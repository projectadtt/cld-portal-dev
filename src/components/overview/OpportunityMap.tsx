import { ScatterChart } from "lucide-react";

import { EmptyState } from "@/components/primitives/EmptyState";
import { SectionHeader } from "@/components/primitives/SectionHeader";
import { getOpportunityMap, type OpportunityMapPoint } from "@/lib/selectors";

/* Plot geometry, in viewBox units. */
const LEFT = 44;
const RIGHT = 300;
const TOP = 20;
const BOTTOM = 196;
const WIDTH = RIGHT - LEFT;
const HEIGHT = BOTTOM - TOP;

/** Past this x, a label would run off the plot, so it sits to the left. */
const FLIP_LABEL_AT = 240;

/* Label metrics, in viewBox units: roughly one glyph at fontSize 9.5, the
   gap between a mark and its label, and one line of vertical clearance. */
const CHAR_WIDTH = 5.1;
const LABEL_GAP = 9;
const LINE = 10;

interface PlacedPoint {
  point: OpportunityMapPoint;
  x: number;
  y: number;
  /** Label sits to the left of the mark rather than the right. */
  flip: boolean;
  labelY: number;
}

/**
 * Marks are plotted from the data; labels are then placed so two accounts
 * sitting almost on top of each other stay readable.
 *
 * A label prefers the right of its mark, flips to the left if that side is
 * taken, and only drops a line when both sides are blocked. Flipping is
 * preferred over dropping because a label has no leader line — it has to stay
 * beside its own mark to be readable at all.
 *
 * Nothing about the plotted position changes; only where the name is written.
 */
function placeLabels(
  points: OpportunityMapPoint[],
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
): PlacedPoint[] {
  const placed: { left: number; right: number; y: number }[] = [];

  const collides = (left: number, right: number, y: number) =>
    placed.some(
      (other) =>
        other.right > left && other.left < right && Math.abs(other.y - y) < LINE,
    );

  return points.map((point) => {
    const x = LEFT + ((point.brandReadiness - xMin) / (xMax - xMin)) * WIDTH;
    const y = BOTTOM - ((point.marketOpportunity - yMin) / (yMax - yMin)) * HEIGHT;
    const width = point.name.length * CHAR_WIDTH;
    const labelY = y + 3.5;

    /* Past FLIP_LABEL_AT the right side would run off the plot, so the left
       is the preferred side there rather than the fallback. */
    const preferLeft = x > FLIP_LABEL_AT;
    const box = (left: boolean) => {
      const start = left ? x - LABEL_GAP - width : x + LABEL_GAP;
      return { left: start, right: start + width };
    };

    for (const side of preferLeft ? [true, false] : [false, true]) {
      const { left, right } = box(side);
      const insidePlot = left >= LEFT && right <= RIGHT;
      if (insidePlot && !collides(left, right, labelY)) {
        placed.push({ left, right, y: labelY });
        return { point, x, y, flip: side, labelY };
      }
    }

    /* Both sides blocked: keep the preferred side and step down until clear. */
    const { left, right } = box(preferLeft);
    let dropped = labelY;
    for (let guard = 0; guard < points.length && collides(left, right, dropped); guard++) {
      dropped += LINE;
    }
    placed.push({ left, right, y: dropped });
    return { point, x, y, flip: preferLeft, labelY: dropped };
  });
}

/**
 * Where the prize is big and where the brand is ready.
 *
 * Deliberately not a BI chart: hairline frame, one ink colour, and a single
 * meaningful encoding — filled marks are accounts already in the workstream,
 * hollow marks are prizes nobody has started on. That contrast is the whole
 * argument the map is making.
 */
export function OpportunityMap() {
  const points = getOpportunityMap();

  /* Both axes are derived, so an account only appears once it has volume
     inputs and a recorded fit. Until one does, there is nothing to plot —
     and an empty pair of axes is worse than no chart at all: it looks like a
     chart that failed rather than a question nobody has answered yet. The
     arithmetic below would also run on an empty set, where Math.min() is
     Infinity and every coordinate comes out NaN. */
  if (points.length === 0) {
    return (
      <section>
        <SectionHeader
          title="Opportunity map"
          description="Unit opportunity against how ready each account is to convert today."
        />
        <EmptyState
          boxed
          icon={ScatterChart}
          message="No account can be placed yet."
          detail="Both axes are derived, so an account appears once it has volume inputs and a recorded fit."
        />
      </section>
    );
  }

  /* Scale to the accounts actually plotted, padded, rather than a fixed
     0–100 box. The axes carry no ticks — they read low-to-high — so fitting
     the domain to the data spreads the marks instead of stranding them all
     in one corner. */
  const pad = 10;
  const readiness = points.map((p) => p.brandReadiness);
  const opportunity = points.map((p) => p.marketOpportunity);
  const xMin = Math.min(...readiness) - pad;
  const xMax = Math.max(...readiness) + pad;
  const yMin = Math.min(...opportunity) - pad;
  const yMax = Math.max(...opportunity) + pad;

  return (
    <section>
      <SectionHeader
        title="Opportunity map"
        description="Unit opportunity against how ready each account is to convert today."
      />

      {/* The heading keeps the page's left margin with every other section;
          only the drawing is centred, and its legend travels with it so the
          rule beneath the chart matches the chart's own width rather than
          running the full measure under a narrower picture. */}
      <div className="mx-auto w-full max-w-[34rem]">
      <svg
        viewBox="0 0 320 236"
        className="h-auto w-full"
        role="img"
        aria-label="Retail accounts plotted by market opportunity against brand readiness."
      >
        {/* Two axis rules rather than a boxed frame: a full rectangle was the
            only enclosed element on the page and read as a chart widget,
            pulling attention away from the retail workstream above it. */}
        <line
          x1={LEFT}
          y1={TOP}
          x2={LEFT}
          y2={BOTTOM}
          stroke="var(--color-rule)"
          strokeWidth="1"
        />
        <line
          x1={LEFT}
          y1={BOTTOM}
          x2={RIGHT}
          y2={BOTTOM}
          stroke="var(--color-rule)"
          strokeWidth="1"
        />

        {placeLabels(points, xMin, xMax, yMin, yMax).map(({ point, x, y, flip, labelY }) => {
          return (
            <g key={point.id}>
              <title>{point.name + " — " + point.note}</title>

              <circle
                cx={x}
                cy={y}
                r="4.5"
                fill={point.inWorkstream ? "var(--color-forest)" : "var(--color-paper)"}
                stroke="var(--color-forest)"
                strokeWidth="1.25"
              />

              <text
                x={flip ? x - LABEL_GAP : x + LABEL_GAP}
                y={labelY}
                textAnchor={flip ? "end" : "start"}
                fontSize="9.5"
                fill="var(--color-ink)"
              >
                {point.name}
              </text>
            </g>
          );
        })}

        <text
          x={LEFT + WIDTH / 2}
          y="222"
          textAnchor="middle"
          fontSize="9"
          letterSpacing="0.08em"
          fill="var(--color-ink-faint)"
        >
          ACCOUNT READINESS →
        </text>

        <text
          x="14"
          y={TOP + HEIGHT / 2}
          textAnchor="middle"
          fontSize="9"
          letterSpacing="0.08em"
          fill="var(--color-ink-faint)"
          transform={"rotate(-90 14 " + (TOP + HEIGHT / 2) + ")"}
        >
          UNIT OPPORTUNITY ↑
        </text>
      </svg>

      <div className="mt-5 flex flex-wrap gap-x-7 gap-y-2 border-t border-rule-soft pt-4">
        <p className="flex items-center gap-2 text-[13px] text-ink-muted">
          <span
            aria-hidden="true"
            className="size-2 rounded-full border border-forest bg-forest"
          />
          In the workstream
        </p>
        <p className="flex items-center gap-2 text-[13px] text-ink-muted">
          <span
            aria-hidden="true"
            className="size-2 rounded-full border border-forest bg-paper"
          />
          Not started yet
        </p>
      </div>
      </div>
    </section>
  );
}
