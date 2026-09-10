"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";

import {
  createMeetingAction,
  type MeetingCreateState,
} from "@/app/retailers/[retailerId]/meetings/actions";
import { cn } from "@/lib/cn";
import { MEETING_CREATE_STATUSES } from "@/lib/status";

/**
 * Putting one meeting on the book.
 *
 * Four fields, and one of them is optional. What was said, what was decided
 * and who was in the room are all absent on purpose: a meeting being booked
 * has none of that yet, and a meeting being written up gets it through the
 * record itself. Asking for it here would be asking someone to invent it.
 *
 * The broker is shown, not chosen. A meeting on an account is run by whoever
 * carries that account, so it is inherited from the account rather than
 * offered as a relationship this form can set — and where nobody carries the
 * account, it says so in the portal's one word for that.
 *
 * The same underlined controls as every other form in the portal.
 */

const CONTROL =
  "w-full appearance-none rounded-none border-0 border-b border-rule bg-transparent " +
  "px-0 py-2 text-sm text-ink transition-colors focus:border-forest focus:outline-none " +
  "focus:ring-0";

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none' stroke='%239aa096' stroke-width='1.25'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E\")";

const NO_STATE: MeetingCreateState = { errors: {}, saved: null, savedAt: 0 };

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

export function MeetingCreateForm({
  retailerId,
  retailerName,
  /** Already resolved to the account's broker, or the word for having none. */
  brokerLabel,
  today,
  cancelHref,
}: {
  retailerId: string;
  retailerName: string;
  brokerLabel: string;
  /** The portal's fixed today, so the date field opens somewhere sensible. */
  today: string;
  cancelHref: string;
}) {
  /* Bound to the account by the page, not by a form field: a request cannot
     point this write at a different account by adding one. */
  const [state, formAction, pending] = useActionState<MeetingCreateState, FormData>(
    createMeetingAction.bind(null, retailerId),
    NO_STATE,
  );
  const errors = state.errors;

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

      <div className="max-w-2xl">
        <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              label="Meeting"
              htmlFor="title"
              error={errors.title}
              hint="What this conversation is called, as you would say it aloud."
            >
              <input
                id="title"
                name="title"
                type="text"
                required
                maxLength={160}
                placeholder="Range review"
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={errors.title ? "title-error" : undefined}
                className={CONTROL}
              />
            </Field>
          </div>

          <Field
            label="Day"
            htmlFor="scheduledOn"
            error={errors.scheduledOn}
            hint="The date it is booked for, or the date it happened."
          >
            <input
              id="scheduledOn"
              name="scheduledOn"
              type="date"
              required
              defaultValue={today}
              aria-invalid={errors.scheduledOn ? true : undefined}
              aria-describedby={errors.scheduledOn ? "scheduledOn-error" : undefined}
              className={CONTROL}
            />
          </Field>

          <Field
            label="Time"
            htmlFor="scheduledTime"
            error={errors.scheduledTime}
            hint="Optional. Leave it empty if only the day is agreed."
          >
            <input
              id="scheduledTime"
              name="scheduledTime"
              type="time"
              aria-invalid={errors.scheduledTime ? true : undefined}
              aria-describedby={
                errors.scheduledTime ? "scheduledTime-error" : undefined
              }
              className={CONTROL}
            />
          </Field>

          <Field
            label="Status"
            htmlFor="status"
            error={errors.status}
            hint="Still to come, or being written up after the fact."
          >
            <select
              id="status"
              name="status"
              defaultValue="Scheduled"
              aria-invalid={errors.status ? true : undefined}
              aria-describedby={errors.status ? "status-error" : undefined}
              className={cn(
                CONTROL,
                "cursor-pointer bg-[right_0.1rem_center] bg-no-repeat pr-6",
              )}
              style={{ backgroundImage: CHEVRON }}
            >
              {MEETING_CREATE_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          {/* Shown, not editable. Whoever carries the account runs its
              meetings, so this is a fact about the account rather than a
              choice this form gets to make. */}
          <div className="min-w-0">
            <p className="type-label">Broker</p>
            <p className="mt-1 border-b border-rule py-2 text-sm text-ink">
              {brokerLabel}
            </p>
            <p className="mt-1.5 text-[13px] leading-5 text-ink-faint">
              {"Inherited from " + retailerName + "."}
            </p>
          </div>
        </div>
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
          {pending ? "Saving…" : "Save meeting"}
        </button>

        <Link
          href={cancelHref}
          className="text-sm text-ink-muted transition-colors hover:text-forest"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
