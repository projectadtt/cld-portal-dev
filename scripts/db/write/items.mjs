/**
 * Working a product into an account, and reading it back while it is bare.
 *
 *   node scripts/db/write/items.mjs
 *
 *   A. what is already here, and must still be here at the end
 *   B. a throwaway account and the pairing made through the real form
 *   C. the bare pairing on every screen that reads it
 *   D. what the picker and the write layer refuse
 *   E. an unassigned account — no broker, no owner
 *   F. a bad lookup value is still a loud error
 *   G. the pairing can then be moved on, and its step cleared again
 *   H. unknown ids, and a caller with no session
 *   I. everything this check made is removed again
 *
 * Section C is the reason this exists. Every optional column on
 * workstream_items is nullable, and a pairing just created has all of them
 * empty: no fit, no doors, no velocity, no dated step, and — if the account is
 * unassigned — no broker or owner either. That record has to render everywhere.
 *
 * Safe to run against the working database. Every record it creates is named
 * so nobody could mistake it for business data, and all of them are taken back
 * out at the end. It reads existing records but changes none of them.
 */
import { connect, ok, bad, dim, heading } from "../client.mjs";
import { launch, signIn, submit, waitFor, fill } from "./browser.mjs";

const APP = process.env.APP_URL ?? "http://127.0.0.1:3100";

const ACCOUNT = "ZZ Item Check Account";
const BARE_ACCOUNT = "ZZ Item Check Unassigned";

/* Every screen that reads a workstream item, directly or as a roll-up. */
const SCREENS = [
  "/", "/retailers", "/workstream", "/brokers", "/products",
  "/actions", "/activity", "/meetings", "/reports", "/market-insights",
];

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

/** Items cascade from the retailer, so removing the accounts is enough. */
const removeTemp = () =>
  q(`delete from retailers where name = any($1) returning id`, [[ACCOUNT, BARE_ACCOUNT]]);

/* == A. What is already here =========================================== */

heading("A. What is already in this database");

const beforeProducts = await q(`select id, item_id, name, image_path from products order by id`);
const beforeBrokers = await q(`select id, name from brokers order by id`);
const beforeRetailers = await q(
  `select id, name, pipeline_status, standing from retailers order by id`);
const beforeItems = await q(`select id, retailer_id, product_id from workstream_items order by id`);

line(dim(`${beforeProducts.length} product(s), ${beforeBrokers.length} broker(s), ${beforeRetailers.length} account(s), ${beforeItems.length} item(s)`));

const stale = await removeTemp();
if (stale.length) line(dim(`cleared ${stale.length} leftover account(s) from an earlier run`));

({ cookie } = await signIn(page, APP));
line("signed in through the form at /login");

const product = beforeProducts[0];
if (!product) {
  console.log(bad("\n  No product to pair with. Stopping.\n"));
  await page.close(); await db.close();
  process.exit(1);
}
line(dim(`pairing against ${product.item_id} ${product.name}`));

/* == B. An account, and a pairing ====================================== */

heading("B. An account, and a pairing made through the real form");

const broker = beforeBrokers[0];

await page.goto(APP + "/retailers/new");
await waitFor(page, "#name");
await fill(page, "#name", ACCOUNT);
await fill(page, "#shortName", "ZZ Item");
await fill(page, "#channel", "Supermarket");
if (broker) await fill(page, "#assignedBrokerId", broker.id);
line(await submit(page, 40000));

const account = (await q(`select * from retailers where name = $1`, [ACCOUNT]))[0];
check("the account exists", Boolean(account), "nothing was written");
if (!account) {
  console.log(bad("\n  No account to pair against. Stopping.\n"));
  await removeTemp(); await page.close(); await db.close();
  process.exit(1);
}

const detail = "/retailers/" + account.id;

check("its workstream is empty", (await html(detail)).includes("No items have been worked into"));
check("and it offers a way to start", (await html(detail)).includes(detail + "/items/new"));

