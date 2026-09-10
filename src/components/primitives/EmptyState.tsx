import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

interface EmptyStateProps {
  message: string;
  icon?: LucideIcon;
  className?: string;
}

/**
 * Nothing here yet. Deliberately quiet — an empty section is information,
 * not an error.
 */
export function EmptyState({ message, icon: Icon, className }: EmptyStateProps) {
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
