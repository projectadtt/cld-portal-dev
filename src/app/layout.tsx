import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";

import { AppShell } from "@/components/layout/AppShell";
import { hasSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { loadWorkspace } from "@/lib/db/workspace";
import { getClient } from "@/lib/selectors";
import "./globals.css";

/* Fraunces — headlines and editorial moments (CLAUDE.md §5). */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

/* Instrument Sans — navigation, labels, tables, metadata, controls. */
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  /* The client's name is not something a visitor should be able to read off a
     browser tab without signing in. */
  if (!(await hasSession())) {
    return { title: "Sign in | Coffee, Lunch, Dinner" };
  }

  await loadWorkspace();
  const client = getClient();
  return {
    title: client
      ? client.name + " — " + client.workspace + " Workspace | Coffee, Lunch, Dinner"
      : "Coffee, Lunch, Dinner",
    description:
      "Retail growth client portal by Coffee, Lunch, Dinner.",
  };
}

/**
 * The one place the workspace is loaded.
 *
 * Awaiting here, above every route, is what lets the selector layer stay
 * synchronous: by the time any page or component runs, the snapshot is in
 * memory. If the database is unreachable this throws and the portal does not
 * render — deliberately, because a portal that quietly served stale or static
 * data would be worse than one that fails.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const signedIn = await hasSession();

  /**
   * Signed out, the only route that renders is the sign-in screen — middleware
   * has already turned every other path away — so it is drawn on its own, with
   * no navigation around it and no workspace loaded. The database is not
   * touched at all for a visitor who has not signed in.
   */
  if (!signedIn) {
    return (
      <html
        lang="en"
        className={cn(fraunces.variable, instrumentSans.variable, "h-full")}
      >
        <body className="min-h-full bg-paper font-sans text-ink">{children}</body>
      </html>
    );
  }

  await loadWorkspace();

  return (
    <html
      lang="en"
      className={cn(fraunces.variable, instrumentSans.variable, "h-full")}
    >
      <body className="min-h-full bg-paper font-sans text-ink">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
