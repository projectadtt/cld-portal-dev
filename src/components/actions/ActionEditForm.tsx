"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";

import {
  saveActionRecord,
  type ActionFormState,
} from "@/app/actions/[actionId]/actions";
import { cn } from "@/lib/cn";
import { ACTION_STATUSES } from "@/lib/status";

/**
 * Working one action: where it stands, when it is due, whose it is.
 *
 * Three fields, on one line at desktop width. An action is edited in the
 * middle of a conversation about it, so the form is small enough to take in
 * at a glance and sits directly under the record it changes.
 *
 * What the form deliberately cannot change: the account, the product, the
 * item and the wording. Those are shown above it as context, and moving work
 * between accounts is a different operation from working it.
 */

export interface ActionEditFormProps {
  actionId: string;
  status: string;
  due: string;
  ownerId: string;
  /** This client's brokers. The list is built on the server, from the client's own book. */
  owners: { id: string; name: string }[];
  /** Where Cancel goes back to. */
  backHref: string;
}

const UNSAVED: ActionFormState = { errors: {}, saved: null, savedAt: 0 };

/* Underlined rather than boxed — the same controls as the item workspace. */
const CONTROL =
  "w-full appearance-none rounded-none border-0 border-b border-rule bg-transparent " +
  "px-0 py-2 text-sm text-ink transition-colors focus:border-forest focus:outline-none " +
  "focus:ring-0";

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none' stroke='%239aa096' stroke-width='1.25'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E\")";

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
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
      ) : null}
    </div>
  );
}

export function ActionEditForm(props: ActionEditFormProps) {
  const save = saveActionRecord.bind(null, props.actionId);
  const [state, formAction, pending] = useActionState<ActionFormState, FormData>(
    save,
    UNSAVED,
  );
  const { errors } = state;

  return (
    <form action={formAction} className="mt-8">
      {errors.form ? (
        <p
          role="alert"
          className="mb-8 border-l-2 border-red bg-red-tint px-4 py-3 text-sm leading-relaxed text-ink"
        >
          {errors.form}
        </p>
      ) : null}

      <div className="grid max-w-3xl gap-x-12 gap-y-8 border-t border-rule pt-6 sm:grid-cols-[9rem_9rem_13rem]">
        <Field label="Status" htmlFor="status" error={errors.status}>
          <select
            id="status"
            name="status"
            defaultValue={props.status}
            aria-invalid={errors.status ? true : undefined}
            aria-describedby={errors.status ? "status-error" : undefined}
            className={cn(CONTROL, "cursor-pointer bg-[right_0.1rem_center] bg-no-repeat pr-6")}
            style={{ backgroundImage: CHEVRON }}
          >
            {ACTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Due" htmlFor="due" error={errors.due}>
          <input
            id="due"
            name="due"
            type="date"
            defaultValue={props.due}
            aria-invalid={errors.due ? true : undefined}
            aria-describedby={errors.due ? "due-error" : undefined}
            className={CONTROL}
          />
        </Field>

        <Field label="Owner" htmlFor="ownerId" error={errors.ownerId}>
          <select
            id="ownerId"
            name="ownerId"
            defaultValue={props.ownerId}
            aria-invalid={errors.ownerId ? true : undefined}
            aria-describedby={errors.ownerId ? "ownerId-error" : undefined}
            className={cn(CONTROL, "cursor-pointer bg-[right_0.1rem_center] bg-no-repeat pr-6")}
            style={{ backgroundImage: CHEVRON }}
          >
            {props.owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <p className="mt-5 max-w-[60ch] text-[13px] leading-5 text-ink-faint">
        The account, the product and the item this action belongs to are fixed
        here. Reassigning work to a different account is a different decision,
        and it is not one this form can make by accident.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-rule pt-6">
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "bg-forest px-5 py-2.5 text-[13px] tracking-[0.02em] text-paper transition-opacity",
            pending ? "opacity-60" : "hover:opacity-90",
          )}
        >
          {pending ? "Saving…" : "Save"}
        </button>

        <Link
          href={props.backHref}
          className="text-sm text-ink-muted transition-colors hover:text-forest"
        >
          Cancel
        </Link>

        {state.saved ? (
          <p role="status" className="text-[13px] leading-5 text-forest">
            {state.saved.length === 0
              ? "Saved. Nothing had changed."
              : "Saved · " + state.saved.join(" · ")}
          </p>
        ) : null}
      </div>
    </form>
  );
}
