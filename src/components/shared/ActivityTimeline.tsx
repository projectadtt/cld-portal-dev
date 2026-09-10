import { Inbox } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/primitives/EmptyState";
import type { Activity } from "@/data/types";
import {
  getOwnerName,
  getRetailerName,
  groupActivityByDay,
} from "@/lib/selectors";

interface ActivityTimelineProps {
  activities: Activity[];
  /** Hide the retailer name where the surrounding context already names it. */
  showRetailer?: boolean;
  emptyMessage?: string;
}

/**
 * Day-grouped activity. The date sits in its own column on desktop so the
 * descriptions form a single readable column rather than a bulleted list.
 */
export function ActivityTimeline({
  activities,
  showRetailer = true,
  emptyMessage = "No activity recorded yet.",
}: ActivityTimelineProps) {
  if (activities.length === 0) {
    return <EmptyState icon={Inbox} message={emptyMessage} />;
  }

  const days = groupActivityByDay(activities);

  return (
    <div>
      {days.map((day) => (
        <div
          key={day.date}
          className="grid gap-2 border-t border-rule-soft py-4 first:border-t-0 first:pt-0 sm:grid-cols-[7.5rem_1fr] sm:gap-8"
        >
          <p className="type-label sm:pt-1">{day.label}</p>

          <ul className="space-y-3.5">
            {day.activities.map((activity) => (
              <li key={activity.id}>
                <p className="text-sm leading-snug text-ink">
                  {activity.description}
                </p>
                <p className="type-label mt-1.5">
                  {activity.type}
                  {showRetailer ? (
                    <>
                      {" · "}
                      <Link
                        href={"/retailers/" + activity.retailerId}
                        className="transition-colors hover:text-forest"
                      >
                        {getRetailerName(activity.retailerId)}
                      </Link>
                    </>
                  ) : null}
                  {" · " + getOwnerName(activity.personId)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
