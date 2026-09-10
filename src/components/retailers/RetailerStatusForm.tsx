"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";

import { updateRetailerStatusAction, type RetailerFormState } from "@/app/retailers/actions";
import { cn } from "@/lib/cn";
import { CURRENT_TARGET_VALUES, PIPELINE_STATUSES, STANDINGS } from "@/lib/status";

/**
 * Moving an account along the pipeline.
 *
 * Deliberately the three fields that change as a conversation progresses, and
 * nothing else. What an account *is* — its name, its channel, its logo, the
 * broker carrying it — does not change because a buyer replied, so none of it
 * is on this form. That is what keeps this edit safe: there is no field here
 * that can rename a record, break a unique constraint or disturb a logo.
 *
 * The pipeline list is the portal's own vocabulary rather than the lookup
 * table's. The table holds five further values the application has no way to
 * render, and a row carrying one would take every screen down — so they are
 * not offered, and the write layer refuses them as well.
 *
 * The same underlined controls as the create form, because this is the same
 * act continued rather than a different kind of screen.
 */

export interface RetailerStatusValues {
  currentTarget: string;
  pipelineStatus: string;
  standing: string;
}

const CONTROL =
  "w-full appearance-none rounded-none border-0 border-b border-rule bg-transparent " +
  "px-0 py-2 text-sm text-ink transition-colors focus:border-forest focus:outline-none " +
  "focus:ring-0";

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none' stroke='%239aa096' stroke-width='1.25'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E\")";

const NO_STATE: RetailerFormState = { errors: {}, saved: null, savedAt: 0 };

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

export function RetailerStatusForm({
  retailerId,
  values,
  cancelHref,
}: {
  retailerId: string;
  values: RetailerStatusValues;
  cancelHref: string;
}) {
  /* Bound to the account by the page, not by a form field: a request cannot
     point this write at a different record by adding one. */
  const [state, formAction, pending] = useActionState<RetailerFormState, FormData>(
    updateRetailerStatusAction.bind(null, retailerId),
    NO_STATE,
  );
  const errors = state.errors;

  const select = (
    name: keyof RetailerStatusValues,
    options: readonly string[],
  ) => (
    <select
      id={name}
      name={name}
      defaultValue={values[name]}
      aria-invalid={errors[name] ? true : undefined}
      aria-describedby={errors[name] ? name + "-error" : undefined}
      className={cn(CONTROL, "cursor-pointer bg-[right_0.1rem_center] bg-no-repeat pr-6")}
      style={{ backgroundImage: CHEVRON }}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );

  return (
    <form action={formAction} className="mt-10 lg:mt-12">
      {errors.form ? (
        <p
          role="alert"
          className="mb-8 border-l-2 border-red bg-red-tint px-4 py-3 text-sm leading-relaxed text-ink"
        >
          {errors.form}
        </p>
      ) : null}

      <section>
        <h2 className="font-display text-[1.0625rem] leading-tight tracking-[-0.005em] text-ink">
          Where it stands today
        </h2>
        <p className="mt-2 max-w-[52ch] text-sm text-ink-muted">
          The three things that move as the conversation does. Everything else
          about this account is edited elsewhere.
        </p>

        <div className="mt-6 grid gap-x-12 gap-y-8 border-t border-rule pt-6 sm:grid-cols-2">
          <Field
            label="Current / Target"
            htmlFor="currentTarget"
            error={errors.currentTarget}
            hint="Whether the range is already in this account."
          >
            {select("currentTarget", CURRENT_TARGET_VALUES)}
          </Field>

          <Field
            label="Pipeline status"
            htmlFor="pipelineStatus"
            error={errors.pipelineStatus}
            hint="How far the conversation has actually got."
          >
            {select("pipelineStatus", PIPELINE_STATUSES)}
          </Field>

          <Field
            label="Standing"
            htmlFor="standing"
            error={errors.standing}
            hint="Whether the account is being worked right now."
          >
            {select("standing", STANDINGS)}
          </Field>
        </div>
      </section>

      <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-rule pt-6 lg:mt-14">
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "bg-forest px-5 py-2.5 text-[13px] tracking-[0.02em] text-paper transition-opacity",
            pending ? "opacity-60" : "hover:opacity-90",
          )}
        >
          {pending ? "Saving…" : "Save status"}
        </button>

        <Link
          href={cancelHref}
          className="text-sm text-ink-muted transition-colors hover:text-forest"
        >
          Cancel
        </Link>

        {state.saved ? (
          <p role="status" className="text-[13px] leading-5 text-forest">
            {"Saved · " + state.saved.join(" · ")}
          </p>
        ) : null}
      </div>
    </form>
  );
}
