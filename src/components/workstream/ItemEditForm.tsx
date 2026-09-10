"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";

import {
  saveItem,
  type ItemFormState,
} from "@/app/retailers/[retailerId]/items/[itemId]/actions";
import { cn } from "@/lib/cn";
import {
  ACTION_STATUSES,
  FEEDBACK_SOURCES,
  ITEM_STATUSES,
  SAMPLE_STATUSES,
} from "@/lib/status";

/**
 * The portal's edit surface for one workstream item.
 *
 * A client component for one reason: a save has to be able to answer back —
 * with a validation message against the field that caused it, or with what
 * actually changed. Everything else is a plain form posting to a server
 * action, so the values never leave the server round trip and no database
 * module is reachable from here.
 *
 * Written to be used in a meeting, not filled in afterwards: the questions
 * are in the order they get asked. Where does this item stand, where is the
 * sample, what happens next, and what did the buyer actually say.
 */

export interface ItemEditFormProps {
  itemId: string;
  retailerId: string;
  itemStatus: string;
  sampleStatus: string;
  /** Both absent on a pairing nobody has planned a step for yet. */
  nextAction?: string;
  nextActionDate?: string;
  /** The action this item's work is tracked as, where one exists. */
  tracked?: { id: string; label: string; status: string; due: string; owner: string };
  /** Who a newly tracked action would go to. */
  owner: string;
  /** The portal's fixed today, used to date a new piece of feedback. */
  today: string;
}

/* The starting state lives here, not beside the action: a "use server"
   module may only export async functions, so a constant exported from there
   arrives as undefined. */
const UNSAVED: ItemFormState = { errors: {}, saved: null, savedAt: 0 };

/* -- controls ----------------------------------------------------------- */
/* Underlined rather than boxed: a form of eleven fields in boxes reads as an
   admin panel, which is the one thing this page must not become. */

const CONTROL =
  "w-full appearance-none rounded-none border-0 border-b border-rule bg-transparent " +
  "px-0 py-2 text-sm text-ink transition-colors focus:border-forest focus:outline-none " +
  "focus:ring-0";

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
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