await page.goto(APP + detail + "/items/new");
await waitFor(page, "#productId");
const pickerHtml = await html(detail + "/items/new");
check("the picker lists the item by its workbook number",
  pickerHtml.includes(product.item_id + " · " + product.name), "item number missing from the option");
check("the form asks for nothing but the item",
  !pickerHtml.includes('id="fit"') && !pickerHtml.includes('id="nextAction"') &&
  !pickerHtml.includes('id="estimatedDoors"'),
  "the create form is asking someone to invent something");

await fill(page, "#productId", product.id);
line(await submit(page, 40000));

const item = (await q(
  `select * from workstream_items where retailer_id = $1 and product_id = $2`,
  [account.id, product.id]))[0];
check("the pairing is in Postgres", Boolean(item), "nothing was written");
if (!item) {
  console.log(bad("\n  No item was created. Stopping.\n"));
  await removeTemp(); await page.close(); await db.close();
  process.exit(1);
}

check("item_status took the database default", item.item_status === "Not pitched", item.item_status);
check("current_target took the database default", item.current_target === "Target", item.current_target);
check("fit was not guessed", item.fit === null, String(item.fit));
check("no door count was invented", item.estimated_doors === null, String(item.estimated_doors));
check("no velocity was invented", item.units_per_store_week === null, String(item.units_per_store_week));
check("no next step was invented", item.next_action === null, String(item.next_action));
check("no date was invented", item.next_action_date === null, String(item.next_action_date));
check("no notes were invented", item.notes === null, String(item.notes));
if (broker) {
  check("the broker was inherited from the account", item.broker_id === broker.id, String(item.broker_id));
  check("and so was the owner", item.owner_id === broker.id, String(item.owner_id));
}
check("no sample was created", (await q(
  `select 1 from samples where workstream_item_id = $1`, [item.id])).length === 0);
check("no buyer feedback was created", (await q(
  `select 1 from buyer_feedback where workstream_item_id = $1`, [item.id])).length === 0);
check("no action was created", (await q(
  `select 1 from actions where workstream_item_id = $1`, [item.id])).length === 0);
check("it was not marked Pitched", item.item_status !== "Pitched");

/* == C. The bare pairing, everywhere =================================== */

heading("C. The bare pairing on every screen that reads it");

for (const screen of SCREENS) {
  check(`${screen} renders`, (await status(screen)) === 200);
}
check(`${detail} renders`, (await status(detail)) === 200);
check(`its item workspace renders`, (await status(detail + "/items/" + item.id)) === 200);
check(`/products/${product.id} renders`, (await status("/products/" + product.id)) === 200);

const pages = {
  account: await html(detail),
  item: await html(detail + "/items/" + item.id),
  product: await html("/products/" + product.id),
  workstream: await html("/workstream"),
};

for (const [name, body] of Object.entries(pages)) {
  check(`the ${name} page prints no "undefined"`, !body.includes(">undefined<"), "undefined leaked");
  check(`the ${name} page prints no "null"`, !body.includes(">null<"), "null leaked");
  check(`the ${name} page prints no NaN`, !body.includes("NaN"), "NaN leaked");
}

check("the account lists the item", pages.account.includes(product.name));
check("it reads as Not pitched", pages.account.includes("Not pitched"));
check("the product's own page names the account", pages.product.includes(ACCOUNT));
check("an unrecorded fit says so", pages.product.includes("Not recorded"), "fit rendered as something");
check("no door count was rendered as nought",
  !pages.product.includes(">0<"), "an absent estimate rendered as zero");
check("the workstream shows the pairing", pages.workstream.includes(ACCOUNT));

/* == D. What is refused =============================================== */

heading("D. What the picker and the write layer refuse");

const pickerAgain = await html(detail + "/items/new");
check("the picker no longer offers the item it already has",
  !pickerAgain.includes('value="' + product.id + '"'), "a duplicate pairing is still offered");

