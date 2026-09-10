/**
 * A sparse account, and what the portal does with the fields nobody filled in.
 *
 *   node scripts/db/write/sparse.mjs
 *
 *   A. what is already here, and must still be here at the end
 *   B. the emptiest account the form allows — every screen still renders
 *   C. the absent fields say so, rather than crashing or inventing a value
 *   D. the same account with the fields filled in — real values come back
 *   E. a broker with no portrait and no initials
 *   F. a broker with a portrait — including on their own page
 *   G. unknown ids are 404, and the actions still refuse a stranger
 *   H. everything this check made is removed again
 *
 * This is the regression guard for the nullable read layer. Every optional
 * retailer column is nullable in Postgres, and the TypeScript model used to
 * declare them all present — so the first account entered through the portal
 * with fields left blank took the whole portal down with 500s. Section B is
 * that exact account, and it must render.
 *
 * Safe to run against the working database. Every record it creates is named
 * so nobody could mistake it for business data, and all of them — rows and
 * Storage objects alike — are taken back out at the end. It reads existing
 * records but changes none of them.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { connect, ok, bad, dim, heading } from "../client.mjs";
import { launch, signIn, submit, waitFor, fill } from "./browser.mjs";
import { writePng } from "./fixtures.mjs";

const APP = process.env.APP_URL ?? "http://127.0.0.1:3100";
const BUCKET = "cld-assets";

/* Deliberately unmistakable, so a run that dies halfway leaves something
   obviously not real behind. */
const BARE_BROKER = "ZZ Sparse Broker Bare";
const PHOTO_BROKER = "ZZ Sparse Broker Photo";
const ACCOUNT = "ZZ Sparse Account";

/* Every screen that reads the retailer list, plus the two that roll it up.
   A sparse account has to be survivable on all of them, not just its own. */
const SCREENS = [
  "/", "/retailers", "/workstream", "/brokers", "/products",
  "/actions", "/activity", "/meetings", "/reports", "/market-insights",
];

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "cld-sparse-"));
const PORTRAIT = writePng(path.join(scratch, "portrait.png"), { hue: 150 });

const db = await connect();
const q = async (sql, params) => db.query(sql, params);

let cookie = "";
const page = await launch();

let failures = 0;
const check = (label, condition, detail = "") => {
  if (condition) console.log(`  ${ok("pass")}  ${label}`);
  else {
    failures++;
    console.log(`  ${bad("FAIL")}  ${label}  ${dim(String(detail))}`);
  }
};
const line = (s) => console.log("  " + s);
const html = async (p) => (await fetch(APP + p, { headers: cookie ? { cookie } : {} })).text();
const status = async (p) =>
  (await fetch(APP + p, { headers: cookie ? { cookie } : {}, redirect: "manual" })).status;

const objects = async () =>
  (await q(`select name from storage.objects where bucket_id = $1 order by name`, [BUCKET]))
    .map((r) => r.name);

/** Removes everything this check could have made, in FK-safe order. */
async function removeTemp() {
  const retailers = await q(
    `delete from retailers where name = any($1) returning id, image_path`, [[ACCOUNT]]);
  const brokers = await q(
    `delete from brokers where name = any($1) returning id, image_path`,
    [[BARE_BROKER, PHOTO_BROKER]]);
  return { retailers, brokers };
}

/* == A. What is already here =========================================== */

heading("A. What is already in this database");

const beforeProducts = await q(`select id, item_id, name, image_path from products order by id`);
const beforeBrokers = await q(`select id, name from brokers order by id`);
const beforeRetailers = await q(`select id, name from retailers order by id`);
const beforeObjects = await objects();

line(dim(`${beforeProducts.length} product(s), ${beforeBrokers.length} broker(s), ${beforeRetailers.length} account(s), ${beforeObjects.length} object(s)`));
for (const p of beforeProducts) line(dim(`  ${p.item_id}  ${p.name}`));

