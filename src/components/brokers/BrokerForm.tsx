"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";

import { createBrokerAction, type BrokerFormState } from "@/app/brokers/actions";
import { ImageField } from "@/components/media/ImageField";
import { cn } from "@/lib/cn";

/**
 * Entering a broker.
 *
 * Two things are needed — what they are called and the short name every table
 * shows. Everything else is how CLD describes the desk, and can follow later.
 *
 * The same underlined controls, editorial headings and spacing as the product
 * form, so adding a person feels like part of the portal rather than a trip to
 * a back office.
 */

export interface BrokerFormValues {
  name: string;
  shortName: string;
  role: string;
  coverage: string;
  initials: string;
  email: string;
  phone: string;
}

export const BLANK_BROKER: BrokerFormValues = {
  name: "", shortName: "", role: "", coverage: "", initials: "", email: "", phone: "",
};

const CONTROL =
  "w-full appearance-none rounded-none border-0 border-b border-rule bg-transparent " +
  "px-0 py-2 text-sm text-ink transition-colors focus:border-forest focus:outline-none " +
  "focus:ring-0";

const NO_BROKER_STATE: BrokerFormState = { errors: {}, saved: null, savedAt: 0 };

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

export function BrokerForm({
  values,
  submitLabel,
  cancelHref,
  imagePlaceholder,
}: {
  values: BrokerFormValues;
  submitLabel: string;
  cancelHref: string;
  /** The record's own no-image treatment, rendered on the server. */
  imagePlaceholder: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<BrokerFormState, FormData>(
    createBrokerAction,
    NO_BROKER_STATE,
  );
  const errors = state.errors;

  const input = (
    name: keyof BrokerFormValues,
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
          title="Who they are"
          description="The name on the record and the short one every table, chip and owner column shows."
        >
          <Field label="Name" htmlFor="name" error={errors.name}>
            {input("name", { type: "text", maxLength: 120, required: true })}
          </Field>

          <Field
            label="Short name"
            htmlFor="shortName"
            error={errors.shortName}
            hint="e.g. Northstar."
          >
            {input("shortName", { type: "text", maxLength: 40, required: true })}
          </Field>

          <Field
            label="Initials"
            htmlFor="initials"
            error={errors.initials}
            hint="Two or three letters, for the portrait fallback."
          >
            {input("initials", { type: "text", maxLength: 4 })}
          </Field>

          <Field label="Role" htmlFor="role" hint="e.g. Retail brokerage.">
            {input("role", { type: "text", maxLength: 80 })}
          </Field>
        </Section>

        <Section
          title="How to reach them, and what they cover"
          description="All optional — a broker can be entered before any of this is settled."
        >
          <ImageField
            className="sm:col-span-2"
            label="Portrait"
            hint="Optional. JPG, PNG or WEBP, up to 5 MB. Used wherever this broker is named."
            error={errors.image}
            currentUrl={null}
            placeholder={imagePlaceholder}
            circle
          />

          <Field label="Coverage" htmlFor="coverage" hint="e.g. Philippines.">
            {input("coverage", { type: "text", maxLength: 120 })}
          </Field>

          <Field label="Email" htmlFor="email" error={errors.email}>
            {input("email", { type: "text", maxLength: 160, inputMode: "email" })}
          </Field>

          <Field label="Phone" htmlFor="phone">
            {input("phone", { type: "text", maxLength: 40 })}
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
