import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";

import { ActionCard } from "@/components/actions/ActionCard";
import {
  ActionFilters,
  parseActionFilter,
} from "@/components/actions/ActionFilters";
import { ActionSummary } from "@/components/actions/ActionSummary";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/primitives/EmptyState";
import { SectionHeader } from "@/components/primitives/SectionHeader";
import { SectionLink } from "@/components/primitives/SectionLink";
import { countActions, getActionGroups, pageTitle } from "@/lib/selectors";
import { loadWorkspace } from "@/lib/db/workspace";

export async function generateMetadata(): Promise<Metadata> {
  await loadWorkspace();
  return { title: pageTitle("Actions") };
}

/**
 * SCREEN 8 — Actions.
 *
 * The execution layer. Grouped by when the work lands rather than by status,
 * because the client's question here is "what has to happen next", and a
 * status column cannot answer that on its own.
 *
 * Every row is the same action record the Overview, retailer, product, broker
 * and meeting screens read. There is no second list of actions anywhere in
 * the portal, and nothing on this page mutates one — it is all navigation.
 */
export default async function ActionsPage({
  searchParams,
}: PageProps<"/actions">) {
  /* Next renders the layout and the page in parallel, so a page cannot
     rely on the layout's load having finished. Each one loads for itself;
     loadWorkspace is memoised, so this is not a second query. */
  await loadWorkspace();
  const filter = parseActionFilter(await searchParams);
  const groups = getActionGroups(filter);
  const shown = countActions(filter);
  const total = countActions();

  return (
    <>
      <PageHeader
        eyebrow="Actions"
        title="What needs to happen next."
        description="Open work across the retail relationships, with ownership and timing kept in view."
      >
        {/* PageHeader's own slot for a right-side action, the same place the
            Retailers screen puts its own. Filled, because writing down the
            next move is the one thing this screen is for besides reading. */}
        <SectionLink href="/actions/new" cta>Add an action</SectionLink>
      </PageHeader>

      <ActionSummary />

      <div className="mt-10 lg:mt-12">
        <ActionFilters active={filter} />
      </div>

      <div className="mt-12 space-y-12 lg:mt-14 lg:space-y-14">
        {groups.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            message={
              total === 0
                ? "No actions on the book yet. Work raised against an item or an account will appear here."
                : "No actions match this combination of filters."
            }
          />
        ) : (
          groups.map((group) => (
            <section key={group.id}>
              <SectionHeader
                title={group.label}
                description={group.description}
                action={
                  <p className="type-label">
                    {group.actions.length === 1
                      ? "1 action"
                      : group.actions.length + " actions"}
                  </p>
                }
              />
              <ul>
                {group.actions.map((row) => (
                  <ActionCard key={row.action.id} row={row} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      {/* A truthful count rather than pagination: ten actions fit on one page. */}
      <p className="type-label mt-12">
        {shown === total
          ? total + " actions on the book"
          : "Showing " + shown + " of " + total + " actions"}
      </p>
    </>
  );
}
