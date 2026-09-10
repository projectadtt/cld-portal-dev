import { PageHeader } from "@/components/layout/PageHeader";
import { BrokerFilter } from "@/components/workstream/BrokerFilter";
import { WorkstreamList } from "@/components/workstream/WorkstreamList";

import type { BrokerId } from "@/data/types";
import { getClient, getAllBrokers } from "@/lib/selectors";
import { loadWorkspace } from "@/lib/db/workspace";

/**
 * Only a known broker id filters the view. Anything else — a stale link, a
 * hand-edited query — falls back to all brokers rather than an empty screen.
 */
function toBrokerId(value: string | string[] | undefined): BrokerId | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return getAllBrokers().some((broker) => broker.id === candidate)
    ? (candidate as BrokerId)
    : undefined;
}

/**
 * SCREEN 2 — Retail Workstream.
 *
 * The operational map: who is working which account, where it stands, and
 * what happens next. Item-level work lives on the retailer detail page.
 */
export default async function WorkstreamPage({
  searchParams,
}: PageProps<"/workstream">) {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  const client = getClient();
  const activeBroker = toBrokerId((await searchParams).broker);

  return (
    <>
      <PageHeader
        eyebrow={client ? client.name + " · " + client.workspace : undefined}
        title="Retail Workstream"
        description="Who is working which retail account, where each account stands, and what needs to happen next."
      />

      <div className="border-y border-rule py-5">
        <BrokerFilter active={activeBroker} />
      </div>

      <div className="mt-12 lg:mt-14">
        <WorkstreamList brokerId={activeBroker} />
      </div>
    </>
  );
}
