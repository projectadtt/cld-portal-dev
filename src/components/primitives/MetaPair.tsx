import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface MetaPairProps {
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * A quiet label over a value. The portal's standard way of presenting
 * metadata so secondary information stays secondary (CLAUDE.md §13).
 */
export function MetaPair({ label, children, className }: MetaPairProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="type-label">{label}</p>
      <div className="mt-1.5 text-sm text-ink">{children}</div>
    </div>
  );
}
