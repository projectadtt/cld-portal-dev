"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";

import {
  updateMeetingAction,
  type MeetingEditState,
} from "@/app/meetings/[meetingId]/actions";
import { cn } from "@/lib/cn";
import { MEETING_RECORD_STATUSES } from "@/lib/status";

/**
 * Writing up a meeting that already happened.
 *
 * Three fields, and they are the three that change after a conversation:
 * what was said, what it settled, and whether it has happened. What the
 * meeting *is* — the account, the broker, the day, the title — is shown as
 * context above this form and is not editable here. That is deliberate: the
 * record is a fact about a conversation that took place, and a form that can
 * rewrite which conversation it was is not an edit, it is a replacement.
 *
 * Notes are prose, so they get room. Decisions are a list, so they get a line
 * each — the simplest representation of a text[] that a person can read back
 * and correct without learning a syntax.
 *
 * The same underlined controls as every other form in the portal.
 */

const CONTROL =
  "w-full appearance-none rounded-none border-0 border-b border-rule bg-transparent " +
  "px-0 py-2 text-sm text-ink transition-colors focus:border-forest focus:outline-none " +
  "focus:ring-0";

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none' stroke='%239aa096' stroke-width='1.25'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E\")";

const NO_STATE: MeetingEditState = { errors: {}, saved: null, savedAt: 0 };

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

export interface MeetingEditValues {
  summary: string;
  /** Already joined to one decision per line by the page. */
  decisions: string;
  status: string;
}

export function MeetingEditForm({
  meetingId,
  values,
  cancelHref,
}: {
  meetingId: string;
  values: MeetingEditValues;
  cancelHref: string;
}) {
  /* Bound to the record by the page, not by a form field: a request cannot
     point this write at a different meeting by adding one. */
  const [state, formAction, pending] = useActionState<MeetingEditState, FormData>(
    updateMeetingAction.bind(null, meetingId),
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

      <div className="max-w-[62ch] space-y-10">
        <Field
          label="Meeting notes"
          htmlFor="summary"
          error={errors.summary}
          hint="What was actually said in the room. Leave it empty if there is nothing written up yet."
        >
          <textarea
            id="summary"
            name="summary"
            rows={8}
            maxLength={4000}
            defaultValue={values.summary}
            aria-invalid={errors.summary ? true : undefined}
            aria-describedby={errors.summary ? "summary-error" : undefined}
            className={cn(CONTROL, "resize-y leading-relaxed")}
          />
        </Field>

        <Field
          label="Decisions"
          htmlFor="decisions"
          error={errors.decisions}
          hint="One per line. These are what the meeting settled, not what happens next."
        >
          <textarea
            id="decisions"
            name="decisions"
            rows={5}
            defaultValue={values.decisions}
            aria-invalid={errors.decisions ? true : undefined}
            aria-describedby={errors.decisions ? "decisions-error" : undefined}
            className={cn(CONTROL, "resize-y leading-relaxed")}
          />
        </Field>

        <div className="max-w-xs">
          <Field
            label="Status"
            htmlFor="status"
            error={errors.status}
            hint="Marking it Completed moves it from Upcoming to the record of meetings held."
          >
            <select
              id="status"
              name="status"
              defaultValue={values.status}
              aria-invalid={errors.status ? true : undefined}
              aria-describedby={errors.status ? "status-error" : undefined}
              className={cn(
                CONTROL,
                "cursor-pointer bg-[right_0.1rem_center] bg-no-repeat pr-6",
              )}
              style={{ backgroundImage: CHEVRON }}
            >
              {MEETING_RECORD_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
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
          Back to the record
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
