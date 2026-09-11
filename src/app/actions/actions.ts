"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/session";
import { createAction, type FieldErrors } from "@/lib/db/mutations";

/**
 * The action write path's boundary, for work being written down for the first
 * time.
 *
 * Four fields cross it: the account, the owner, the wording and the date. The
 * client id is resolved server-side, and the status is not a field at all —
 * work nobody has started is Open. Both ids are verified against this client's
 * own records by the write layer rather than trusted from the form.
 *
 * Editing an action afterwards is `saveActionRecord` in `[actionId]/actions.ts`;
 * that path deliberately cannot change the wording or the account, and this one
 * deliberately cannot change an existing record.
 */

export interface ActionCreateState {
  errors: FieldErrors;
  saved: string[] | null;
  savedAt: number;
  /** The new action's id, so the form can offer a way straight to it. */
  id: string | null;
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export async function createActionAction(
  _previous: ActionCreateState,
  form: FormData,
): Promise<ActionCreateState> {
  /* Every server action is a POST endpoint in its own right, reachable
     whether or not a page ever rendered a form pointing at it. The proxy
     turns unauthenticated requests away at the perimeter; this is the check
     that still holds if the perimeter ever does not. */
  await requireSession();

  const result = await createAction({
    retailerId: text(form, "retailerId"),
    ownerId: text(form, "ownerId"),
    label: text(form, "label"),
    due: text(form, "due"),
  });

  if (!result.ok || !result.id) {
    return {
      errors: result.errors,
      saved: null,
      savedAt: _previous.savedAt,
      id: null,
    };
  }

  /* One action is read by more of the portal than almost any other record: the
     Overview's next moves, the account's next steps, the Actions screen and its
     summary, the broker scorecard, product performance, meeting follow-through
     and both reports. The whole tree is revalidated rather than a guessed
     subset.

     No redirect, unlike the meeting and retailer create paths. Someone writing
     down what has to happen next is usually writing down more than one, so the
     form stays put and reports what it filed. */
  revalidatePath("/", "layout");

  return { errors: {}, saved: result.changed, savedAt: Date.now(), id: result.id };
}
