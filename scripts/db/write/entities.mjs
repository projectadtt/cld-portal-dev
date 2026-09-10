/**
 * Adding a broker and a retail account, through the real forms.
 *
 *   node scripts/db/write/entities.mjs
 *
 *   A. what is already here, and must still be here at the end
 *   B. a broker, with no picture — the column stays NULL, nothing errors
 *   C. a broker with a portrait, uploaded through the create form
 *   D. an account assigned to that broker, with a logo
 *   E. what the two forms refuse
 *   F. unknown ids are 404, and the actions refuse a stranger
 *   G. everything this check made is removed again
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
const PLAIN_BROKER = "ZZ Check Broker Plain";
const IMAGE_BROKER = "ZZ Check Broker Portrait";
const RETAILER = "ZZ Check Account";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "cld-entities-"));
const PORTRAIT = writePng(path.join(scratch, "portrait.png"), { hue: 90 });
const LOGO = writePng(path.join(scratch, "logo.png"), { hue: 210 });

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
    `delete from retailers where name = any($1) returning id, image_path`, [[RETAILER]]);
  const brokers = await q(
    `delete from brokers where name = any($1) returning id, image_path`,
    [[PLAIN_BROKER, IMAGE_BROKER]]);
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

/* == B. A broker with no picture ======================================= */

heading("B. A broker, with no picture chosen");

await page.goto(APP + "/brokers/new");
await waitFor(page, "#name");
await fill(page, "#name", PLAIN_BROKER);
await fill(page, "#shortName", "ZZ Plain");
line(await submit(page, 40000));

const plain = (await q(`select * from brokers where name = $1`, [PLAIN_BROKER]))[0];
check("the row is in Postgres", Boolean(plain), "nothing was written");
if (!plain) {
  console.log(bad("\n  No broker was created, so there is nothing to check. Stopping.\n"));
  await removeTemp(); await page.close(); await db.close();
  fs.rmSync(scratch, { recursive: true, force: true });
  process.exit(1);
}
check("client_id is the workspace, not anything from the form", plain.client_id === "client", String(plain.client_id));
check("status defaulted to Active", plain.status === "Active", String(plain.status));
check("image_path is NULL — a missing picture is not an error", plain.image_path === null, String(plain.image_path));
check("no Storage object was created for it", (await objects()).length === beforeObjects.length);
check("it appears on /brokers immediately", (await html("/brokers")).includes(PLAIN_BROKER));
check("its own page opens immediately", (await status("/brokers/" + plain.id)) === 200);

/* == C. A broker with a portrait ======================================= */

heading("C. A broker, with a portrait chosen on the create form");

await page.goto(APP + "/brokers/new");
await waitFor(page, "#name");
await fill(page, "#name", IMAGE_BROKER);
await fill(page, "#shortName", "ZZ Portrait");
await fill(page, "#role", "Retail brokerage");
await fill(page, "#coverage", "Philippines");
await fill(page, "#initials", "ZZ");
await page.attachFile("#image", PORTRAIT);
line(await submit(page, 40000));

const withImage = (await q(`select * from brokers where name = $1`, [IMAGE_BROKER]))[0];
check("the row is in Postgres", Boolean(withImage), "nothing was written");
check("it carries an image path", Boolean(withImage?.image_path), String(withImage?.image_path));
check(
  "the path is the shape the schema pins brokers to",
  /^brokers\/[a-z0-9][a-z0-9-]{0,79}\/[0-9a-f]{32}\.(jpg|jpeg|png|webp)$/.test(withImage?.image_path ?? ""),
  String(withImage?.image_path),
);
check("Storage holds the object the row names", (await objects()).includes(withImage?.image_path));
check("the optional fields were kept", withImage?.role === "Retail brokerage" && withImage?.coverage === "Philippines",
  JSON.stringify({ role: withImage?.role, coverage: withImage?.coverage }));
check("its page renders the portrait", (await html("/brokers/" + withImage.id)).includes(withImage.image_path));
check("and the brokers list does too", (await html("/brokers")).includes(withImage.image_path));

/* == D. An account, assigned to that broker ============================ */

heading("D. A retail account, assigned to that broker");

await page.goto(APP + "/retailers/new");
await waitFor(page, "#name");
await fill(page, "#name", RETAILER);
await fill(page, "#shortName", "ZZ");
await fill(page, "#channel", "Supermarket");
await fill(page, "#assignedBrokerId", withImage.id);
await fill(page, "#tier", "Tier 1");
await fill(page, "#priority", "High");
await fill(page, "#fit", "High");
await page.attachFile("#image", LOGO);
line(await submit(page, 40000));

const account = (await q(`select * from retailers where name = $1`, [RETAILER]))[0];
check("the row is in Postgres", Boolean(account), "nothing was written");
if (!account) {
  console.log(bad("\n  No account was created. Stopping.\n"));
  await removeTemp(); await page.close(); await db.close();
  fs.rmSync(scratch, { recursive: true, force: true });
  process.exit(1);
}
check("client_id is the workspace", account.client_id === "client", String(account.client_id));
check("assigned_broker_id points at the broker just created",
  account.assigned_broker_id === withImage.id, String(account.assigned_broker_id));
