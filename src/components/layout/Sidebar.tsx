import Link from "next/link";

import { signOutAction } from "@/app/login/actions";
import { SidebarNav } from "@/components/layout/SidebarNav";
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
  /* min-h-screen rather than h-screen. At a fixed 100vh anything past the fold
     fell outside the box, and since the box is what paints the Forest, the
     client panel was rendering white-on-white below the green — which is why it
     read as cut off rather than as overflowing. A minimum lets the ground
     follow the content instead. */
  return (
    <aside className="bg-forest lg:sticky lg:top-0 lg:flex lg:min-h-screen lg:w-72 lg:shrink-0 lg:flex-col">
      {/* The wordmark is given room to fall onto two lines on the rail, where
          it reads as a masthead rather than as a cramped single line, and a
          rule closes it off from the navigation beneath. */}
      <div className="flex items-center justify-between gap-6 px-6 py-5 lg:block lg:shrink-0 lg:border-b lg:border-paper/15 lg:px-6 lg:pt-8 lg:pb-6">
        <Link href="/" className="block" aria-label="Coffee, Lunch, Dinner">
          {/* The commas stay Red — the one place the brand spends it on
              something that is not a warning. */}
          <span className="block font-display text-[17px] leading-none tracking-[-0.03em] whitespace-nowrap text-paper lg:text-[26px] lg:leading-[1.15] lg:whitespace-normal">
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

      {/* mt-auto holds the panel against the bottom of the rail on a screen
          tall enough to leave slack; shrink-0 stops it being compressed on one
          that is not. Between them the panel keeps its full height either way,
          which is the whole point of the exercise. */}
      <div className="mt-auto hidden shrink-0 px-4 pt-6 pb-6 lg:block">
        {/* Who you are looking at, drawn as a panel rather than as loose lines
            so it reads as one object and not as three stray labels at the
            bottom of the rail. The Red is gone from here: it was the only
            decorative Red in the portal, it fought the Forest at this size,
            and CLAUDE.md §4 wants that colour kept for attention. */}
        <div className="rounded-card border border-paper/15 bg-paper/5 px-4 py-4">
          {client ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="type-label text-paper/55">Client workspace</p>

                {/* The reference puts a status pill here. `clients` has no
                    status column, so there is no "Active" to report and
                    inventing one would be a claim nobody made. What the row
                    does record is whether the workspace holds illustrative
                    records, and that is worth a badge. */}
                {client.isDemo ? (
                  <span className="type-label shrink-0 rounded-full bg-forest-tint/15 px-2 py-0.5 text-forest-tint">
                    Demo
                  </span>
                ) : null}
              </div>

              <p className="mt-2 font-display text-lg leading-none text-paper">
                {client.name}
              </p>
              <p className="mt-1.5 text-[13px] leading-5 text-paper/65">
                {client.workspace}
              </p>
            </>
          ) : (
            <>
              <p className="type-label text-paper/55">Client workspace</p>
              <p className="mt-2 text-sm text-paper/70">Not set up yet</p>
            </>
          )}
        </div>

        {/* The long disclaimer used to sit here. The "Demo" badge on the panel
            above now carries that marker in the space of a word, which is what
            CLAUDE.md §8 is actually asking for — that illustrative records are
            never mistaken for a real client's book. The sentence is still
            printed beneath the content on small screens, where there is no
            panel to carry the badge. */}

        {/* A form rather than a link: signing out clears a cookie, and a
            thing that changes state should not sit behind a GET that a
            prefetch could fire on its own. */}
        <form action={signOutAction} className="mt-4 px-1">
          <button
            type="submit"
            className="type-label text-paper/55 transition-colors hover:text-paper"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
