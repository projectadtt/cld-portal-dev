/**
 * The media path, driven the way a person drives it.
 *
 *   node scripts/db/write/media.mjs
 *
 *   A. what has to be true before anything is uploaded
 *   B. upload a real photograph through the form
 *   C. it is in Storage, it is on the row, and it is on the screen
 *   D. replace it — and the object it replaced is gone
 *   E. remove it — the row is cleared, the object is gone, the plate is back
 *   F. what the upload path refuses
 *
 * Nothing is seeded and nothing is faked. The file is this product's own
 * photograph, attached to the form by the browser exactly as the operating
 * system's file picker would attach it, and every claim is then checked twice:
 * once against Postgres, once against the page a browser actually receives.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { connect, ok, bad, dim, heading } from "../client.mjs";
import { launch, signIn, submit, waitFor } from "./browser.mjs";
import { writePng } from "./fixtures.mjs";

/**
 * The same URL the application builds, built the same way — from the project
 * ref in DATABASE_URL. Written out here rather than imported because
 * src/lib/storage/assets.ts is server-only TypeScript; if the two ever drift
 * apart, the byte-for-byte comparison below is what notices.
 */
function publicUrl(objectPath) {
  const ref = decodeURIComponent(new URL(process.env.DATABASE_URL).username).split(".")[1];
  return `https://${ref}.supabase.co/storage/v1/object/public/${BUCKET}/${objectPath}`;
}


const APP = process.env.APP_URL ?? "http://127.0.0.1:3100";
const BUCKET = "cld-assets";

/**
 * Everything this suite uploads, written fresh into a temporary directory.
 *
 * Generated rather than committed, and generated rather than read from the
 * archived prototype folder, which is deliberately not published — so this
 * suite runs from a clean clone with nothing extra fetched. They are real
 * PNGs, not stand-ins: the portal reads an upload's first bytes to decide what
 * it is, and nothing here softens that.
 */
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "cld-media-"));

/** The photograph this product gets. */
const PHOTO = writePng(path.join(scratch, "product.png"), { hue: 40 });
/** A second image, so "replace" replaces with something visibly different. */
const OTHER = writePng(path.join(scratch, "replacement.png"), { hue: 190 });

const db = await connect();
const q = async (sql, params) => db.query(sql, params);

/* The portal is closed; every rendered page read below is read as the signed-in
   session the browser established. */
let cookie = "";

const page = await launch();
({ cookie } = await signIn(page, APP));

let failures = 0;
const check = (label, condition, detail = "") => {
  if (condition) console.log(`  ${ok("pass")}  ${label}`);
  else {
    failures++;
    console.log(`  ${bad("FAIL")}  ${label}  ${dim(String(detail))}`);
  }
};
const line = (s) => console.log("  " + s);

const html = async (p) =>
  (await fetch(APP + p, { headers: cookie ? { cookie } : {} })).text();

const product = async () =>
  (await q(`select id, name, item_id, image_path from products where archived_at is null`))[0];

const objects = async () =>
  (await q(`select name from storage.objects where bucket_id = $1 order by name`, [BUCKET]))
    .map((r) => r.name);

/* == A. Before anything is uploaded ==================================== */

heading("A. Before anything is uploaded");

const buckets = await q(`select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = $1`, [BUCKET]);
check("the bucket exists", buckets.length === 1, "run: npm run db:storage -- --apply");
check("it is public-read, so a stored path renders without a signature", buckets[0]?.public === true);
check("it caps object size at 5 MB", String(buckets[0]?.file_size_limit) === String(5 * 1024 * 1024));
check(
  "it accepts only the three image types",
  (buckets[0]?.allowed_mime_types ?? []).join(",") === "image/jpeg,image/png,image/webp",
  JSON.stringify(buckets[0]?.allowed_mime_types),
);

const subject = await product();
check("the product entered through the UI is still here", Boolean(subject), JSON.stringify(subject));
if (!subject) {
  console.log(bad("\n  No product to work with. Stopping before anything is changed.\n"));
  await db.close();
  process.exit(1);
}
line(dim(`subject: ${subject.name} (${subject.item_id})`));

