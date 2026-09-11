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
 * The rail carries Forest as a surface rather than only as an accent. CLD's
 * primary brand colour was previously doing its work at 20px in a wordmark,
 * where #12372A is dark enough to read as ink rather than as green; filling the
 * rail is what makes it unmistakably the brand's own colour. The content column
 * stays on Paper, so the page is still mostly white space (CLAUDE.md §3) and
 * the one saturated area is the frame, not the work.
 *
 * Everything inside it therefore inverts: Paper text at graded opacities in
 * place of the ink scale, which keeps the same three-step hierarchy — primary,
 * secondary, quiet — without inventing colours for it.
 *
 * Server-rendered; only the nav itself needs the client boundary.
 */
export function Sidebar() {
  const client = getClient();
  return (
    <aside className="bg-forest lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[264px] lg:shrink-0 lg:flex-col">
      <div className="flex items-center justify-between gap-6 px-6 py-5 lg:block lg:px-8 lg:pt-8 lg:pb-0">
        <Link href="/" className="block" aria-label="Coffee, Lunch, Dinner">
          {/* The commas stay Red — the one place the brand spends it on
              something that is not a warning. */}
          <span className="block font-display text-[17px] leading-none tracking-[-0.03em] whitespace-nowrap text-paper lg:text-[20px]">
            Coffee<span className="text-red">,</span> Lunch
            <span className="text-red">,</span> Dinner
          </span>
        </Link>

        {/* Compact client context for the collapsed bar */}
        {client ? (
          <p className="text-right text-sm text-paper/70 lg:hidden">
            <span className="font-display text-base text-paper">{client.name}</span>
            <span className="type-label block text-paper/60">{client.workspace}</span>
          </p>
        ) : null}
      </div>

      <SidebarNav />

      <div className="mt-auto hidden border-t border-paper/15 px-8 py-7 lg:block">
        {client ? (
          <>
            {/* These two labels are set as the nav items are — 14px, sentence
                case, no tracking — rather than as the portal's small uppercase
                label, so the footer reads as part of the rail instead of as a
                caption under it. At 11px with 0.08em of tracking the Red read
                as thin and muddy against the Forest; the larger setting also
                gives it somewhere to be legible.

                The Red itself is a deliberate exception, made at the client's
                request to put a second brand colour on the rail beside the
                wordmark's commas. CLAUDE.md §4 otherwise keeps Red for
                attention, correction, blocker, decision and risk, and every
                other Red in the portal still means one of those. These two are
                fixed furniture rather than a state, so they cannot be read as
                a warning about the client — which is what makes the exception
                survivable. */}
            <p className="text-sm text-red">Client</p>
            <p className="mt-1.5 font-display text-lg leading-none text-paper">
              {client.name}
            </p>

            <p className="mt-5 text-sm text-red">Workspace</p>
            <p className="mt-1.5 text-sm text-paper/70">{client.workspace}</p>

            {/* The disclaimer belongs to workspaces that hold illustrative
                records. Printing it over a real client's book would be a lie
                in the other direction. */}
            {client.isDemo ? (
              <p className="mt-7 border-t border-paper/10 pt-4 text-[11px] leading-4 text-paper/60">
                {DEMO_DISCLAIMER}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-sm text-red">Workspace</p>
            <p className="mt-1.5 text-sm text-paper/70">Not set up yet</p>
          </>
        )}

        {/* A form rather than a link: signing out clears a cookie, and a
            thing that changes state should not sit behind a GET that a
            prefetch could fire on its own. */}
        <form action={signOutAction} className="mt-7 border-t border-paper/10 pt-4">
          <button
            type="submit"
            className="type-label text-paper/60 transition-colors hover:text-paper"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
