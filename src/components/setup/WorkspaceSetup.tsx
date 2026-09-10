"use client";

import { useActionState, type ReactNode } from "react";

import {
  createWorkspaceAction,
  type SetupFormState,
} from "@/app/setup/actions";
import { cn } from "@/lib/cn";

/**
 * What the portal shows when the database is empty.
 *
 * Not an error and not a warning — an empty portal is simply one that has not
 * been set up yet, and the first thing it asks for is who it is for. Every
 * other record in the system hangs off this one row, so it is the only thing
 * this screen can do.
 *
 * Written to be watched over someone's shoulder: the questions are in plain
 * language, and the page it produces appears the moment it is answered.
 */

const UNSAVED: SetupFormState = { errors: {}, done: false };

const CONTROL =
  "w-full appearance-none rounded-none border-0 border-b border-rule bg-transparent " +
  "px-0 py-2 text-sm text-ink transition-colors focus:border-forest focus:outline-none " +
  "focus:ring-0";

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="type-label block">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error ? (
        <p id={htmlFor + "-error"} className="mt-1.5 text-[13px] leading-5 text-red">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] leading-5 text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export function WorkspaceSetup() {
  const [state, formAction, pending] = useActionState<SetupFormState, FormData>(
    createWorkspaceAction,
    UNSAVED,
  );
  const { errors } = state;

  return (
    <div className="max-w-2xl">
      <p className="type-label">Coffee, Lunch, Dinner</p>

      <h1 className="mt-3 font-display text-[2.125rem] leading-[1.1] tracking-[-0.015em] text-ink sm:text-[2.5rem]">
        Set up the workspace.
      </h1>

      <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
        Nothing has been entered yet. Name the client this portal is for, and
        the rest of the workspace — brokers, retailers, products and the retail
        work between them — is built from here, one record at a time.
      </p>

      <form action={formAction} className="mt-10">
        {errors.form ? (
          <p
            role="alert"
            className="mb-8 border-l-2 border-red bg-red-tint px-4 py-3 text-sm leading-relaxed text-ink"
          >
            {errors.form}
          </p>
        ) : null}

        <div className="grid gap-x-12 gap-y-8 border-t border-rule pt-6 sm:grid-cols-2">
          <Field
            label="Client"
            htmlFor="name"
            error={errors.name}
            hint="The brand this workspace belongs to."
          >
            <input
              id="name"
              name="name"
              type="text"
              maxLength={120}
              required
              autoComplete="organization"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "name-error" : undefined}
              className={CONTROL}
            />
          </Field>

          <Field
            label="Workspace"
            htmlFor="workspace"
            error={errors.workspace}
            hint="The engagement, e.g. Retail Growth."
          >
            <input
              id="workspace"
              name="workspace"
              type="text"
              maxLength={80}
              required
              defaultValue="Retail Growth"
              aria-invalid={errors.workspace ? true : undefined}
              aria-describedby={errors.workspace ? "workspace-error" : undefined}
              className={CONTROL}
            />
          </Field>

          <Field
            label="Category"
            htmlFor="category"
            hint="Optional. How the range would be described on shelf."
          >
            <input id="category" name="category" type="text" maxLength={80} className={CONTROL} />
          </Field>

          <Field
            label="Tagline"
            htmlFor="tagline"
            hint="Optional. One line for the overview header."
          >
            <input id="tagline" name="tagline" type="text" maxLength={160} className={CONTROL} />
          </Field>
        </div>

        <label className="mt-8 flex max-w-[52ch] items-start gap-3 border-t border-rule pt-6 text-sm leading-normal text-ink">
          <input type="checkbox" name="isDemo" className="mt-0.5 size-4 shrink-0 accent-[#12372a]" />
          <span>
            These records will be illustrative
            <span className="mt-1 block text-[13px] text-ink-faint">
              Marks the workspace as a demonstration, so every screen carries a
              line saying so. Leave it unchecked for a real client book.
            </span>
          </span>
        </label>

        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-rule pt-6">
          <button
            type="submit"
            disabled={pending}
            className={cn(
              "bg-forest px-5 py-2.5 text-[13px] tracking-[0.02em] text-paper transition-opacity",
              pending ? "opacity-60" : "hover:opacity-90",
            )}
          >
            {pending ? "Creating…" : "Create workspace"}
          </button>

          <p className="text-[13px] leading-5 text-ink-faint">
            You can add products, brokers and retailers straight afterwards.
          </p>
        </div>
      </form>
    </div>
  );
}