check("it has no image yet", subject.image_path === null, String(subject.image_path));
check("and Storage holds nothing", (await objects()).length === 0);

const detailPath = "/products/" + subject.id;
const editPath = detailPath + "/edit";

check(
  "the product page shows its typographic plate, not a broken image",
  (await html(detailPath)).includes(subject.item_id),
);

/* == B. Uploading ====================================================== */

heading("B. Uploading, through the form");

await page.goto(APP + editPath);
await waitFor(page, "#image");

check("the edit form offers an image control", await page.evaluate(`
  return Boolean(document.querySelector('input#image[type=file]'));
`));

check("the control accepts only the three formats", await page.evaluate(`
  return document.querySelector('#image').getAttribute('accept') === 'image/jpeg,image/png,image/webp';
`) === true);

await page.attachFile("#image", PHOTO);

const previewed = await page.evaluate(`
  const img = document.querySelector('form img');
  return img ? img.getAttribute('src')?.slice(0, 5) : null;
`);
check("the chosen file previews before it is saved", previewed === "blob:", String(previewed));

check("and the form says it is not saved yet", await page.evaluate(`
  return document.body.textContent.includes('Not saved yet');
`) === true);

line(await submit(page, 40000));

/* == C. In Storage, on the row, on the screen ========================== */

heading("C. In Storage, on the row, on the screen");

const afterUpload = await product();
check("the row now carries an image path", Boolean(afterUpload.image_path), String(afterUpload.image_path));

const stored = afterUpload.image_path ?? "";
check(
  "the path is the shape the schema pins it to",
  new RegExp(`^products/${subject.id}/[0-9a-f]{32}\\.(jpg|jpeg|png|webp)$`).test(stored),
  stored,
);
check("it is a path, not a URL — no host and no signature is stored",
  !stored.includes("http") && !stored.includes("?"), stored);

const inBucket = await objects();
check("Storage holds exactly one object", inBucket.length === 1, JSON.stringify(inBucket));
check("and it is the object the row names", inBucket[0] === stored, JSON.stringify(inBucket));

const url = publicUrl(stored);
const fetched = await fetch(url);
check("the public URL serves the file", fetched.status === 200, String(fetched.status));
check(
  "with the content type the bytes said it was",
  fetched.headers.get("content-type")?.includes("image/png"),
  String(fetched.headers.get("content-type")),
);
const served = Buffer.from(await fetched.arrayBuffer());
const original = fs.readFileSync(PHOTO);
check(
  "and it is byte-for-byte the file that was uploaded",
  served.length === original.length && served.equals(original),
  `${served.length} bytes served, ${original.length} uploaded`,
);

const shows = (markup) => Boolean(stored) && markup.includes(stored);

const listHtml = await html("/products");
check("the products list renders the image", shows(listHtml), "path not found in the list markup");

const detailHtml = await html(detailPath);
check("the product page renders it too", shows(detailHtml));

const editHtml = await html(editPath);
check("and the edit form opens on it", shows(editHtml));

/* A second, independent request — the refresh a person does to check. */
const refreshed = await html(detailPath);
check("a fresh request still renders it", shows(refreshed));

/* == D. Replacing ====================================================== */

heading("D. Replacing");

await page.goto(APP + editPath);
await waitFor(page, "#image");
await page.attachFile("#image", OTHER);
line(await submit(page, 40000));

const afterReplace = await product();
check("the row points somewhere new", Boolean(afterReplace.image_path) && afterReplace.image_path !== stored,
  String(afterReplace.image_path));

const afterReplaceObjects = await objects();
check("Storage still holds exactly one object — the old one was cleaned up",
  afterReplaceObjects.length === 1, JSON.stringify(afterReplaceObjects));
check("and it is the new one", afterReplaceObjects[0] === afterReplace.image_path);

check("the object the row used to point at is gone",
  Boolean(stored) && !afterReplaceObjects.includes(stored), "there was no earlier object");
