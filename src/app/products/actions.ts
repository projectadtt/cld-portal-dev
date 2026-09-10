"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import {
  archiveProduct,
  createProduct,
  setEntityImage,
  updateProduct,
  type FieldErrors,
  type ImageIntent,
  type ProductDraft,
} from "@/lib/db/mutations";
import { readUpload } from "@/lib/storage/assets";

/**
 * The product write path's boundary.
 *
 * Everything the browser can say about a product passes through here as form
 * fields and nothing else — no ids for other entities, no client id. The
 * workspace is resolved server-side, so a product cannot be filed under a
 * client the person entering it does not have open.
 */

export interface ProductFormState {
  errors: FieldErrors;
  saved: string[] | null;
  savedAt: number;
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

/**
 * What the form said about the picture.
 *
 * A browser posts an untouched file input as a zero-byte entry, which is
 * indistinguishable from a deliberate choice unless the form says which it
 * meant — so the intent is carried by its own field, and the file is only ever
 * read when that field asks for it.
 *
 * Every byte is validated here, at the boundary, before the write layer is
 * called at all. The accept attribute on the input is a convenience for the
 * person choosing a file; it is not a control, because nothing obliges a
 * request to have come from that form.
 */
async function readImageIntent(
  form: FormData,
): Promise<{ intent: ImageIntent } | { error: string }> {
  if (form.get("imageAction") === "remove") return { intent: { kind: "remove" } };

  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) return { intent: { kind: "keep" } };

  const upload = await readUpload(file);
  if (!upload.ok) return { error: upload.error };

  return { intent: { kind: "replace", upload } };
}

function readDraft(form: FormData): ProductDraft {
  return {
    name: text(form, "name"),
    itemId: text(form, "itemId"),
    category: text(form, "category"),
    readiness: text(form, "readiness"),
    packSize: text(form, "packSize"),
    positioning: text(form, "positioning"),
    upc: text(form, "upc"),
    sourceNotes: text(form, "sourceNotes"),
    fobCost: text(form, "fobCost"),
    landedCost: text(form, "landedCost"),
    suggestedRetail: text(form, "suggestedRetail"),
    moq: text(form, "moq"),
    casePack: text(form, "casePack"),
    leadTimeDays: text(form, "leadTimeDays"),
  };
}

export async function createProductAction(
  _previous: ProductFormState,
  form: FormData,
): Promise<ProductFormState> {
  /* Every server action is a POST endpoint in its own right, reachable
     whether or not a page ever rendered a form pointing at it. Middleware
     turns unauthenticated requests away at the perimeter; this is the check
     that still holds if the perimeter ever does not. */
  await requireSession();

  /* Before the record, because a picture that is not a picture should not cost
     someone the rest of the form they just filled in. */
  const image = await readImageIntent(form);
  if ("error" in image) {
    return { errors: { image: image.error }, saved: null, savedAt: _previous.savedAt };
  }

  const result = await createProduct(readDraft(form));

  if (!result.ok || !result.id) {
    return { errors: result.errors, saved: null, savedAt: _previous.savedAt };
  }

  /* The product exists at this point. If its image cannot be stored, that is
     what gets reported — not a failure of the whole save, which did happen. */
  const attached = await setEntityImage("product", result.id, image.intent);
  if (attached.error) {
    revalidatePath("/", "layout");
    return {
      errors: { image: attached.error + " The product itself was saved." },
      saved: null,
      savedAt: Date.now(),
    };
  }

  /* A new product changes the range, the portfolio counts and every screen
     that counts products, so the whole tree is revalidated. */
  revalidatePath("/", "layout");

  /* Straight to the record that was just created: the next thing anyone wants
     after adding an item is to look at it. */
  redirect("/products/" + result.id);
}

export async function updateProductAction(
  productId: string,
  _previous: ProductFormState,
  form: FormData,
): Promise<ProductFormState> {
  /* Every server action is a POST endpoint in its own right, reachable
     whether or not a page ever rendered a form pointing at it. Middleware
     turns unauthenticated requests away at the perimeter; this is the check
     that still holds if the perimeter ever does not. */
  await requireSession();

  const image = await readImageIntent(form);
  if ("error" in image) {
    return { errors: { image: image.error }, saved: null, savedAt: _previous.savedAt };
  }

  const result = await updateProduct(productId, readDraft(form));

  if (!result.ok) {
    return { errors: result.errors, saved: null, savedAt: _previous.savedAt };
  }

  const attached = await setEntityImage("product", productId, image.intent);

  revalidatePath("/", "layout");

  if (attached.error) {
    return {
      errors: { image: attached.error },
      saved: result.changed,
      savedAt: Date.now(),
    };
  }

  return {
    errors: {},
    saved: [...result.changed, ...attached.changed],
    savedAt: Date.now(),
  };
}

export async function archiveProductAction(
  productId: string,
  _previous: ProductFormState,
  form: FormData,
): Promise<ProductFormState> {
  /* Every server action is a POST endpoint in its own right, reachable
     whether or not a page ever rendered a form pointing at it. Middleware
     turns unauthenticated requests away at the perimeter; this is the check
     that still holds if the perimeter ever does not. */
  await requireSession();

  /* The confirmation is posted, not held in the browser's memory. A form that
     reaches here without it was not the one the person confirmed. */
  if (form.get("confirm") !== "archive") {
    return {
      errors: { form: "Archiving needs to be confirmed." },
      saved: null,
      savedAt: _previous.savedAt,
    };
  }

  const result = await archiveProduct(productId);

  if (!result.ok) {
    return { errors: result.errors, saved: null, savedAt: _previous.savedAt };
  }

  revalidatePath("/", "layout");

  /* The product is off the working range, so the page it was edited on no
     longer has a subject. The list is where it went. */
  redirect("/products");
}
