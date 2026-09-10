import { CheckCircle2 } from "lucide-react";

import { EmptyState } from "@/components/primitives/EmptyState";
import { ActionItem } from "@/components/shared/ActionItem";
import type { Action } from "@/data/types";

interface ActionListProps {
  actions: Action[];
  emptyMessage?: string;
}

/** A plain list of actions. Reused wherever actions are shown. */
export function ActionList({
  actions,
  emptyMessage = "No open actions.",
}: ActionListProps) {
  if (actions.length === 0) {
    return <EmptyState icon={CheckCircle2} message={emptyMessage} />;
  }

  return (
    <ul>
      {actions.map((action) => (
        <ActionItem key={action.id} action={action} />
      ))}
    </ul>
  );
}
