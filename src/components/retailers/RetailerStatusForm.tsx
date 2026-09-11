"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";

import {
  updateRetailerSizingAction,
  updateRetailerStatusAction,
  type RetailerFormState,
} from "@/app/retailers/actions";
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

/** Strings, not numbers: these are form boxes, and an empty box is unknown. */
export interface RetailerSizingValues {
  approximateDoors: string;
  assumedSkus: string;
  unitsPerStoreWeek: string;
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
  sizing,
  cancelHref,
}: {
  retailerId: string;
  values: RetailerStatusValues;
  sizing: RetailerSizingValues;
  cancelHref: string;
}) {
  /* Bound to the account by the page, not by a form field: a request cannot
     point this write at a different record by adding one. */
  const [state, formAction, pending] = useActionState<RetailerFormState, FormData>(
    updateRetailerStatusAction.bind(null, retailerId),
    NO_STATE,
  );
  const errors = state.errors;

  /* A second, sibling form rather than three more boxes on the first one.
     Where an account stands and how big it could be are different acts, they
     are recorded by different people at different times, and each goes to its
     own narrowly scoped mutation — so a save of one cannot carry a stale value
     of the other. Sibling forms, never nested: that is invalid HTML. */
  const [sizingState, sizingAction, sizingPending] = useActionState<
    RetailerFormState,
    FormData
  >(updateRetailerSizingAction.bind(null, retailerId), NO_STATE);
  const sizingErrors = sizingState.errors;

  const number = (
    name: keyof RetailerSizingValues,
    inputMode: "numeric" | "decimal",
  ) => (
    <input
      id={name}
      name={name}
      type="text"
      inputMode={inputMode}
      defaultValue={sizing[name]}
      aria-invalid={sizingErrors[name] ? true : undefined}
      aria-describedby={sizingErrors[name] ? name + "-error" : undefined}
      className={CONTROL}
    />
  );

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
    <>
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

      {/* How big this account could be, if the range lists.

          Three figures and no fourth. They are the only inputs the Overview's
          opportunity map sizes a mark from — doors × SKUs × weekly units × 52
          — and the map places an account only once all three are recorded,
          which is why the write refuses a partial set. */}
      <form action={sizingAction} className="mt-14 lg:mt-16">
        {sizingErrors.form ? (
          <p
            role="alert"
            className="mb-8 border-l-2 border-red bg-red-tint px-4 py-3 text-sm leading-relaxed text-ink"
          >
            {sizingErrors.form}
          </p>
        ) : null}

        <section>
          <h2 className="font-display text-[1.0625rem] leading-tight tracking-[-0.005em] text-ink">
            How big it could be
          </h2>
          <p className="mt-2 max-w-[52ch] text-sm text-ink-muted">
            What this account would be worth in units if the range listed. All
            three are needed before it can be placed on the opportunity map, so
            they are entered together or left blank together.
          </p>
          <p className="mt-2 max-w-[52ch] text-[13px] leading-5 text-ink-faint">
            Illustrative planning assumptions for this demo.
          </p>

          <div className="mt-6 grid gap-x-12 gap-y-8 border-t border-rule pt-6 sm:grid-cols-2">
            <Field
              label="Approximate doors"
              htmlFor="approximateDoors"
              error={sizingErrors.approximateDoors}
              hint="Stores the range could reach. A whole number."
            >
              {number("approximateDoors", "numeric")}
            </Field>

            <Field
              label="Assumed SKUs"
              htmlFor="assumedSkus"
              error={sizingErrors.assumedSkus}
              hint="How many items we assume would list."
            >
              {number("assumedSkus", "numeric")}
            </Field>

            <Field
              label="Units per store / week"
              htmlFor="unitsPerStoreWeek"
              error={sizingErrors.unitsPerStoreWeek}
              hint="Assumed weekly rate of sale, per store."
            >
              {number("unitsPerStoreWeek", "decimal")}
            </Field>
          </div>
        </section>

        <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-rule pt-6 lg:mt-14">
          <button
            type="submit"
            disabled={sizingPending}
            className={cn(
              "bg-forest px-5 py-2.5 text-[13px] tracking-[0.02em] text-paper transition-opacity",
              sizingPending ? "opacity-60" : "hover:opacity-90",
            )}
          >
            {sizingPending ? "Saving…" : "Save sizing"}
          </button>

          {sizingState.saved ? (
            <p role="status" className="text-[13px] leading-5 text-forest">
              {"Saved · " + sizingState.saved.join(" · ")}
            </p>
          ) : null}
        </div>
      </form>
    </>
  );
}
