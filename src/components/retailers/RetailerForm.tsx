"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";

import { createRetailerAction, type RetailerFormState } from "@/app/retailers/actions";
import { ImageField } from "@/components/media/ImageField";
import { cn } from "@/lib/cn";
import {
  CURRENT_TARGET_VALUES,
  FIT_LEVELS,
  PIPELINE_STATUSES,
  PRIORITIES,
  STANDINGS,
  TIERS,
} from "@/lib/status";

/**
 * Entering a retail account.
 *
 * Three things are needed — the name, the short name every table shows, and
 * what kind of retailer it is. The status fields all carry the value a new
 * account genuinely starts at, so the form can be submitted without touching
 * any of them.
 *
 * The pipeline list is the portal's own vocabulary rather than the lookup
 * table's. The table holds five further values the application has no way to
 * render, and a row carrying one would take every screen down — so they are
 * not offered, and the write layer refuses them as well.
 */

export interface RetailerFormValues {
  name: string;
  shortName: string;
  channel: string;
  currentTarget: string;
  pipelineStatus: string;
  standing: string;
  assignedBrokerId: string;
  tier: string;
  priority: string;
  fit: string;
}

export const BLANK_RETAILER: RetailerFormValues = {
  name: "", shortName: "", channel: "",
  currentTarget: "Target",
  pipelineStatus: "Not reached out yet",
  standing: "Active",
  assignedBrokerId: "", tier: "", priority: "", fit: "",
};

const CONTROL =
  "w-full appearance-none rounded-none border-0 border-b border-rule bg-transparent " +
  "px-0 py-2 text-sm text-ink transition-colors focus:border-forest focus:outline-none " +
  "focus:ring-0";

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none' stroke='%239aa096' stroke-width='1.25'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E\")";

const NO_RETAILER_STATE: RetailerFormState = { errors: {}, saved: null, savedAt: 0 };

/** The brokers an account may be handed to, named for the select. */
export interface BrokerChoice {
  id: string;
  name: string;
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
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

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-[1.0625rem] leading-tight tracking-[-0.005em] text-ink">
        {title}
      </h2>
      <p className="mt-2 max-w-[52ch] text-sm text-ink-muted">{description}</p>
      <div className="mt-6 grid gap-x-12 gap-y-8 border-t border-rule pt-6 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

export function RetailerForm({
  values,
  brokers,
  submitLabel,
  cancelHref,
  imagePlaceholder,
}: {
  values: RetailerFormValues;
  /** Resolved on the server, so no component here reaches the data layer. */
  brokers: BrokerChoice[];
  submitLabel: string;
  cancelHref: string;
  /** The record's own no-image treatment, rendered on the server. */
  imagePlaceholder: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<RetailerFormState, FormData>(
    createRetailerAction,
    NO_RETAILER_STATE,
  );
  const errors = state.errors;

  const input = (
    name: keyof RetailerFormValues,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <input
      id={name}
      name={name}
      defaultValue={values[name]}
      aria-invalid={errors[name] ? true : undefined}
      aria-describedby={errors[name] ? name + "-error" : undefined}
      className={CONTROL}
      {...extra}
    />
  );

  const select = (
    name: keyof RetailerFormValues,
    options: readonly string[],
    /** Shown as the empty choice when the field may be left unanswered. */
    blank?: string,
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
      {blank ? <option value="">{blank}</option> : null}
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

      <div className="space-y-14 lg:space-y-16">
        <Section
          title="What the account is"
          description="The name on the record, the short one every table shows, and the kind of retailer it is."
        >
          <Field label="Name" htmlFor="name" error={errors.name}>
            {input("name", { type: "text", maxLength: 120, required: true })}
          </Field>

          <Field
            label="Short name"
            htmlFor="shortName"
            error={errors.shortName}
            hint="e.g. SM."
          >
            {input("shortName", { type: "text", maxLength: 40, required: true })}
          </Field>

          <Field
            label="Channel"
            htmlFor="channel"
            error={errors.channel}
            hint="e.g. Supermarket, Convenience, Club."
          >
            {input("channel", { type: "text", maxLength: 60, required: true })}
          </Field>

          <Field
            label="Assigned broker"
            htmlFor="assignedBrokerId"
            error={errors.assignedBrokerId}
            hint={
              brokers.length === 0
                ? "No brokers on the books yet. An account can be entered without one."
                : "Who is responsible for moving this account."
            }
          >
            <select
              id="assignedBrokerId"
              name="assignedBrokerId"
              defaultValue={values.assignedBrokerId}
              aria-invalid={errors.assignedBrokerId ? true : undefined}
              aria-describedby={errors.assignedBrokerId ? "assignedBrokerId-error" : undefined}
              className={cn(CONTROL, "cursor-pointer bg-[right_0.1rem_center] bg-no-repeat pr-6")}
              style={{ backgroundImage: CHEVRON }}
            >
              <option value="">Unassigned</option>
              {brokers.map((broker) => (
                <option key={broker.id} value={broker.id}>
                  {broker.name}
                </option>
              ))}
            </select>
          </Field>
        </Section>

        <Section
          title="Where it stands today"
          description="Each of these starts where a new account genuinely starts, so none of them has to be answered now."
        >
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
        </Section>

        <Section
          title="How CLD reads it"
          description="The judgement calls. All optional — leave any of them blank until there is a view worth recording."
        >
          <ImageField
            className="sm:col-span-2"
            label="Logo"
            hint="Optional. JPG, PNG or WEBP, up to 5 MB. Used wherever this account is named."
            error={errors.image}
            currentUrl={null}
            placeholder={imagePlaceholder}
          />

          <Field label="Tier" htmlFor="tier" error={errors.tier}>
            {select("tier", TIERS, "Not set")}
          </Field>

          <Field label="Priority" htmlFor="priority" error={errors.priority}>
            {select("priority", PRIORITIES, "Not set")}
          </Field>

          <Field
            label="Fit"
            htmlFor="fit"
            error={errors.fit}
            hint="How well the range suits this account."
          >
            {select("fit", FIT_LEVELS, "Not set")}
          </Field>
        </Section>
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-rule pt-6 lg:mt-14">
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "bg-forest px-5 py-2.5 text-[13px] tracking-[0.02em] text-paper transition-opacity",
            pending ? "opacity-60" : "hover:opacity-90",
          )}
        >
          {pending ? "Saving…" : submitLabel}
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