const stale = await removeTemp();
if (stale.brokers.length || stale.retailers.length) {
  line(dim(`cleared ${stale.brokers.length + stale.retailers.length} leftover row(s) from an earlier run`));
}

({ cookie } = await signIn(page, APP));
line("signed in through the form at /login");

/* Every product page renders before anything is added, so a failure later
   cannot be blamed on something that was already broken. */
for (const p of beforeProducts) {
  check(`${p.item_id} renders before any of this`, (await status("/products/" + p.id)) === 200);
}

/* == B. The emptiest account the form allows =========================== */

heading("B. The emptiest account the form allows");

await page.goto(APP + "/retailers/new");
await waitFor(page, "#name");
await fill(page, "#name", ACCOUNT);
await fill(page, "#shortName", "ZZ Sparse");
await fill(page, "#channel", "Supermarket");
/* Nothing else is touched: no broker, no tier, no priority, no fit, no logo.
   This is the record that used to break the portal. */
line(await submit(page, 40000));

const sparse = (await q(`select * from retailers where name = $1`, [ACCOUNT]))[0];
check("the row is in Postgres", Boolean(sparse), "nothing was written");
if (!sparse) {
  console.log(bad("\n  No account was created, so there is nothing to check. Stopping.\n"));
  await removeTemp(); await page.close(); await db.close();
  fs.rmSync(scratch, { recursive: true, force: true });
  process.exit(1);
}

check("assigned_broker_id stayed NULL", sparse.assigned_broker_id === null, String(sparse.assigned_broker_id));
check("priority stayed NULL", sparse.priority === null, String(sparse.priority));
check("fit stayed NULL", sparse.fit === null, String(sparse.fit));
check("tier stayed NULL", sparse.tier === null, String(sparse.tier));
check("approximate_doors stayed NULL", sparse.approximate_doors === null, String(sparse.approximate_doors));
check("next_action_date stayed NULL", sparse.next_action_date === null, String(sparse.next_action_date));
check("geography stayed NULL", sparse.geography === null, String(sparse.geography));
check("image_path stayed NULL", sparse.image_path === null, String(sparse.image_path));
check("no Storage object was created for it", (await objects()).length === beforeObjects.length);

const detail = "/retailers/" + sparse.id;

for (const screen of SCREENS) {
  check(`${screen} renders with a sparse account in the book`, (await status(screen)) === 200);
}
check(`${detail} renders`, (await status(detail)) === 200);

/* == C. What the absent fields say ===================================== */

heading("C. What the absent fields say");

const sparseHtml = await html(detail);

check("the account's own page names it", sparseHtml.includes(ACCOUNT));
check("absent fields read 'Not recorded'", sparseHtml.includes("Not recorded"), "no such label on the page");
check("the Tier row is present and reads as unrecorded", sparseHtml.includes(">Tier<"),
  "no Tier row on the page at all");
check("no tier band was invented", !/>Tier [123]</.test(sparseHtml), "a tier was shown for an account with none");
check("no field printed the word 'undefined'", !sparseHtml.includes(">undefined<") && !sparseHtml.includes(" undefined "), "undefined leaked into the markup");
check("no field printed the word 'null'", !sparseHtml.includes(">null<"), "null leaked into the markup");
check("no store count was invented", !sparseHtml.includes("~0 stores"), "an absent door count rendered as nought");
check("the account with no broker reads 'Unassigned'", sparseHtml.includes("Unassigned"));

const listHtml = await html("/retailers");
check("it appears on /retailers", listHtml.includes(ACCOUNT));
check("the pipeline table does not print 'undefined'", !listHtml.includes(">undefined<"));

const streamHtml = await html("/workstream");
check("the workstream shows it rather than dropping it", streamHtml.includes(ACCOUNT));
check("under an 'Unassigned' heading", streamHtml.includes("Unassigned"));

const overviewHtml = await html("/");
check("the Overview does not print 'undefined'", !overviewHtml.includes(">undefined<"));

/* == D. The same account, with the fields filled in ==================== */

