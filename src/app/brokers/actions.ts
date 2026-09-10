"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import {
  createBroker,
  setEntityImage,
  type FieldErrors,
} from "@/lib/db/mutations";
import { readImageIntent } from "@/lib/storage/intent";

/**
 * The broker write path's boundary.
 *
 * The same shape as the product path, deliberately: read the form, hand a
 * plain draft to the write layer, and let that layer decide what is valid.
 * No client id crosses this boundary — the workspace is resolved server-side,
 * so a broker cannot be filed under a client the person entering them does
 * not have open.
 */

export interface BrokerFormState {
  errors: FieldErrors;
  saved: string[] | null;
  savedAt: number;
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export async function createBrokerAction(
  _previous: BrokerFormState,
  form: FormData,
): Promise<BrokerFormState> {
  /* Every server action is a POST endpoint in its own right, reachable
     whether or not a page ever rendered a form pointing at it. The proxy
     turns unauthenticated requests away at the perimeter; this is the check
     that still holds if the perimeter ever does not. */
  await requireSession();

  /* Before the record, because a picture that is not a picture should not cost
     someone the rest of the form they just filled in. */
  const image = await readImageIntent(form);
  if ("error" in image) {
    return { errors: { image: image.error }, saved: null, savedAt: _previous.savedAt };
  }

  const result = await createBroker({
    name: text(form, "name"),
    shortName: text(form, "shortName"),
    role: text(form, "role"),
    coverage: text(form, "coverage"),
    initials: text(form, "initials"),
    email: text(form, "email"),
    phone: text(form, "phone"),
  });

  if (!result.ok || !result.id) {
    return { errors: result.errors, saved: null, savedAt: _previous.savedAt };
  }

  /* The broker exists at this point. A new record with no file chosen carries
     the "keep" intent, which writes nothing and reports nothing — an absent
     picture is a blank column, not a failure. If a chosen picture cannot be
     stored, that is what gets reported, and not a failure of the whole save,
     which did happen. */
  const attached = await setEntityImage("broker", result.id, image.intent);
  if (attached.error) {
    revalidatePath("/", "layout");
    return {
      errors: { image: attached.error + " The broker itself was saved." },
      saved: null,
      savedAt: Date.now(),
    };
  }

  /* A new broker changes coverage counts, the accountability table and every
     screen that names an owner, so the whole tree is revalidated. */
  revalidatePath("/", "layout");

  redirect("/brokers/" + result.id);
}
