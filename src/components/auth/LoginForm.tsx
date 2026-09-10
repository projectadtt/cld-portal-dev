"use client";

import { useActionState } from "react";

import { signInAction, type SignInState } from "@/app/login/actions";
import { cn } from "@/lib/cn";

const CONTROL =
  "w-full appearance-none rounded-none border-0 border-b border-rule bg-transparent " +
  "px-0 py-2 text-sm text-ink transition-colors focus:border-forest focus:outline-none " +
  "focus:ring-0";

const IDLE: SignInState = {};

/**
 * The only screen an unauthenticated visitor can reach.
 *
 * Nothing here decides anything. The passphrase is compared on the server and
 * the session cookie is set there; this component collects a string and
 * renders whatever the server says came back. Moving any part of that judgment
 * into the browser would make it advisory.
 */
export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(
    signInAction,
    IDLE,
  );

  return (
    <form action={formAction} className="mt-10">
      <input type="hidden" name="next" value={next} />

      {state.error ? (
        <p
          role="alert"
          className="mb-8 border-l-2 border-red bg-red-tint px-4 py-3 text-sm leading-relaxed text-ink"
        >
          {state.error}
        </p>
      ) : null}

      <label htmlFor="passphrase" className="type-label block">
        Passphrase
      </label>
      <div className="mt-1">
        <input
          id="passphrase"
          name="passphrase"
          type="password"
          autoComplete="current-password"
          autoFocus
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "passphrase-error" : undefined}
          className={CONTROL}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className={cn(
          "mt-10 w-full bg-forest px-5 py-3 text-[13px] tracking-[0.02em] text-paper transition-opacity",
          pending ? "opacity-60" : "hover:opacity-90",
        )}
      >
        {pending ? "Checking…" : "Enter the portal"}
      </button>
    </form>
  );
}
