import Link from "next/link";

import { signOutAction } from "@/app/login/actions";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { DEMO_DISCLAIMER } from "@/lib/demo";
import { getClient } from "@/lib/selectors";

/**
 * Persistent left navigation (project_specs.md §24/§25).
 *
 * Desktop: a full-height column pinned beside the content.
 * Below lg: collapses into a top bar with the nav scrolling horizontally.
 *
 * Server-rendered; only the nav itself needs the client boundary.
 */
export function Sidebar() {
  const client = getClient();
  return (
    <aside className="border-b border-rule bg-paper lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[264px] lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between gap-6 px-6 py-5 lg:block lg:px-8 lg:pt-8 lg:pb-0">
        <Link href="/" className="block" aria-label="Coffee, Lunch, Dinner">
          <span className="block font-display text-[17px] leading-none tracking-[-0.03em] whitespace-nowrap text-forest lg:text-[20px]">
            Coffee<span className="text-red">,</span> Lunch
            <span className="text-red">,</span> Dinner
          </span>
        </Link>

        {/* Compact client context for the collapsed bar */}
        {client ? (
          <p className="text-right text-sm text-ink-muted lg:hidden">
            <span className="font-display text-base text-ink">{client.name}</span>
            <span className="type-label block">{client.workspace}</span>
          </p>
        ) : null}
      </div>

      <SidebarNav />

      <div className="mt-auto hidden border-t border-rule px-8 py-7 lg:block">
        {client ? (
          <>
            <p className="type-label">Client</p>
            <p className="mt-1.5 font-display text-lg leading-none text-ink">
              {client.name}
            </p>

            <p className="type-label mt-5">Workspace</p>
            <p className="mt-1.5 text-sm text-ink-muted">{client.workspace}</p>

            {/* The disclaimer belongs to workspaces that hold illustrative
                records. Printing it over a real client's book would be a lie
                in the other direction. */}
            {client.isDemo ? (
              <p className="mt-7 border-t border-rule-soft pt-4 text-[11px] leading-4 text-ink-faint">
                {DEMO_DISCLAIMER}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="type-label">Workspace</p>
            <p className="mt-1.5 text-sm text-ink-muted">Not set up yet</p>
          </>
        )}

        {/* A form rather than a link: signing out clears a cookie, and a
            thing that changes state should not sit behind a GET that a
            prefetch could fire on its own. */}
        <form action={signOutAction} className="mt-7 border-t border-rule-soft pt-4">
          <button
            type="submit"
            className="type-label transition-colors hover:text-ink"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
