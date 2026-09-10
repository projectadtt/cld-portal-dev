"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import {
  createRetailer,
  setEntityImage,
  updateRetailerStatus,
  type FieldErrors,
} from "@/lib/db/mutations";
import { readImageIntent } from "@/lib/storage/intent";

/**
 * The retailer write path's boundary.
 *
 * Everything the browser can say about an account passes through here as form
 * fields and nothing else. The client id is resolved server-side; the assigned
 * broker is the one relationship a form may set, and the write layer checks it
 * against this client's own brokers before accepting it.
 */

export interface RetailerFormState {
  errors: FieldErrors;
  saved: string[] | null;
  savedAt: number;
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export async function createRetailerAction(
  _previous: RetailerFormState,
  form: FormData,
): Promise<RetailerFormState> {
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

  const result = await createRetailer({
    name: text(form, "name"),
    shortName: text(form, "shortName"),
    channel: text(form, "channel"),
    currentTarget: text(form, "currentTarget"),
    pipelineStatus: text(form, "pipelineStatus"),
    standing: text(form, "standing"),
    assignedBrokerId: text(form, "assignedBrokerId"),
    tier: text(form, "tier"),
    priority: text(form, "priority"),
    fit: text(form, "fit"),
  });

  if (!result.ok || !result.id) {
    return { errors: result.errors, saved: null, savedAt: _previous.savedAt };
  }

  /* The account exists at this point. A new record with no file chosen carries
     the "keep" intent, which writes nothing and reports nothing — an absent
     logo is a blank column, not a failure. If a chosen logo cannot be stored,
     that is what gets reported, and not a failure of the whole save, which did
     happen. */
  const attached = await setEntityImage("retailer", result.id, image.intent);
  if (attached.error) {
    revalidatePath("/", "layout");
    return {
      errors: { image: attached.error + " The account itself was saved." },
      saved: null,
      savedAt: Date.now(),
    };
  }

  /* A new account changes the pipeline counts, the broker scorecard and every
     screen that counts retailers, so the whole tree is revalidated. */
  revalidatePath("/", "layout");

  redirect("/retailers/" + result.id);
}

/**
 * Moving an account along the pipeline.
 *
 * Three fields, bound to one account by an id the page supplies rather than
 * the form: a request cannot redirect this write at another record by adding
 * a field. Unlike the create action it does not redirect — the person is
 * already on the account and stays there, so the form reports what moved.
 */
export async function updateRetailerStatusAction(
  retailerId: string,
  _previous: RetailerFormState,
  form: FormData,
): Promise<RetailerFormState> {
  /* Every server action is a POST endpoint in its own right, reachable
     whether or not a page ever rendered a form pointing at it. The proxy
     turns unauthenticated requests away at the perimeter; this is the check
     that still holds if the perimeter ever does not. */
  await requireSession();

  const result = await updateRetailerStatus(retailerId, {
    currentTarget: text(form, "currentTarget"),
    pipelineStatus: text(form, "pipelineStatus"),
    standing: text(form, "standing"),
  });

  if (!result.ok) {
    return { errors: result.errors, saved: null, savedAt: _previous.savedAt };
  }

  /* A pipeline status is read by more of the portal than any other retailer
     field: it sets the Overview funnel, the workstream ordering, the phase an
     account is grouped under on Retailers, and both reports. The whole tree is
     revalidated rather than a guessed subset. */
  revalidatePath("/", "layout");

  return { errors: {}, saved: result.changed, savedAt: Date.now() };
}
