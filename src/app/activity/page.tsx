import { PageHeader } from "@/components/layout/PageHeader";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";

import { getClient, getRecentActivity } from "@/lib/selectors";
import { loadWorkspace } from "@/lib/db/workspace";

/**
 * The full activity log, day-grouped. The Overview shows the last four; this
 * is where the rest lives, so that preview has somewhere to lead.
 */
export default async function ActivityPage() {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  const client = getClient();
  return (
    <>
      <PageHeader
        eyebrow={client ? client.name + " · " + client.workspace : undefined}
        title="Activity"
        description="Everything logged across the retail workstream, most recent first."
      />

      <ActivityTimeline activities={getRecentActivity()} />
    </>
  );
}