check("the defaults landed", account.current_target === "Target" && account.standing === "Active",
  JSON.stringify({ target: account.current_target, standing: account.standing }));
check(
  "pipeline_status is stored in the workbook's wording",
  account.pipeline_status === "Not reached out yet", String(account.pipeline_status),
);
check("the optional judgements were kept",
  account.tier === "Tier 1" && account.priority === "High" && account.fit === "High",
  JSON.stringify({ tier: account.tier, priority: account.priority, fit: account.fit }));
check("it carries a logo path",
  /^retailers\/[a-z0-9][a-z0-9-]{0,79}\/[0-9a-f]{32}\.(jpg|jpeg|png|webp)$/.test(account.image_path ?? ""),
  String(account.image_path));
check("Storage holds it", (await objects()).includes(account.image_path));
check("it appears on /retailers immediately", (await html("/retailers")).includes(RETAILER));
check("its own page opens immediately", (await status("/retailers/" + account.id)) === 200);

const accountHtml = await html("/retailers/" + account.id);
check("its page renders the logo", accountHtml.includes(account.image_path));
/* The full round trip for a lookup-backed optional: chosen on the form,
   validated against lookup_tier, stored, read back, and on the screen. */
check("the tier chosen on the form is on the page", accountHtml.includes("Tier 1"),
  "the tier was stored but never displayed");
check("so is the priority", accountHtml.includes("High"));

/* The whole point of the ordering: an account is readable through its broker. */
check("the broker's page now lists the account",
  (await html("/brokers/" + withImage.id)).includes(RETAILER));

/* == E. What the forms refuse ========================================== */

heading("E. What the forms refuse");

const brokersBefore = (await q(`select count(*)::int as n from brokers`))[0].n;

await page.goto(APP + "/brokers/new");
await waitFor(page, "#name");
await fill(page, "#name", PLAIN_BROKER);
await fill(page, "#shortName", "ZZ Duplicate");
const dupBroker = await submit(page, 40000);
check("refused: a broker name already on the books", dupBroker.startsWith("REJECTED"), dupBroker);
line(dim(dupBroker));

await page.goto(APP + "/brokers/new");
await waitFor(page, "#name");
await fill(page, "#name", "ZZ Check Bad Email");
await fill(page, "#shortName", "ZZ Bad");
await fill(page, "#email", "not-an-address");
const badEmail = await submit(page, 40000);
check("refused: something that is not an email address", badEmail.startsWith("REJECTED"), badEmail);
line(dim(badEmail));

const retailersBefore = (await q(`select count(*)::int as n from retailers`))[0].n;
await page.goto(APP + "/retailers/new");
await waitFor(page, "#name");
await fill(page, "#name", RETAILER);
await fill(page, "#shortName", "ZZ Dup");
await fill(page, "#channel", "Supermarket");
const dupRetailer = await submit(page, 40000);
check("refused: an account already on the books", dupRetailer.startsWith("REJECTED"), dupRetailer);
line(dim(dupRetailer));

check("no refusal created a broker", (await q(`select count(*)::int as n from brokers`))[0].n === brokersBefore);
check("no refusal created an account", (await q(`select count(*)::int as n from retailers`))[0].n === retailersBefore);

/* == F. Unknown ids, and unauthenticated callers ======================= */

heading("F. Unknown ids, and callers with no session");

check("an unknown broker id is 404, not 500", (await status("/brokers/zz-nobody")) === 404);
check("an unknown account id is 404, not 500", (await status("/retailers/zz-nowhere")) === 404);

for (const route of ["/brokers/new", "/retailers/new"]) {
  const response = await fetch(APP + route, {
    method: "POST",
    headers: { "next-action": "0".repeat(40), "content-type": "text/plain" },
    body: "[]",
    redirect: "manual",
  });
  check(`a server action at ${route} refuses a caller with no session`, response.status === 401, String(response.status));
}

/* == G. Put the database back ========================================== */

heading("G. Cleaning up after this check");

const removed = await removeTemp();
const madeObjects = [...removed.brokers, ...removed.retailers]
  .map((r) => r.image_path).filter(Boolean);
line(`removed ${removed.brokers.length} broker(s) and ${removed.retailers.length} account(s)`);

/* The rows are gone, so the objects they pointed at are now orphans. Take
   them out through Storage's own API, the way the portal does. */
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

check(
  "every product that was here before is still here, unchanged",
  afterProducts.length === beforeProducts.length &&
    beforeProducts.every((b) =>
      afterProducts.some((a) => a.id === b.id && a.item_id === b.item_id && a.name === b.name && a.image_path === b.image_path)),
  JSON.stringify(afterProducts),
);
check("no broker of this check's own is left", afterBrokers.length === beforeBrokers.length, JSON.stringify(afterBrokers));
check("no account of this check's own is left", afterRetailers.length === beforeRetailers.length, JSON.stringify(afterRetailers));
check("the bucket is back where it started", (await objects()).length === beforeObjects.length, JSON.stringify(await objects()));

await page.close();
await db.close();
fs.rmSync(scratch, { recursive: true, force: true });
console.log(`\n  ${failures === 0 ? ok("A broker and an account can be added through the portal.") : bad(failures + " failed")}\n`);
process.exit(failures ? 1 : 0);