heading("D. The same account, with the fields filled in");

/* Written straight to the row rather than through a form: retailer edit is
   not built yet, and what is under test here is the read layer, which cannot
   tell where a value came from. */
await q(
  `update retailers
      set geography = $2, priority = $3, fit = $4, tier = $5,
          approximate_doors = $6, assumed_skus = $7, units_per_store_week = $8,
          next_action = $9, next_action_date = $10, notes = $11
    where id = $1`,
  [sparse.id, "Philippines", "High", "High", "Tier 1", 240, 3, 12.5,
   "Confirm the shelf set date", "2026-10-01", "Entered by the sparse check."],
);

const filledHtml = await html(detail);
check(`${detail} still renders`, (await status(detail)) === 200);
check("the geography now shows its actual value", filledHtml.includes("Philippines"));
check("the door count is formatted, not raw", filledHtml.includes("240"), "240 stores missing");
check("the tier shows its actual value", filledHtml.includes("Tier 1"), "the stored tier did not reach the page");
check("the priority shows its actual value", filledHtml.includes("High"));
check("the next step shows its actual text", filledHtml.includes("Confirm the shelf set date"));
check("nothing now reads 'Not recorded' for those fields", !filledHtml.includes("Not recorded"),
  "a filled field still rendered as absent");

/* Half-filled is the case between the two, and the one most likely to slip:
   a step with no date on it. */
await q(`update retailers set next_action_date = null where id = $1`, [sparse.id]);
check("a next step with no date still renders", (await status(detail)) === 200);
const undatedHtml = await html(detail);
check("the step's text is still shown", undatedHtml.includes("Confirm the shelf set date"));
check("and no date was invented for it", !undatedHtml.includes("due Invalid"), "an invalid date was formatted");

/* Back to sparse, so section H removes exactly what section B made. */
await q(
  `update retailers set geography = null, priority = null, fit = null, tier = null,
      approximate_doors = null, assumed_skus = null, units_per_store_week = null,
      next_action = null, notes = null where id = $1`,
  [sparse.id],
);

/* == E. A broker with no portrait and no initials ====================== */

heading("E. A broker with no portrait and no initials");

await page.goto(APP + "/brokers/new");
await waitFor(page, "#name");
await fill(page, "#name", BARE_BROKER);
await fill(page, "#shortName", "ZZ Bare");
/* No role, no coverage, no initials, no portrait. */
line(await submit(page, 40000));

const bare = (await q(`select * from brokers where name = $1`, [BARE_BROKER]))[0];
check("the row is in Postgres", Boolean(bare), "nothing was written");
if (bare) {
  check("initials stayed NULL", bare.initials === null, String(bare.initials));
  check("role stayed NULL", bare.role === null, String(bare.role));
  check("image_path stayed NULL", bare.image_path === null, String(bare.image_path));

  const bareHtml = await html("/brokers/" + bare.id);
  check("their page renders", (await status("/brokers/" + bare.id)) === 200);
  check("their page does not print 'null'", !bareHtml.includes(">null<"), "null leaked into the markup");
  check("their page does not print 'undefined'", !bareHtml.includes(">undefined<"));
  /* Short name "ZZ Bare" — two words, so the disc takes the first letter of
     each, exactly as RetailerMark does for an account. */
  check("the initials fallback is derived from the short name", bareHtml.includes(">ZB<"),
    "the disc rendered with nothing in it");
  check("the brokers list renders them too", (await html("/brokers")).includes(BARE_BROKER));
}

/* == F. A broker with a portrait ======================================= */

heading("F. A broker with a portrait");

await page.goto(APP + "/brokers/new");
await waitFor(page, "#name");
await fill(page, "#name", PHOTO_BROKER);
await fill(page, "#shortName", "ZZ Photo");
await fill(page, "#role", "Retail brokerage");
await fill(page, "#coverage", "Philippines");
await fill(page, "#initials", "ZP");
await page.attachFile("#image", PORTRAIT);
line(await submit(page, 40000));

