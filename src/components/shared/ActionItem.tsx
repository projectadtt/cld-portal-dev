import { AlertCircle } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/primitives/StatusBadge";
import type { Action } from "@/data/types";
import { cn } from "@/lib/cn";
import {
  formatDueDate,
  getOwnerName,
  getRetailerName,
  isActionOverdue,
} from "@/lib/selectors";
import { actionStatusTone } from "@/lib/status";

/**
 * One next action: what it is, who owns it, when it is due, where it stands.
 *
 * Overdue reuses the attention treatment already established on the
 * attention section — a red glyph and red due date. No new colour.
 */
export function ActionItem({ action }: { action: Action }) {
  const overdue = isActionOverdue(action);

  return (
    <li className="flex items-start justify-between gap-6 border-t border-rule-soft py-3.5 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <p className="text-sm leading-snug text-ink">{action.label}</p>
        <p className="type-label mt-1.5">
          {getOwnerName(action.ownerId) + " · "}
          <Link
            href={"/retailers/" + action.retailerId}
            className="transition-colors hover:text-forest"
          >
            {getRetailerName(action.retailerId)}
          </Link>
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={cn(
            "flex items-center justify-end gap-1.5 text-[13px] leading-5",
            overdue ? "font-medium text-red" : "text-ink",
          )}
        >
          {overdue ? (
            <AlertCircle size={13} strokeWidth={2} aria-hidden="true" />
          ) : null}
          {formatDueDate(action.due)}
        </p>
        <StatusBadge
          label={overdue ? "Overdue" : action.status}
          tone={overdue ? "attention" : actionStatusTone[action.status]}
          className="mt-1 justify-end"
        />
      </div>
    </li>
  );
}
