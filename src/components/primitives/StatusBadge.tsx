import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/status";

/**
 * Colour is chosen by tone, never by the caller. Callers pass the tone from
 * the centralized maps in src/lib/status.ts (stageTone, itemStateTone,
 * sampleStatusTone, actionStatusTone) so a status can never acquire an
 * ad-hoc colour on one screen and a different one on another.
 */
const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-ink",
  active: "text-forest",
  attention: "text-red",
  dormant: "text-ink-faint",
};

const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-ink-muted",
  active: "bg-forest",
  attention: "bg-red",
  dormant: "bg-rule",
};

interface StatusBadgeProps {
  label: string;
  tone: Tone;
  /** Allow the label to break across lines, for narrow table columns. */
  wrap?: boolean;
  className?: string;
}

/**
 * A status reads as a dot and a word — not a filled pill. Keeps the status
 * vocabulary legible without turning the page into a colour chart
 * (CLAUDE.md §4).
 */
export function StatusBadge({
  label,
  tone,
  wrap = false,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex gap-2 text-[13px] leading-5",
        wrap ? "items-start" : "items-center whitespace-nowrap",
        TONE_TEXT[tone],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          wrap && "mt-[7px]",
          TONE_DOT[tone],
        )}
      />
      {label}
    </span>
  );
}
