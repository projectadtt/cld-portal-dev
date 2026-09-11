import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

interface EmptyStateProps {
  message: string;
  /** A second, quieter line: what the absence actually means. */
  detail?: string;
  icon?: LucideIcon;
  /**
   * Dashed panel rather than a bare line.
   *
   * Opt-in, so every existing caller is untouched. It is for a section whose
   * emptiness sits in a column beside sections that are full: a bare line of
   * grey text there reads as something that failed to load, while a drawn
   * panel reads as a considered answer. Dashed rather than solid because the
   * panel is a placeholder for content, not content itself.
   */
  boxed?: boolean;
  className?: string;
}

/**
 * Nothing here yet. Deliberately quiet — an empty section is information,
 * not an error.
 */
export function EmptyState({
  message,
  detail,
  icon: Icon,
  boxed = false,
  className,
}: EmptyStateProps) {
  if (boxed) {
    return (
      <div
        className={cn(
          "flex items-start gap-3.5 rounded-card border border-dashed border-rule px-5 py-6",
          className,
        )}
      >
        {Icon ? (
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-forest-tint"
          >
            <Icon size={16} strokeWidth={2} className="text-forest" />
          </span>
        ) : null}

        <div className="min-w-0">
          <p className="text-[15px] leading-snug text-ink">{message}</p>
          {detail ? (
            <p className="mt-1 text-[13px] leading-5 text-ink-muted">{detail}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <p
      className={cn(
        "flex items-center gap-2.5 py-6 text-sm text-ink-faint",
        className,
      )}
    >
      {Icon ? <Icon size={15} strokeWidth={1.75} aria-hidden="true" /> : null}
      {message}
    </p>
  );
}