function Choice({
  id,
  name,
  options,
  defaultValue,
  error,
}: {
  id: string;
  name: string;
  options: readonly string[];
  defaultValue: string;
  error?: string;
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? id + "-error" : undefined}
      className={cn(CONTROL, "cursor-pointer bg-[right_0.1rem_center] bg-no-repeat pr-6")}
      style={{
        /* A hairline chevron, inline so the page loads no image and the mark
           inherits the same rule colour as the underline it sits on. */
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none' stroke='%239aa096' stroke-width='1.25'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E\")",
      }}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

/* -- the form ----------------------------------------------------------- */

export function ItemEditForm(props: ItemEditFormProps) {
  const save = saveItem.bind(null, props.itemId, props.retailerId);
  const [state, formAction, pending] = useActionState<ItemFormState, FormData>(
    save,
    UNSAVED,
  );
  const { errors } = state;

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

      <div className="space-y-12 lg:space-y-14">
        {/* -- where it stands -------------------------------------------- */}
        <section>
          <h2 className="font-display text-[1.0625rem] leading-tight tracking-[-0.005em] text-ink">
            Where the item stands
          </h2>
          <p className="mt-2 max-w-[52ch] text-sm text-ink-muted">
            The item&rsquo;s own status, and where its sample sits. Sample state
            is kept on the sample record, so changing one never quietly rewrites
            the other.
          </p>

          <div className="mt-6 grid gap-x-12 gap-y-8 border-t border-rule pt-6 sm:grid-cols-2">
            <Field label="Item status" htmlFor="itemStatus" error={errors.itemStatus}>
              <Choice
                id="itemStatus"
                name="itemStatus"
                options={ITEM_STATUSES}
                defaultValue={props.itemStatus}
                error={errors.itemStatus}
              />
            </Field>

            <Field
              label="Sample"
              htmlFor="sampleStatus"
              error={errors.sampleStatus}
              hint="Choosing “Additional samples requested” opens a second round rather than overwriting the first."
            >
              <Choice
                id="sampleStatus"
                name="sampleStatus"
                options={SAMPLE_STATUSES}
                defaultValue={props.sampleStatus}
                error={errors.sampleStatus}
              />
            </Field>
          </div>
        </section>

        {/* -- what happens next ------------------------------------------ */}
        <section>
          <h2 className="font-display text-[1.0625rem] leading-tight tracking-[-0.005em] text-ink">
            What happens next
          </h2>
          <p className="mt-2 max-w-[52ch] text-sm text-ink-muted">
            The item&rsquo;s own next step. A tracked action is the same work
            written for the shared action list, with an owner and a date
            against it.
          </p>

          <div className="mt-6 grid gap-x-12 gap-y-8 border-t border-rule pt-6 sm:grid-cols-[1fr_10rem]">
            <Field label="Next step" htmlFor="nextAction" error={errors.nextAction}>
              <input
                id="nextAction"
                name="nextAction"
                type="text"
                maxLength={300}
                defaultValue={props.nextAction ?? ""}
                aria-invalid={errors.nextAction ? true : undefined}
                aria-describedby={errors.nextAction ? "nextAction-error" : undefined}
                className={CONTROL}
              />
            </Field>

            <Field label="By" htmlFor="nextActionDate" error={errors.nextActionDate}>
              <input
                id="nextActionDate"
                name="nextActionDate"
                type="date"
                defaultValue={props.nextActionDate ?? ""}
                aria-invalid={errors.nextActionDate ? true : undefined}
                aria-describedby={
                  errors.nextActionDate ? "nextActionDate-error" : undefined
                }
                className={CONTROL}
              />
            </Field>
          </div>

          {props.tracked ? (
            <div className="mt-8 border-l-2 border-rule pl-5">
              <p className="type-label">
                Tracked as {props.tracked.id} · {props.tracked.owner}
              </p>
              <p className="mt-1.5 max-w-[52ch] text-sm leading-normal text-ink">
                {props.tracked.label}
              </p>

              <div className="mt-5 grid max-w-md gap-x-12 gap-y-8 sm:grid-cols-[1fr_10rem]">
                <Field
                  label="Action status"
                  htmlFor="actionStatus"
                  error={errors.actionStatus}
                >
                  <Choice
                    id="actionStatus"
                    name="actionStatus"
                    options={ACTION_STATUSES}
                    defaultValue={props.tracked.status}
                    error={errors.actionStatus}
                  />
                </Field>

                <Field label="Due" htmlFor="actionDue" error={errors.actionDue}>
                  <input
                    id="actionDue"
                    name="actionDue"
                    type="date"
                    defaultValue={props.tracked.due}
                    aria-invalid={errors.actionDue ? true : undefined}
                    aria-describedby={errors.actionDue ? "actionDue-error" : undefined}
                    className={CONTROL}
                  />
                </Field>
              </div>

              <p className="mt-4 max-w-[52ch] text-[13px] leading-5 text-ink-faint">
                The action keeps its own wording. It is written for the shared
                action list and read by people who are not on this page.
              </p>
            </div>
          ) : (
            <div className="mt-8 border-l-2 border-rule pl-5">
              <label className="flex items-start gap-3 text-sm leading-normal text-ink">
                <input
                  type="checkbox"
                  name="trackAsAction"
                  className="mt-0.5 size-4 shrink-0 accent-[#12372a]"
                />
                <span>
                  Track this on the shared action list, owned by {props.owner}
                  <span className="mt-1 block text-[13px] text-ink-faint">
                    Creates one action from the next step above. Nothing is
                    created if this item already has one.
                  </span>
                </span>
              </label>
              {errors.trackAsAction ? (
                <p className="mt-2 text-[13px] leading-5 text-red">
                  {errors.trackAsAction}
                </p>
              ) : null}
            </div>
          )}
        </section>

        {/* -- what the buyer said ---------------------------------------- */}
        <section key={state.savedAt}>
          <h2 className="font-display text-[1.0625rem] leading-tight tracking-[-0.005em] text-ink">
            Record what the buyer said
          </h2>
          <p className="mt-2 max-w-[52ch] text-sm text-ink-muted">
            Added as a new record. Nothing already on the item is edited or
            replaced — a buyer saying something new does not unsay what they
            said before.
          </p>

          <div className="mt-6 space-y-8 border-t border-rule pt-6">
            <Field
              label="In their words"
              htmlFor="feedbackQuote"
              error={errors.feedbackQuote}
              hint="Leave empty if there is nothing new to record."
            >
              <textarea
                id="feedbackQuote"
                name="feedbackQuote"
                rows={3}
                maxLength={600}
                aria-invalid={errors.feedbackQuote ? true : undefined}
                aria-describedby={
                  errors.feedbackQuote ? "feedbackQuote-error" : undefined
                }
                className={cn(CONTROL, "resize-y leading-relaxed")}
              />
            </Field>

            <div className="grid gap-x-12 gap-y-8 sm:grid-cols-3">
              <Field label="Theme" htmlFor="feedbackTheme">
                <input
                  id="feedbackTheme"
                  name="feedbackTheme"
                  type="text"
                  maxLength={80}
                  className={CONTROL}
                />
              </Field>

              <Field label="Heard through" htmlFor="feedbackSource" error={errors.feedbackSource}>
                <select
                  id="feedbackSource"
                  name="feedbackSource"
                  defaultValue=""
                  aria-invalid={errors.feedbackSource ? true : undefined}
                  aria-describedby={
                    errors.feedbackSource ? "feedbackSource-error" : undefined
                  }
                  className={cn(CONTROL, "cursor-pointer")}
                >
                  <option value="">Choose one</option>
                  {FEEDBACK_SOURCES.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="When" htmlFor="feedbackDate" error={errors.feedbackDate}>
                <input
                  id="feedbackDate"
                  name="feedbackDate"
                  type="date"
                  defaultValue={props.today}
                  max={props.today}
                  aria-invalid={errors.feedbackDate ? true : undefined}
                  aria-describedby={errors.feedbackDate ? "feedbackDate-error" : undefined}
                  className={CONTROL}
                />
              </Field>
            </div>
          </div>
        </section>
      </div>

      {/* -- save ---------------------------------------------------------- */}
      <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-rule pt-6 lg:mt-14">
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
          href={"/retailers/" + props.retailerId}
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
