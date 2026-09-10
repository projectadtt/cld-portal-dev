"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/session";
import { saveWorkstreamItem, type FieldErrors } from "@/lib/db/mutations";

/**
 * The one server action in the portal.
 *
 * It is the whole boundary between the browser and the write layer: the form
 * posts here, this reads the fields, and `saveWorkstreamItem` does the rest
 * inside a transaction. No SQL, no connection string and no database module
 * reaches the client bundle — the form imports this function and nothing else.
 */

export interface ItemFormState {
  errors: FieldErrors;
  /** What actually changed, for the confirmation line. Null before a save. */
  saved: string[] | null;
  /** Bumped on every successful save, so the form can clear its new-feedback fields. */
  savedAt: number;
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export async function saveItem(
  itemId: string,
  retailerId: string,
  _previous: ItemFormState,
  form: FormData,
): Promise<ItemFormState> {
  /* Every server action is a POST endpoint in its own right, reachable
     whether or not a page ever rendered a form pointing at it. Middleware
     turns unauthenticated requests away at the perimeter; this is the check
     that still holds if the perimeter ever does not. */
  await requireSession();

  const quote = text(form, "feedbackQuote");
  const theme = text(form, "feedbackTheme");
  const source = text(form, "feedbackSource");

  /* Feedback is recorded only when the buyer's own words are there. A theme
     or a source with nothing said is an incomplete entry, not a record — and
     it is refused rather than dropped, so nobody believes they saved it. */
  if (!quote && (theme || source)) {
    return {
      errors: { feedbackQuote: "Add what the buyer actually said, or clear these fields." },
      saved: null,
      savedAt: _previous.savedAt,
    };
  }

  const result = await saveWorkstreamItem(itemId, {
    itemStatus: text(form, "itemStatus"),
    sampleStatus: text(form, "sampleStatus"),
    nextAction: text(form, "nextAction"),
    nextActionDate: text(form, "nextActionDate"),
    action: form.has("actionStatus")
      ? { status: text(form, "actionStatus"), due: text(form, "actionDue") }
      : undefined,
    trackAsAction: form.get("trackAsAction") === "on",
    feedback: quote
      ? { quote, theme, source, occurredAt: text(form, "feedbackDate") }
      : undefined,
  });

  if (!result.ok) {
    return { errors: result.errors, saved: null, savedAt: _previous.savedAt };
  }

  /* The workspace snapshot is already dropped by the write layer; this is the
     other half. Next caches rendered routes, and this item shows up on the
     overview, the workstream, the account, the product and the action list —
     so the whole tree is revalidated rather than a guessed subset. */
  revalidatePath("/", "layout");
  revalidatePath("/retailers/" + retailerId);

  return { errors: {}, saved: result.changed, savedAt: Date.now() };
}