const photo = (await q(`select * from brokers where name = $1`, [PHOTO_BROKER]))[0];
check("the row is in Postgres", Boolean(photo), "nothing was written");
if (photo) {
  check("it carries an image path", Boolean(photo.image_path), String(photo.image_path));
  check("Storage holds the object the row names", (await objects()).includes(photo.image_path));

  const photoHtml = await html("/brokers/" + photo.id);
  check("the brokers list renders the portrait", (await html("/brokers")).includes(photo.image_path));
  check("their own page now renders the portrait", photoHtml.includes(photo.image_path),
    "BrokerHeader still shows no picture");
  check("the recorded initials are not shown over the picture", !photoHtml.includes(">ZP<"));
}

/* == G. Unknown ids, and a stranger ==================================== */

heading("G. Unknown ids, and a stranger");

for (const p of ["/retailers/no-such-account", "/brokers/no-such-broker", "/products/no-such-product"]) {
  check(`${p} is 404, not 500`, (await status(p)) === 404);
}

for (const p of ["/brokers/new", "/retailers/new"]) {
  const res = await fetch(APP + p, { redirect: "manual" });
  check(`${p} turns a signed-out visitor away`, res.status === 307 || res.status === 302, String(res.status));
}

for (const p of ["/brokers", "/retailers"]) {
  const res = await fetch(APP + p, {
    method: "POST",
    headers: { "next-action": "x", "content-type": "text/plain" },
    body: "",
    redirect: "manual",
  });
  check(`a server action on ${p} refuses a stranger`, res.status === 401, String(res.status));
}

/* == H. Putting it back =============================================== */

heading("H. Putting it back");

const made = await removeTemp();
const madeObjects = [...made.retailers, ...made.brokers]
  .map((r) => r.image_path).filter(Boolean);
line(`removed ${made.brokers.length} broker(s) and ${made.retailers.length} account(s)`);

/* The rows are gone, so the objects they pointed at are now orphans. Take
   them out through Storage's own API, the way the portal does — Supabase
   refuses a direct DELETE against storage.objects. */
if (madeObjects.length) {
  const { loadEnv } = await import("../env.mjs");
  loadEnv();
  const ref = decodeURIComponent(new URL(process.env.DATABASE_URL).username).split(".")[1];
  for (const name of madeObjects) {
    await fetch(`https://${ref}.supabase.co/storage/v1/object/${BUCKET}/${name}`, {
      method: "DELETE",
      headers: { apikey: process.env.SUPABASE_SECRET_KEY ?? "" },
    });
  }
  line(`removed ${madeObjects.length} Storage object(s)`);
}

const afterProducts = await q(`select id, item_id, name, image_path from products order by id`);
const afterBrokers = await q(`select id, name from brokers order by id`);
const afterRetailers = await q(`select id, name from retailers order by id`);
const afterObjects = await objects();

check("the products are exactly as they were",
  JSON.stringify(afterProducts) === JSON.stringify(beforeProducts),
  `${beforeProducts.length} before, ${afterProducts.length} after`);
check("the brokers are exactly as they were",
  JSON.stringify(afterBrokers) === JSON.stringify(beforeBrokers));
check("the accounts are exactly as they were",
  JSON.stringify(afterRetailers) === JSON.stringify(beforeRetailers));
check("the bucket holds exactly what it held",
  JSON.stringify(afterObjects) === JSON.stringify(beforeObjects),
  `${beforeObjects.length} before, ${afterObjects.length} after`);

for (const p of afterProducts) {
  check(`${p.item_id} still renders`, (await status("/products/" + p.id)) === 200);
}

await page.close();
await db.close();
fs.rmSync(scratch, { recursive: true, force: true });

console.log(
  failures === 0
    ? `\n${ok("All checks passed.")} A sparse account renders everywhere, and nothing was left behind.\n`
    : `\n${bad(failures + " check(s) failed.")}\n`,
);
process.exit(failures === 0 ? 0 : 1);
