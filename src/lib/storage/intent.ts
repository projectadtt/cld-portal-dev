import "server-only";

import type { ImageIntent } from "@/lib/db/mutations";
import { readUpload } from "@/lib/storage/assets";

/**
 * What a form said about the picture.
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
 *
 * One implementation, shared by products, brokers and retailers. It lives here
 * rather than in any one route's actions file because three copies of this
 * would be three chances for the three forms to disagree about what an empty
 * file input means — and on a create, "no file" must be a blank column rather
 * than an error or a fabricated path.
 */
export async function readImageIntent(
  form: FormData,
): Promise<{ intent: ImageIntent } | { error: string }> {
  if (form.get("imageAction") === "remove") return { intent: { kind: "remove" } };

  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) return { intent: { kind: "keep" } };

  const upload = await readUpload(file);
  if (!upload.ok) return { error: upload.error };

  return { intent: { kind: "replace", upload } };
}
