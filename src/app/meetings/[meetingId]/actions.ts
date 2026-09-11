"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/session";
import { updateMeeting, type FieldErrors } from "@/lib/db/mutations";

/**
 * The meeting record's edit boundary.
 *
 * Three fields cross it: the notes, the decisions, the status. The meeting id
 * comes from the route, so a request cannot redirect this write at another
 * record by adding a field — and nothing that identifies the meeting is
 * editable, so there is no field here capable of moving it to another account.
 */

export interface MeetingEditState {
  errors: FieldErrors;
  saved: string[] | null;
  savedAt: number;
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "");

export async function updateMeetingAction(
  meetingId: string,
  _previous: MeetingEditState,
  form: FormData,
): Promise<MeetingEditState> {
  /* Every server action is a POST endpoint in its own right, reachable
     whether or not a page ever rendered a form pointing at it. The proxy
     turns unauthenticated requests away at the perimeter; this is the check
     that still holds if the perimeter ever does not. */
  await requireSession();

  /* Not trimmed on the way in: the notes and the decisions are prose, and
     where the blank lines fall is the writer's business. The mutation trims
     what it has to and turns an empty field into NULL. */
  const result = await updateMeeting(meetingId, {
    summary: text(form, "summary"),
    decisions: text(form, "decisions"),
    status: text(form, "status").trim(),
  });

  if (!result.ok) {
    return { errors: result.errors, saved: null, savedAt: _previous.savedAt };
  }

  /* A status change moves the meeting between the Upcoming and Past tabs, and
     a write-up reaches the account's notes panel, the broker's notes, the
     account timeline and the meeting record itself. The whole tree is
     revalidated rather than a guessed subset. */
  revalidatePath("/", "layout");

  /* No redirect. Writing up a meeting is iterative — a line remembered, a
     decision added — so the person stays on the form and it reports what
     moved, the way the retailer status edit does. */
  return { errors: {}, saved: result.changed, savedAt: Date.now() };
}