/**
 * Asked of `storage.objects` — Supabase's own catalogue, read over the same
 * connection as everything else here — and never of the public URL.
 *
 * Those two disagree for a while after a delete, and the disagreement is not a
 * bug: every object is uploaded with `cache-control: max-age=31536000,
 * immutable`, so a CDN edge that has already served one keeps serving it after
 * the object is gone. Measured, not assumed — `cf-cache-status: HIT` on a path
 * the store no longer lists.
 *
 * An earlier version asserted that the public URL 404s the instant the object
 * is deleted. It failed while the delete it was checking had worked perfectly,
 * which is the worst kind of red. The REST API is no better a witness here: it
 * answers 400, not 404, for an object that does not exist.
 */
check("and Storage's own catalogue no longer lists it",
  !(await objects()).includes(stored), stored);

const replacedServed = await fetch(publicUrl(afterReplace.image_path));
const replacedBytes = Buffer.from(await replacedServed.arrayBuffer());
check("the new URL serves the new file",
  replacedBytes.equals(fs.readFileSync(OTHER)), `${replacedBytes.length} bytes`);

check("the product page shows the replacement", (await html(detailPath)).includes(afterReplace.image_path));

/* == E. Removing ======================================================= */

heading("E. Removing");

await page.goto(APP + editPath);
await waitFor(page, "#image");

const removedNotice = await page.evaluate(`
  const button = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Remove');
  if (!button) return "NO REMOVE CONTROL";
  button.click();
  await new Promise((r) => setTimeout(r, 300));
  return document.body.textContent.includes('will be removed when you save')
    ? "the form says it will be removed on save"
    : "NO CONFIRMATION TEXT";
`);
check("the form offers a remove, and says what it will do", removedNotice.startsWith("the form says"), removedNotice);

check("a hidden field carries the intent, so an empty input is never guessed at",
  await page.evaluate(`return Boolean(document.querySelector('input[name=imageAction][value=remove]'));`) === true);

line(await submit(page, 40000));

const afterRemove = await product();
check("the row's image path is cleared", afterRemove.image_path === null, String(afterRemove.image_path));
check("Storage is empty again", (await objects()).length === 0, JSON.stringify(await objects()));
check("the product is still here — removing a picture is not archiving a product",
  afterRemove.id === subject.id && afterRemove.name === subject.name);

const plateAgain = await html(detailPath);
check("the product page is back to its typographic plate", plateAgain.includes(subject.item_id));
check("and renders no image from the bucket", !plateAgain.includes("/storage/v1/object/public/"));

/* == F. What the upload path refuses =================================== */

heading("F. What the upload path refuses");

/* An SVG renamed .jpg. The case that matters: SVG is a document that can
   carry script, and the bucket serves public URLs. */
const disguised = path.join(scratch, "logo.jpg");
fs.writeFileSync(disguised, `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`);

/* A real JPEG header followed by enough bytes to pass the limit. */
const oversized = path.join(scratch, "huge.jpg");
fs.writeFileSync(oversized, Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(Math.round(5.5 * 1024 * 1024), 0x20),
]));

for (const [label, file] of [
  ["a file that is not an image, whatever it is called", disguised],
  ["a file over the size limit", oversized],
]) {
  await page.goto(APP + editPath);
  await waitFor(page, "#image");
  await page.attachFile("#image", file);
  const outcome = await submit(page, 40000);
  check(`refused: ${label}`, outcome.startsWith("REJECTED"), outcome);
  line(dim(outcome));
}

const afterRefusals = await product();
check("no refusal put anything in Storage", (await objects()).length === 0);
check("and none of them changed the row", afterRefusals.image_path === null);
check("the product's own fields are untouched by all of this",
  afterRefusals.item_id === subject.item_id && afterRefusals.name === subject.name,
  JSON.stringify(afterRefusals));

fs.rmSync(scratch, { recursive: true, force: true });

/* == Result ============================================================ */

heading("Result");
const [{ c: rows }] = await q(`select count(*)::int as c from products where image_path is not null`);
const finalObjects = await objects();
line(`rows with an image: ${rows}   objects in the bucket: ${finalObjects.length}`);
check("the two stores agree", rows === finalObjects.length);

await page.close();
await db.close();
fs.rmSync(scratch, { recursive: true, force: true });
line(failures === 0 ? ok("all checks passed") : bad(`${failures} failed`));
process.exit(failures ? 1 : 0);
