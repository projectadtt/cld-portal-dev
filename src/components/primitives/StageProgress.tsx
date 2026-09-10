import { cn } from "@/lib/cn";
import {
  PIPELINE_PROGRESSION,
  pipelineIndex,
  type PipelineStatus,
} from "@/lib/status";

/**
 * The rungs a retailer actually climbs, taken straight from the canonical
 * pipeline ladder.
 *
 * "Not reached out yet" is the zero state rather than a step, so it renders
 * an empty track — which is why the first status is sliced off.
 */
const STEPS = PIPELINE_PROGRESSION.slice(1);

interface StageProgressProps {
  stage: PipelineStatus;
  /** Show the current stage name beneath the track. */
  showLabel?: boolean;
  className?: string;
}

/**
 * The portal's one piece of non-textual signal. Communicates progression at a
 * glance without becoming a chart (CLAUDE.md §17).
 */
export function StageProgress({
  stage,
  showLabel = false,
  className,
}: StageProgressProps) {
  const index = pipelineIndex(stage);
  const offTrack = index < 0;
  const completed = offTrack ? 0 : index;

  return (
    <div className={cn("min-w-0", className)}>
      <div
        role="img"
        aria-label={"Stage: " + stage}
        className="flex w-full items-center gap-1"
      >
        {STEPS.map((step, i) => (
          <span
            key={step}
            className={cn(
              "h-[3px] flex-1",
              i < completed ? "bg-forest" : "bg-rule",
            )}
          />
        ))}
      </div>

      {showLabel ? (
        <p
          className={cn(
            "mt-2 text-[13px] leading-5",
            offTrack ? "text-ink-faint" : "text-ink",
          )}
        >
          {stage}
          {!offTrack ? (
            <span className="text-ink-faint">
              {" · step " + completed + " of " + STEPS.length}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