/* The unique constraint, exercised past the picker. */
let duplicate = null;
try {
  await q(`insert into workstream_items (id, retailer_id, product_id) values ($1, $2, $3)`,
    ["ws-zz-dupe", account.id, product.id]);
} catch (error) {
  duplicate = error.constraint ?? error.code;
}
check("the database refuses a duplicate pairing",
  duplicate === "workstream_items_pair_unique", String(duplicate));

const itemCount = (await q(`select count(*)::int n from workstream_items`))[0].n;
check("no duplicate row was created", itemCount === beforeItems.length + 1, String(itemCount));

/* == E. An unassigned account ========================================== */

heading("E. An account with no broker — no broker, no owner on the item");

await page.goto(APP + "/retailers/new");
await waitFor(page, "#name");
await fill(page, "#name", BARE_ACCOUNT);
await fill(page, "#shortName", "ZZ Bare");
await fill(page, "#channel", "Convenience");
line(await submit(page, 40000));

const bare = (await q(`select * from retailers where name = $1`, [BARE_ACCOUNT]))[0];
check("the unassigned account exists", Boolean(bare));
if (bare) {
  check("it has no broker", bare.assigned_broker_id === null, String(bare.assigned_broker_id));

  await page.goto(APP + "/retailers/" + bare.id + "/items/new");
  await waitFor(page, "#productId");
  await fill(page, "#productId", product.id);
  line(await submit(page, 40000));

  const bareItem = (await q(
    `select * from workstream_items where retailer_id = $1`, [bare.id]))[0];
  check("the pairing exists", Boolean(bareItem));
  if (bareItem) {
    check("broker_id stayed NULL", bareItem.broker_id === null, String(bareItem.broker_id));
    check("owner_id stayed NULL", bareItem.owner_id === null, String(bareItem.owner_id));

    const bareHtml = await html("/retailers/" + bare.id);
    check("the account still renders", (await status("/retailers/" + bare.id)) === 200);
    check("its item workspace renders",
      (await status("/retailers/" + bare.id + "/items/" + bareItem.id)) === 200);
    check("the ownerless item reads Unassigned", bareHtml.includes("Unassigned"));
    check("the product page still renders", (await status("/products/" + product.id)) === 200);
    check("and the workstream still renders", (await status("/workstream")) === 200);
    check("the Overview still renders", (await status("/")) === 200);
  }
}

/* == F. A bad lookup value is still loud =============================== */

heading("F. A non-NULL value outside the vocabulary is still a loud error");

/* Straight into the column, past every form: what the read layer does with a
   value it cannot render must not change just because NULL is now allowed. */
await q(
  `insert into lookup_fit (value, display_label, sort_order)
   values ('ZZ Nonsense', 'ZZ Nonsense', 9999) on conflict do nothing`);
await q(`update workstream_items set fit = 'ZZ Nonsense' where id = $1`, [item.id]);

const loud = await status(detail);
check("the account page fails loudly rather than rendering nonsense",
  loud === 500, `expected 500, got ${loud} — an unrenderable value was swallowed`);

await q(`update workstream_items set fit = null where id = $1`, [item.id]);
await q(`delete from lookup_fit where value = 'ZZ Nonsense'`);
check("and recovers once the value is cleared", (await status(detail)) === 200);

/* == G. Moving it on, and clearing the step again ====================== */

heading("G. The pairing can be moved on, and its step cleared again");

const workspace = detail + "/items/" + item.id;
await page.goto(APP + workspace);
await waitFor(page, "#itemStatus");
await fill(page, "#itemStatus", "Pitched");
await fill(page, "#nextAction", "Send the calamansi sample");
await fill(page, "#nextActionDate", "2026-10-01");
line(await submit(page, 40000));

