"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { createMeeting, type FieldErrors } from "@/lib/db/mutations";

/**
 * The meeting write path's boundary.
 *
 * Four fields cross it: the title, the day, an optional hour, and whether the
 * meeting is still to come or is being written up after the fact. The account
 * comes from the route and the client id is resolved server-side, so neither
 * is anything a request can choose — and the broker is not a field at all,
 * because a meeting on an account is run by whoever carries that account.
 */

export interface MeetingCreateState {
  errors: FieldErrors;
  saved: string[] | null;
  savedAt: number;
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export async function createMeetingAction(
  retailerId: string,
  _previous: MeetingCreateState,
  form: FormData,
): Promise<MeetingCreateState> {
  /* Every server action is a POST endpoint in its own right, reachable
     whether or not a page ever rendered a form pointing at it. The proxy
     turns unauthenticated requests away at the perimeter; this is the check
     that still holds if the perimeter ever does not. */
  await requireSession();

  const result = await createMeeting(retailerId, {
    title: text(form, "title"),
    scheduledOn: text(form, "scheduledOn"),
    scheduledTime: text(form, "scheduledTime"),
    status: text(form, "status"),
  });

  if (!result.ok || !result.id) {
    return { errors: result.errors, saved: null, savedAt: _previous.savedAt };
  }

  /* A meeting shows up on the account's Notes tab, on both tabs of Meetings &
     Notes, in the account timeline and — once it is completed — in the broker's
     notes and the account's derived meeting status. The whole tree is
     revalidated rather than a guessed subset. */
  revalidatePath("/", "layout");

  /* Straight into the record: it exists, and the next thing anyone wants is to
     read it back. Writing up what was said is a later phase. */
  redirect("/meetings/" + result.id);
}
