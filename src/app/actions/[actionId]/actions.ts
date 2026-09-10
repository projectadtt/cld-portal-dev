"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/session";
import { saveAction, type FieldErrors } from "@/lib/db/mutations";

/**
 * The action workspace's server action.
 *
 * Three fields cross this boundary — status, due, owner — and nothing else.
 * The retailer, the product and the workstream item are not read from the
 * form at all, so no crafted request can move a piece of work onto another
 * account: the write layer has nowhere to put such a value.
 */

export interface ActionFormState {
  errors: FieldErrors;
  /** What actually changed, for the confirmation line. Null before a save. */
  saved: string[] | null;
  savedAt: number;
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export async function saveActionRecord(
  actionId: string,
  _previous: ActionFormState,
  form: FormData,
): Promise<ActionFormState> {
  /* Every server action is a POST endpoint in its own right, reachable
     whether or not a page ever rendered a form pointing at it. Middleware
     turns unauthenticated requests away at the perimeter; this is the check
     that still holds if the perimeter ever does not. */
  await requireSession();

  const result = await saveAction(actionId, {
    status: text(form, "status"),
    due: text(form, "due"),
    ownerId: text(form, "ownerId"),
  });

  if (!result.ok) {
    return { errors: result.errors, saved: null, savedAt: _previous.savedAt };
  }

  /* An action shows up on the overview, the account, the product, the broker
     and the workstream as well as here, so the whole tree is revalidated
     rather than a guessed subset. The workspace snapshot itself was already
     dropped by the write layer, before this line ran. */
  revalidatePath("/", "layout");

  return { errors: {}, saved: result.changed, savedAt: Date.now() };
}
