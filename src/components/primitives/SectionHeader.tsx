import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface SectionHeaderProps {
  /** Major section heading — set in Fraunces (CLAUDE.md §5). */
  title: string;
  description?: string;
  /** Optional trailing control, typically a "view all" link. */
  action?: ReactNode;
  /**
   * Slightly larger title, for the handful of sections that carry the page.
   * Defaults off so every existing caller is unchanged.
   */
  lead?: boolean;
}

/**
 * Opens a section with a hairline rule beneath — the layout device that
 * replaces cards throughout the portal.
 */
export function SectionHeader({
  title,
  description,
  action,
  lead = false,
}: SectionHeaderProps) {
  return (
    <div className="mb-6 border-b border-rule pb-3">
      <div className="flex items-baseline justify-between gap-6">
        <h2
          className={cn(
            "font-display leading-tight tracking-[-0.005em] text-ink",
            lead ? "text-[1.25rem]" : "text-[1.0625rem]",
          )}
        >
          {title}
        </h2>
        {action ? <div className="shrink-0 text-sm">{action}</div> : null}
      </div>

      {description ? (
        <p className="mt-2 max-w-[52ch] text-sm text-ink-muted">{description}</p>
      ) : null}
    </div>
  );
}
