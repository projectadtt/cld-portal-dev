"use server";

import { redirect } from "next/navigation";

import { endSession, startSession } from "@/lib/auth/session";
import { authIsConfigured, passphraseMatches } from "@/lib/auth/token";

export interface SignInState {
  error?: string;
}

/**
 * Where to go after signing in.
 *
 * Anything that is not a single-slash path on this site becomes the Overview.
 * `//evil.example` and `https://evil.example` are both what this exists to
 * refuse: a sign-in page that forwards to whatever a query string names is a
 * phishing hop with the portal's own domain on it.
 */
function safeDestination(value: string): string {
  return /^\/(?!\/)/.test(value) ? value : "/";
}

export async function signInAction(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  if (!authIsConfigured()) {
    return {
      error:
        "This deployment has no passphrase configured, so nobody can sign in. " +
        "Set CLD_PORTAL_PASSWORD and CLD_SESSION_SECRET.",
    };
  }

  const passphrase = String(formData.get("passphrase") ?? "");
  if (!passphrase) return { error: "Enter the passphrase to continue." };

  if (!(await passphraseMatches(passphrase))) {
    /* A deliberate pause. It costs a person one moment and costs a script
       trying passphrases in a loop rather more than that. */
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { error: "That passphrase is not right." };
  }

  await startSession();
  redirect(safeDestination(String(formData.get("next") ?? "/")));
}

export async function signOutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}
