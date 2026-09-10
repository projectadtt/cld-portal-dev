import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/LoginForm";
import { authIsConfigured } from "@/lib/auth/token";

export const metadata: Metadata = {
  title: "Sign in | Coffee, Lunch, Dinner",
};

/**
 * The sign-in screen.
 *
 * Says nothing about the client, the workspace or what is inside — an
 * unauthenticated visitor learns only that this is a CLD portal and that it is
 * closed. The root layout renders this one page without the navigation shell,
 * and without loading the workspace, so no query runs for a visitor who has
 * not signed in.
 */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const requested = (await searchParams).next;
  const next = typeof requested === "string" ? requested : "/";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <p className="type-label">Coffee, Lunch, Dinner</p>

      <h1 className="mt-3 font-display text-[2rem] leading-[1.1] tracking-[-0.015em] text-ink">
        Client portal
      </h1>

      <p className="mt-4 max-w-[46ch] text-sm leading-relaxed text-ink-muted">
        This workspace is private. Enter the passphrase CLD gave you to
        continue.
      </p>

      <LoginForm next={next} />

      {authIsConfigured() ? null : (
        <p className="mt-8 border-t border-rule pt-6 text-[13px] leading-5 text-ink-faint">
          No passphrase is configured on this deployment, so nobody can sign in
          yet.
        </p>
      )}
    </main>
  );
}
