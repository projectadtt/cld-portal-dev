import { AlertCircle } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/primitives/StatusBadge";
import { cn } from "@/lib/cn";
import {
  formatDueDate,
  getOwnerName,
  getRetailerShortName,
  getSignalActions,
  isActionOverdue,
} from "@/lib/selectors";
import { actionStatusTone } from "@/lib/status";

/**
 * Insight to existing action, in one pass.
 *
 * Nothing here is created. Each row is open work already on the shared action
 * list at an account and product one of the reads above was drawn from,
 * matched by real keys rather than by wording.
 *
 * The leading column carries the rank of the read the action is serving, so
 * the bridge back to the section above is readable without repeating a single
 * heading — and an action carrying two reads appears once, not twice.
 */
export function SignalActions() {
  const rows = getSignalActions();

  return (
    /* Scrolls inside its own container so the page body never does. */
    <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[46rem] border-collapse text-left">
        <caption className="sr-only">
          Open actions already carrying each read forward
        </caption>

        <thead>
          <tr className="border-b border-rule">
            <th scope="col" className="type-label w-12 pb-2.5 pr-4 font-normal">
              Read
            </th>
            <th scope="col" className="type-label pb-2.5 pr-5 font-normal">
              Action
            </th>
            <th scope="col" className="type-label w-24 pb-2.5 pr-5 font-normal">
              Owner
            </th>
            <th scope="col" className="type-label w-28 pb-2.5 pr-5 font-normal">
              Account
            </th>
            <th scope="col" className="type-label w-24 pb-2.5 pr-5 font-normal">
              Due
            </th>
            <th scope="col" className="type-label w-24 pb-2.5 font-normal">
              Status
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map(({ action, reads }) => {
            const overdue = isActionOverdue(action);

            return (
              <tr
                key={action.id}
                className="border-b border-rule-soft align-top"
              >
                <td className="type-label py-3 pr-4 tabular-nums">
                  {reads.join(" · ")}
                </td>

                <th scope="row" className="py-3 pr-5 text-left font-normal">
                  <span className="text-sm leading-snug text-ink">
                    {action.label}
                  </span>
                </th>

                <td className="py-3 pr-5 text-[13px] leading-5 text-ink">
                  {getOwnerName(action.ownerId)}
                </td>

                <td className="py-3 pr-5 text-[13px] leading-5">
                  <Link
                    href={"/retailers/" + action.retailerId}
                    className="text-ink transition-colors hover:text-forest"
                  >
                    {getRetailerShortName(action.retailerId)}
                  </Link>
                </td>

                <td className="py-3 pr-5 text-[13px] leading-5">
                  <span
                    className={cn(
                      "flex items-center gap-1.5",
                      overdue ? "font-medium text-red" : "text-ink",
                    )}
                  >
                    {overdue ? (
                      <AlertCircle size={13} strokeWidth={2} aria-hidden="true" />
                    ) : null}
                    {formatDueDate(action.due)}
                  </span>
                </td>

                <td className="py-3 text-[13px] leading-5">
                  <StatusBadge
                    label={overdue ? "Overdue" : action.status}
                    tone={overdue ? "attention" : actionStatusTone[action.status]}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
