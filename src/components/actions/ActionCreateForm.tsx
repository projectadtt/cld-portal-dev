"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";

import { createActionAction, type ActionCreateState } from "@/app/actions/actions";
import { cn } from "@/lib/cn";

/**
 * Writing down one piece of work.
 *
 * Four fields. Status is not one of them — work being written down for the
 * first time has not been started, so it is Open, and a status select here
 * would invite filing something as Done that nobody did. The product, the
 * workstream item and the meeting an action can hang off are absent for the
 * same reason a new meeting has no notes: they are not known yet, and asking
 * would be asking someone to invent them.
 *
 * Unlike the retailer and meeting create forms this one does not navigate away
 * on success. Someone listing what has to happen next is usually listing more
 * than one thing, so the form reports what it filed and offers the way on.
 *
 * The same underlined controls as every other form in the portal.
 */

const CONTROL =
  "w-full appearance-none rounded-none border-0 border-b border-rule bg-transparent " +
  "px-0 py-2 text-sm text-ink transition-colors focus:border-forest focus:outline-none " +
  "focus:ring-0";

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none' stroke='%239aa096' stroke-width='1.25'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E\")";

const NO_STATE: ActionCreateState = { errors: {}, saved: null, savedAt: 0, id: null };

/** One option in a scoped select: the id the form posts, the name a person reads. */
export interface Choice {
  id: string;
  name: string;
}

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

export function ActionCreateForm({
  retailers,
  owners,
  retailerId,
  today,
  cancelHref,
}: {
  /** Live accounts on this client's book, resolved on the server. */
  retailers: Choice[];
  /** Live brokers on this client's book, resolved on the server. */
  owners: Choice[];
  /** Pre-selected account, when the page was reached from one. */
  retailerId?: string;
  /** The portal's fixed today, so the date field opens somewhere sensible. */
  today: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<ActionCreateState, FormData>(
    createActionAction,
    NO_STATE,
  );
  const errors = state.errors;

  /* The confirmed state has to fall away the moment the form is edited again,
     or the button would stay spent and a second action could never be added.
     One handler on the form rather than four on the fields: change events from
     the selects and the inputs all bubble to here. The same comparison the
     meeting record's form makes, against the savedAt the result already
     carries — no effect, and no second copy of the values to keep in step. */
  const [editedAt, setEditedAt] = useState(0);
  const complete = state.saved !== null && editedAt <= state.savedAt;

  const select = (
    name: "retailerId" | "ownerId",
    options: Choice[],
    placeholder: string,
    defaultValue?: string,
  ) => (
    <select
      id={name}
      name={name}
      defaultValue={defaultValue ?? ""}
      aria-invalid={errors[name] ? true : undefined}
      aria-describedby={errors[name] ? name + "-error" : undefined}
      className={cn(CONTROL, "cursor-pointer bg-[right_0.1rem_center] bg-no-repeat pr-6")}
      style={{ backgroundImage: CHEVRON }}
    >
      {/* An empty first option rather than a silently pre-selected one: the
          first account on the list is not a default anybody chose. */}
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );

  return (
    <form
      action={formAction}
      onChange={() => setEditedAt(Date.now())}
      className="mt-10 lg:mt-12"
    >
      {errors.form ? (
        <p
          role="alert"
          className="mb-8 border-l-2 border-red bg-red-tint px-4 py-3 text-sm leading-relaxed text-ink"
        >
          {errors.form}
        </p>
      ) : null}

      <div className="max-w-2xl">
        <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              label="Action"
              htmlFor="label"
              error={errors.label}
              hint="What has to happen, as you would say it to the person doing it."
            >
              <input
                id="label"
                name="label"
                type="text"
                required
                maxLength={300}
                placeholder="Send the price list"
                aria-invalid={errors.label ? true : undefined}
                aria-describedby={errors.label ? "label-error" : undefined}
                className={CONTROL}
              />
            </Field>
          </div>

          <Field
            label="Account"
            htmlFor="retailerId"
            error={errors.retailerId}
            hint="The retail relationship this work is on."
          >
            {select("retailerId", retailers, "Pick an account", retailerId)}
          </Field>

          <Field
            label="Owner"
            htmlFor="ownerId"
            error={errors.ownerId}
            hint="The broker carrying it. Work with no owner is work nobody does."
          >
            {select("ownerId", owners, "Pick an owner")}
          </Field>

          <Field
            label="Due"
            htmlFor="due"
            error={errors.due}
            hint="When it has to be done by. A move with no date is not a next move."
          >
            <input
              id="due"
              name="due"
              type="date"
              required
              defaultValue={today}
              aria-invalid={errors.due ? true : undefined}
              aria-describedby={errors.due ? "due-error" : undefined}
              className={CONTROL}
            />
          </Field>

          {/* Shown, not chosen. Everything written down here is work nobody has
              started, so there is no status to pick. */}
          <div className="min-w-0">
            <p className="type-label">Status</p>
            <p className="mt-1 border-b border-rule py-2 text-sm text-ink">Open</p>
            <p className="mt-1.5 text-[13px] leading-5 text-ink-faint">
              Every new action starts here. Move it on from the action itself.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-rule pt-6 lg:mt-14">
        <button
          type="submit"
          disabled={pending || complete}
          className={cn(
            "inline-flex items-center gap-2 border px-5 py-2.5 text-[13px] tracking-[0.02em] transition-opacity",
            complete
              ? "cursor-default border-forest bg-forest-tint font-medium text-forest"
              : pending
                ? "border-forest bg-forest text-paper opacity-60"
                : "border-forest bg-forest text-paper hover:opacity-90",
          )}
        >
          {complete ? (
            <>
              <Check size={14} strokeWidth={2.25} aria-hidden="true" />
              Saved
            </>
          ) : pending ? (
            "Saving…"
          ) : (
            "Save action"
          )}
        </button>

        <Link
          href={cancelHref}
          className="text-sm text-ink-muted transition-colors hover:text-forest"
        >
          Back to actions
        </Link>

        {state.saved ? (
          <p role="status" className="text-[13px] leading-5 text-forest">
            {"Saved · " + state.saved.join(" · ")}
            {state.id ? (
              <>
                {" · "}
                <Link href={"/actions/" + state.id} className="underline">
                  Open it
                </Link>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    </form>
  );
}
