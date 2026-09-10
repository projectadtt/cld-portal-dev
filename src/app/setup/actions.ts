"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/session";
import { createWorkspace, type FieldErrors } from "@/lib/db/mutations";

/**
 * The first write.
 *
 * This folder holds no page: a directory only becomes a route when it has
 * one. The first-run screen lives on the Overview, because that is where
 * someone opening an empty portal actually lands.
 */

export interface SetupFormState {
  errors: FieldErrors;
  done: boolean;
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export async function createWorkspaceAction(
  _previous: SetupFormState,
  form: FormData,
): Promise<SetupFormState> {
  /* Every server action is a POST endpoint in its own right, reachable
     whether or not a page ever rendered a form pointing at it. Middleware
     turns unauthenticated requests away at the perimeter; this is the check
     that still holds if the perimeter ever does not. */
  await requireSession();

  const result = await createWorkspace({
    name: text(form, "name"),
    workspace: text(form, "workspace"),
    category: text(form, "category"),
    tagline: text(form, "tagline"),
    isDemo: form.get("isDemo") === "on",
  });

  if (!result.ok) return { errors: result.errors, done: false };

  /* Everything changes at once: the sidebar, every empty state, every page
     title. The whole tree is revalidated because the whole tree was waiting
     on this row. */
  revalidatePath("/", "layout");
  return { errors: {}, done: true };
}