const pitched = (await q(`select * from workstream_items where id = $1`, [item.id]))[0];
check("the item is now Pitched", pitched.item_status === "Pitched", pitched.item_status);
check("the next step was recorded", pitched.next_action === "Send the calamansi sample", String(pitched.next_action));
check("with its date", String(pitched.next_action_date).startsWith("2026-10-01") ||
  pitched.next_action_date instanceof Date, String(pitched.next_action_date));
check("the account page shows it", (await html(detail)).includes("Send the calamansi sample"));

/* The loosened rule: an item may go back to having no planned step, but not
   to half of one. */
await page.goto(APP + workspace);
await waitFor(page, "#nextAction");
await fill(page, "#nextAction", "");
await fill(page, "#nextActionDate", "");
line(await submit(page, 40000));

const cleared = (await q(`select * from workstream_items where id = $1`, [item.id]))[0];
check("an empty next step is accepted", cleared.next_action === null, String(cleared.next_action));
check("and its date is cleared with it", cleared.next_action_date === null, String(cleared.next_action_date));
check("the item is still Pitched", cleared.item_status === "Pitched", cleared.item_status);
check("the account page still renders", (await status(detail)) === 200);

await page.goto(APP + workspace);
await waitFor(page, "#nextAction");
await fill(page, "#nextAction", "");
await fill(page, "#nextActionDate", "2026-10-05");
line(await submit(page, 40000));

const halfStep = (await q(`select * from workstream_items where id = $1`, [item.id]))[0];
check("half a next step is refused", halfStep.next_action_date === null,
  `a date was stored with no step: ${halfStep.next_action_date}`);

/* == H. Unknown ids, and a caller with no session ====================== */

heading("H. Unknown ids, and a caller with no session");

check("an unknown account's item picker is 404",
  (await status("/retailers/no-such-account/items/new")) === 404);
check("an unknown item is 404", (await status(detail + "/items/no-such-item")) === 404);
check("an item under the wrong account is 404",
  (await status("/retailers/" + (bare?.id ?? "x") + "/items/" + item.id)) === 404);

const signedOut = await fetch(APP + detail + "/items/new", { redirect: "manual" });
check("the picker turns a signed-out visitor away",
  signedOut.status === 307 || signedOut.status === 302, String(signedOut.status));

const action = await fetch(APP + detail + "/items/new", {
  method: "POST",
  headers: { "next-action": "x", "content-type": "text/plain" },
  body: "",
  redirect: "manual",
});
check("the server action refuses a stranger", action.status === 401, String(action.status));

/* == I. Putting it back =============================================== */

heading("I. Putting it back");

const removed = await removeTemp();
line(`removed ${removed.length} account(s), and the items that cascade from them`);

const afterProducts = await q(`select id, item_id, name, image_path from products order by id`);
const afterBrokers = await q(`select id, name from brokers order by id`);
const afterRetailers = await q(
  `select id, name, pipeline_status, standing from retailers order by id`);
const afterItems = await q(`select id, retailer_id, product_id from workstream_items order by id`);

check("the products are exactly as they were",
  JSON.stringify(afterProducts) === JSON.stringify(beforeProducts));
check("the brokers are exactly as they were",
  JSON.stringify(afterBrokers) === JSON.stringify(beforeBrokers));
check("every existing account is exactly as it was",
  JSON.stringify(afterRetailers) === JSON.stringify(beforeRetailers));
check("no workstream item of this check's own is left",
  JSON.stringify(afterItems) === JSON.stringify(beforeItems), JSON.stringify(afterItems));
check("no orphan lookup row is left",
  (await q(`select 1 from lookup_fit where value = 'ZZ Nonsense'`)).length === 0);
check("the Overview renders at the end", (await status("/")) === 200);

await page.close();
await db.close();

console.log(
  failures === 0
    ? `\n${ok("All checks passed.")} A bare pairing can be made and read everywhere, and nothing was left behind.\n`
    : `\n${bad(failures + " check(s) failed.")}\n`,
);
process.exit(failures === 0 ? 0 : 1);
