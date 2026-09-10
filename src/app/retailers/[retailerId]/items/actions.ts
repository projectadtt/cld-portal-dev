"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { createWorkstreamItem, type FieldErrors } from "@/lib/db/mutations";

/**
 * The workstream item write path's boundary.
 *
 * One field crosses it — which product. The account comes from the route and
 * the client id is resolved server-side, so neither is anything a request can
 * choose. Everything else a pairing will carry is entered afterwards, in the
 * item workspace that already exists.
 */

export interface ItemCreateState {
  errors: FieldErrors;
  saved: string[] | null;
  savedAt: number;
}

export async function createItemAction(
  retailerId: string,
  _previous: ItemCreateState,
  form: FormData,
): Promise<ItemCreateState> {
  /* Every server action is a POST endpoint in its own right, reachable
     whether or not a page ever rendered a form pointing at it. The proxy
     turns unauthenticated requests away at the perimeter; this is the check
     that still holds if the perimeter ever does not. */
  await requireSession();

  const productId = String(form.get("productId") ?? "").trim();
  if (!productId) {
    return {
      errors: { productId: "Choose the item to work into this account." },
      saved: null,
      savedAt: _previous.savedAt,
    };
  }

  const result = await createWorkstreamItem(retailerId, productId);

  if (!result.ok || !result.id) {
    return { errors: result.errors, saved: null, savedAt: _previous.savedAt };
  }

  /* A new pairing shows up on the account, the workstream, the product's own
     conversations, the fit matrix and both reports, so the whole tree is
     revalidated rather than a guessed subset. */
  revalidatePath("/", "layout");

  /* Straight into the item workspace: the pairing exists, and the next thing
     anyone wants to do is say where it stands. */
  redirect("/retailers/" + retailerId + "/items/" + result.id);
}
