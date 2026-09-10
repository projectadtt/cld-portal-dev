import { Search } from "lucide-react";

import {
  FilterMenu,
  type FilterOption,
} from "@/components/primitives/FilterMenu";
import type { BrokerId } from "@/data/types";
import {
  getAllBrokers,
  getRetailerChannels,
  type RetailerFilter,
} from "@/lib/selectors";
import { PIPELINE_PHASES, PRIORITIES } from "@/lib/status";
import type { PipelinePhaseId, Priority } from "@/lib/status";

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * Anything unrecognised is dropped rather than 404ing or emptying the screen,
 * so a stale link or a hand-edited query still lands on a usable page.
 */
export function parseRetailerFilter(params: Params): RetailerFilter {
  const broker = first(params.broker);
  const phase = first(params.phase);
  const priority = first(params.priority);
  const channel = first(params.channel);
  const query = first(params.q)?.slice(0, 80);

  return {
    brokerId: getAllBrokers().some((b) => b.id === broker)
      ? (broker as BrokerId)
      : undefined,
    phase: PIPELINE_PHASES.some((p) => p.id === phase)
      ? (phase as PipelinePhaseId)
      : undefined,
    priority: PRIORITIES.some((p) => p === priority)
      ? (priority as Priority)
      : undefined,
    channel: getRetailerChannels().includes(channel ?? "")
      ? channel
      : undefined,
    query: query ? query : undefined,
  };
}

/** Every control carries the other selections, so filters and search combine. */
function buildHref(
  active: RetailerFilter,
  patch: Partial<RetailerFilter>,
): string {
  const next = { ...active, ...patch };
  const parts = [
    next.brokerId ? "broker=" + next.brokerId : "",
    next.phase ? "phase=" + next.phase : "",
    next.priority ? "priority=" + next.priority : "",
    next.channel ? "channel=" + encodeURIComponent(next.channel) : "",
    next.query ? "q=" + encodeURIComponent(next.query) : "",
  ].filter(Boolean);

  return parts.length > 0 ? "/retailers?" + parts.join("&") : "/retailers";
}

const ALL = (label: string, href: string, selected: boolean): FilterOption => ({
  key: "all",
  label,
  href,
  selected,
});

/**
 * Filtering lives in the URL, the way it does on the workstream and products
 * screens. The page stays a server component, a filtered book is linkable
 * mid-meeting, and back/forward behaves.
 *
 * Search is a plain GET form for the same reason: it submits on Enter with no
 * JavaScript, and carries the open filters with it.
 */
export function RetailerFilters({ active }: { active: RetailerFilter }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <FilterMenu
        label="All stages"
        options={[
          ALL(
            "All stages",
            buildHref(active, { phase: undefined }),
            active.phase === undefined,
          ),
          ...PIPELINE_PHASES.map((phase) => ({
            key: phase.id,
            label: phase.label,
            href: buildHref(active, { phase: phase.id }),
            selected: active.phase === phase.id,
          })),
        ]}
      />

      <FilterMenu
        label="All brokers"
        options={[
          ALL(
            "All brokers",
            buildHref(active, { brokerId: undefined }),
            active.brokerId === undefined,
          ),
          ...getAllBrokers().map((broker) => ({
            key: broker.id,
            label: broker.name,
            href: buildHref(active, { brokerId: broker.id }),
            selected: active.brokerId === broker.id,
          })),
        ]}
      />

      <FilterMenu
        label="All channels"
        options={[
          ALL(
            "All channels",
            buildHref(active, { channel: undefined }),
            active.channel === undefined,
          ),
          ...getRetailerChannels().map((channel) => ({
            key: channel,
            label: channel,
            href: buildHref(active, { channel }),
            selected: active.channel === channel,
          })),
        ]}
      />

      <FilterMenu
        label="All priorities"
        options={[
          ALL(
            "All priorities",
            buildHref(active, { priority: undefined }),
            active.priority === undefined,
          ),
          ...PRIORITIES.map((priority) => ({
            key: priority,
            label: priority + " priority",
            href: buildHref(active, { priority }),
            selected: active.priority === priority,
          })),
        ]}
      />

      <form
        action="/retailers"
        method="get"
        className="flex min-w-[13rem] flex-1 items-center gap-2 rounded-sm border border-rule px-3 py-1.5 focus-within:border-ink-faint sm:max-w-xs sm:flex-none"
      >
        {/* The open filters ride along, so searching never silently clears the
            cut the client is already looking at. */}
        {active.phase ? (
          <input type="hidden" name="phase" value={active.phase} />
        ) : null}
        {active.brokerId ? (
          <input type="hidden" name="broker" value={active.brokerId} />
        ) : null}
        {active.channel ? (
          <input type="hidden" name="channel" value={active.channel} />
        ) : null}
        {active.priority ? (
          <input type="hidden" name="priority" value={active.priority} />
        ) : null}

        <Search
          size={14}
          strokeWidth={1.75}
          aria-hidden="true"
          className="shrink-0 text-ink-faint"
        />
        <input
          type="search"
          name="q"
          defaultValue={active.query ?? ""}
          placeholder="Search retailers…"
          aria-label="Search retailers"
          className="w-full bg-transparent text-[13px] leading-5 text-ink outline-none placeholder:text-ink-faint"
        />
      </form>
    </div>
  );
}
