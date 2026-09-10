import type { ReactNode } from "react";

import { Sidebar } from "@/components/layout/Sidebar";
import { DEMO_DISCLAIMER } from "@/lib/demo";
import { getClient } from "@/lib/selectors";

/**
 * The frame every screen sits in: persistent navigation on the left, primary
 * content centred in a generous measure (project_specs.md §24).
 *
 * The content column is capped rather than filling the viewport — spec §24
 * asks for whitespace, not for every pixel to be used.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="lg:flex lg:items-start">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-5xl px-6 py-10 sm:px-8 lg:px-14 lg:py-16">
          {children}
        </div>

        {/* The sidebar footer carries this on desktop, and only a workspace
            holding illustrative records carries it at all. */}
        {getClient()?.isDemo ? (
          <p className="type-label border-t border-rule px-6 py-6 sm:px-8 lg:hidden">
            {DEMO_DISCLAIMER}
          </p>
        ) : null}
      </main>
    </div>
  );
}
