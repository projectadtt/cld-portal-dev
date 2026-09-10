import { cn } from "@/lib/cn";

/**
 * The square a record shows instead of a photograph.
 *
 * Two lines of type in the same frame the picture would occupy, so a form or a
 * grid keeps its shape whether or not anything has been uploaded. The wording
 * is whatever the record can honestly say about itself — a product knows its
 * category and item number long before anyone has photographed it.
 *
 * Used on the forms. The list and detail screens have their own versions of
 * this that read from the record itself; this is the one for the case where
 * there is not yet a record to read from.
 */
export function ImagePlate({
  primary,
  secondary,
  circle = false,
  className,
}: {
  primary: string;
  secondary?: string;
  circle?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex aspect-square flex-col items-center justify-center gap-1.5 border border-rule bg-surface px-4 text-center",
        circle ? "rounded-full" : "",
        className,
      )}
    >
      <p className="font-display text-[14px] leading-snug text-ink-muted">{primary}</p>
      {secondary ? <p className="type-label">{secondary}</p> : null}
    </div>
  );
}
