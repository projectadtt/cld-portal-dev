import {
  FilterMenu,
  type FilterOption,
} from "@/components/primitives/FilterMenu";
import type { BrokerId, OwnerId, RetailerId } from "@/data/types";
import {
  getActionOwners,
  getActionRetailers,
  type ActionFilter,
} from "@/lib/selectors";
import { ACTION_STATUSES } from "@/lib/status";
import type { ActionStatus } from "@/lib/status";

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * Anything unrecognised is dropped rather than 404ing or emptying the screen,
 * so a stale link or a hand-edited query still lands on a usable page.
 */
export function parseActionFilter(params: Params): ActionFilter {
  const owner = first(params.owner);
  const retailer = first(params.retailer);
  const status = first(params.status);

  return {
    ownerId: getActionOwners().some((b) => b.id === owner)
      ? (owner as BrokerId)
      : undefined,
    retailerId: getActionRetailers().some((r) => r.id === retailer)
      ? (retailer as RetailerId)
      : undefined,
    status: ACTION_STATUSES.some((s) => s === status)
      ? (status as ActionStatus)
      : undefined,
  };
}

/** Every control carries the other selections, so the filters combine. */
function buildHref(active: ActionFilter, patch: Partial<ActionFilter>): string {
  const next = { ...active, ...patch };
  const parts = [
    next.ownerId ? "owner=" + next.ownerId : "",
    next.retailerId ? "retailer=" + next.retailerId : "",
    next.status ? "status=" + encodeURIComponent(next.status) : "",
  ].filter(Boolean);

  return parts.length > 0 ? "/actions?" + parts.join("&") : "/actions";
}

const ALL = (label: string, href: string, selected: boolean): FilterOption => ({
  key: "all",
  label,
  href,
  selected,
});

/**
 * Filtering lives in the URL, the way it does on every other screen: the page
 * stays server-rendered, and a filtered book is linkable mid-meeting.
 *
 * Owner, account and status are the three cuts a client actually asks for.
 * Nothing here implies the list can be edited — every control is a link.
 */
export function ActionFilters({ active }: { active: ActionFilter }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <FilterMenu
        label="All owners"
        options={[
          ALL(
            "All owners",
            buildHref(active, { ownerId: undefined }),
            active.ownerId === undefined,
          ),
          ...getActionOwners().map((broker) => ({
            key: broker.id,
            label: broker.name,
            href: buildHref(active, { ownerId: broker.id as OwnerId }),
            selected: active.ownerId === broker.id,
          })),
        ]}
      />

      <FilterMenu
        label="All accounts"
        options={[
          ALL(
            "All accounts",
            buildHref(active, { retailerId: undefined }),
            active.retailerId === undefined,
          ),
          ...getActionRetailers().map((retailer) => ({
            key: retailer.id,
            label: retailer.name,
            href: buildHref(active, { retailerId: retailer.id }),
            selected: active.retailerId === retailer.id,
          })),
        ]}
      />

      <FilterMenu
        label="All statuses"
        options={[
          ALL(
            "All statuses",
            buildHref(active, { status: undefined }),
            active.status === undefined,
          ),
          ...ACTION_STATUSES.map((status) => ({
            key: status,
            label: status,
            href: buildHref(active, { status }),
            selected: active.status === status,
          })),
        ]}
      />
    </div>
  );
}
