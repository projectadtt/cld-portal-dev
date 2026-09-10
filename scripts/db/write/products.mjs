/**
 * The database-first foundation, driven the way a person drives it.
 *
 *   node scripts/db/write/products.mjs
 *
 *   A. an empty portal renders, and asks to be set up
 *   B. the workspace is created through the form
 *   C. a product is created, read, edited and archived through the UI
 *   D. what the write layer refuses
 *
 * Nothing is seeded. Every row this test leaves behind arrived through a form
 * in a browser, which is the whole claim being made.
 */
import pg from "pg";

import { loadEnv, pgOptions } from "../env.mjs";
import { fill, launch, submit, waitFor } from "./browser.mjs";

loadEnv();
pg.types.setTypeParser(1082, (v) => v); /* dates are calendar days, not instants */

const APP = process.env.APP_URL ?? "http://127.0.0.1:3100";

const db = new pg.Client(pgOptions());
await db.connect();
const q = async (sql, params) => (await db.query(sql, params)).rows;

const line = (s) => console.log(s);
const head = (s) => console.log("\n\x1b[1m" + s + "\x1b[0m\n" + "-".repeat(s.length));
let failures = 0;
const check = (label, condition, detail = "") => {
  if (condition) line(`  \x1b[32mpass\x1b[0m  ${label}`);
  else { failures++; line(`  \x1b[31mFAIL\x1b[0m  ${label}  \x1b[2m${detail}\x1b[0m`); }
};

const html = async (path) => (await fetch(APP + path)).text();
const status = async (path) => (await fetch(APP + path)).status;

/**
 * --products-only skips the two sections that need a first-run portal, for
 * running the product checks against a database that already has a workspace.
 * Everything from C onwards is unchanged, so the product path is tested by the
 * same assertions either way.
 */
const productsOnly = process.argv.includes("--products-only");

const page = await launch();

/* == A. An empty portal ================================================ */
if (!productsOnly) {

head("A. An empty portal");

const before = await q(
  `select (select count(*)::int from clients) as clients,
          (select count(*)::int from products) as products`,
);
check("the database starts with no client and no products",
  before[0].clients === 0 && before[0].products === 0, JSON.stringify(before[0]));

for (const path of [
  "/", "/products", "/retailers", "/brokers", "/workstream",
  "/market-insights", "/meetings", "/actions", "/reports", "/activity",
]) {
  check(`${path} renders`, (await status(path)) === 200);
}

const setup = await html("/");
check("the overview asks for the workspace rather than showing figures",
  setup.includes("Set up the workspace"), "first-run screen not found");
check("no demo disclaimer is shown before a workspace exists",
  !setup.includes("Illustrative demo data"));

for (const [path, phrase] of Object.entries({
  "/products": "No products yet",
  "/retailers": "No retailers in the pipeline yet",
  "/brokers": "No brokers assigned yet",
  "/workstream": "No retail work is active yet",
})) {
  check(`${path} says "${phrase}"`, (await html(path)).includes(phrase));
}

}

/* == B. Creating the workspace ========================================= */

head("B. Creating the workspace");

const CLIENT = "Bebesup";
let outcome = "skipped — this database already has a workspace";
if (!productsOnly) {
  await page.goto(APP + "/");
  await waitFor(page, "#name");
  await fill(page, "#name", CLIENT);
  await fill(page, "#workspace", "Retail Growth");
  await fill(page, "#category", "Better-for-you grocery");
  outcome = await submit(page);
}
line(`  ${outcome}`);

const clients = await q(`select id, name, workspace, category, is_demo from clients`);
check("one client row exists", clients.length === 1, JSON.stringify(clients));
check("it holds what was typed",
  clients[0]?.name === CLIENT && clients[0]?.workspace === "Retail Growth",
  JSON.stringify(clients[0]));
check("it is not flagged as a demo workspace, because the box was not ticked",
  clients[0]?.is_demo === false);

if (!productsOnly) {
  const overview = await html("/");
  check("the overview is now the portal, not the setup screen",
    !overview.includes("Set up the workspace") && overview.includes(CLIENT));
}
check("the sidebar names the client", (await html("/products")).includes("Retail Growth"));

/* == C. A product, entered through the portal =========================== */

head("C. Create, read, edit, archive");

const PRODUCT = {
  name: "Organic Edamame Protein Pasta",
  itemId: "7G-201",
  category: "Pasta & noodles",
  packSize: "7.05 oz box",
  positioning: "Single-ingredient organic edamame. High protein, high fibre, naturally low carb.",
};

check("the products screen offers a way in",
  (await html("/products")).includes("/products/new"));

await page.goto(APP + "/products/new");
await waitFor(page, "#name");
for (const [field, value] of Object.entries(PRODUCT)) {
  await fill(page, "#" + field, value);
}
await fill(page, "#readiness", "Retail ready");
outcome = await submit(page, 25000);
line(`  ${outcome}`);

const rows = await q(
  `select id, client_id, item_id, name, category, pack_size, positioning, readiness,
          fob_cost, landed_cost, suggested_retail, moq, case_pack, lead_time_days,
          upc, archived_at, display_order
     from products`,
);
check("exactly one product row was created", rows.length === 1, JSON.stringify(rows));

const created = rows[0];
check("it carries what was typed",
  created?.name === PRODUCT.name && created?.item_id === PRODUCT.itemId &&
  created?.category === PRODUCT.category && created?.pack_size === PRODUCT.packSize,
  JSON.stringify(created));
check("it belongs to the workspace's client", created?.client_id === clients[0].id);
check("its id is a readable slug", created?.id === "organic-edamame-protein-pasta", created?.id);
check("readiness is what was chosen", created?.readiness === "Retail ready");
check("every commercial field left blank is null, not zero",
  created?.fob_cost === null && created?.landed_cost === null &&
  created?.suggested_retail === null && created?.moq === null &&
  created?.case_pack === null && created?.lead_time_days === null &&
  created?.upc === null,
  JSON.stringify(created));
check("it is not archived", created?.archived_at === null);

/* -- read it back through the portal ---------------------------------- */

const listHtml = await html("/products");
check("the products list shows it", listHtml.includes(PRODUCT.name));
check("the list no longer shows an empty state", !listHtml.includes("No products yet"));

const detailPath = "/products/" + created.id;
check("the product detail opens", (await status(detailPath)) === 200);
const detailHtml = await html(detailPath);
check("the detail shows the record", detailHtml.includes(PRODUCT.name) && detailHtml.includes(PRODUCT.itemId));
check("unrecorded commercial terms read as absent, not as zero",
  detailHtml.includes("Not recorded") && !detailHtml.includes("$0.00"),
  "expected a 'Not recorded' treatment");

/* -- edit one field ---------------------------------------------------- */

const NEW_CATEGORY = "Low-carb staples";
await page.goto(APP + detailPath + "/edit");
await waitFor(page, "#name");
const loaded = await page.evaluate(`
  return {
    name: document.querySelector('#name')?.value,
    itemId: document.querySelector('#itemId')?.value,
    category: document.querySelector('#category')?.value,
    readiness: document.querySelector('#readiness')?.value,
  };
`);
check("the edit form opens on the stored record",
  loaded.name === PRODUCT.name && loaded.itemId === PRODUCT.itemId &&
  loaded.category === PRODUCT.category && loaded.readiness === "Retail ready",
  JSON.stringify(loaded));

await fill(page, "#category", NEW_CATEGORY);
outcome = await submit(page);
line(`  ${outcome}`);

const edited = (await q(`select category, name, item_id, id from products`))[0];
check("the database holds the new category", edited?.category === NEW_CATEGORY);
check("nothing else moved, and the id did not change",
  edited?.name === PRODUCT.name && edited?.item_id === PRODUCT.itemId &&
  edited?.id === created.id, JSON.stringify(edited));
check("the detail page shows the edit", (await html(detailPath)).includes(NEW_CATEGORY));
check("the list shows the edit", (await html("/products")).includes(NEW_CATEGORY));
check("still exactly one product — an edit is not a second row",
  (await q(`select count(*)::int as n from products`))[0].n === 1);

/* -- refusals ---------------------------------------------------------- */

head("D. What the write layer refuses");

await page.goto(APP + "/products/new");
await waitFor(page, "#name");
await fill(page, "#name", "Something else entirely");
await fill(page, "#itemId", PRODUCT.itemId);
await fill(page, "#category", "Pasta & noodles");
outcome = await submit(page);
line(`  ${outcome}`);
check("a duplicate item number is refused", outcome.startsWith("REJECTED"), outcome);

await page.goto(APP + "/products/new");
await waitFor(page, "#name");
await fill(page, "#name", "A third item");
await fill(page, "#itemId", "7G-999");
await fill(page, "#category", "Pasta & noodles");
await fill(page, "#landedCost", "-5");
outcome = await submit(page);
line(`  ${outcome}`);
check("a negative cost is refused", outcome.startsWith("REJECTED"), outcome);

await page.goto(APP + "/products/new");
await waitFor(page, "#name");
await fill(page, "#name", "A fourth item");
await fill(page, "#itemId", "7G-998");
await fill(page, "#category", "Pasta & noodles");
await fill(page, "#upc", "12ab");
outcome = await submit(page);
line(`  ${outcome}`);
check("a UPC that is not digits is refused", outcome.startsWith("REJECTED"), outcome);

check("none of the refusals created a row",
  (await q(`select count(*)::int as n from products`))[0].n === 1);

/* -- archive ----------------------------------------------------------- */

head("E. Archive, not delete");

await page.goto(APP + detailPath + "/edit");
await waitFor(page, "#name");
/* Clicked until the confirmation appears rather than once with a fixed wait.
   Before React has hydrated the click does nothing at all, and how long that
   takes is the one thing a dev server will not promise. */
outcome = await page.evaluate(`
  const find = (text) => [...document.querySelectorAll('button')]
    .find((b) => b.textContent.trim().startsWith(text));

  const deadline = Date.now() + 20000;
  let lastClick = 0;
  while (Date.now() < deadline && !find('Yes, archive')) {
    if (Date.now() - lastClick > 1000) {
      find('Archive this product')?.click();
      lastClick = Date.now();
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  const button = find('Yes, archive');
  if (!button) return "NO CONFIRM BUTTON";

  const settled = Date.now() + 20000;
  let lastConfirm = 0;
  while (Date.now() < settled) {
    if (location.pathname === "/products") return "redirected to /products";
    const confirm = find('Yes, archive');
    if (confirm && !confirm.disabled && Date.now() - lastConfirm > 2500) {
      confirm.click();
      lastConfirm = Date.now();
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return "TIMED OUT at " + location.pathname;
`);
line(`  ${outcome}`);

const archived = (await q(`select id, name, archived_at from products`))[0];
check("the row still exists — nothing was deleted",
  archived !== undefined && archived.id === created.id, JSON.stringify(archived));
check("it is now archived", archived?.archived_at !== null, String(archived?.archived_at));

const afterArchive = await html("/products");
check("it has left the working range", !afterArchive.includes(NEW_CATEGORY));
check("the products screen is back to its empty state",
  afterArchive.includes("No products yet"));
check("its detail route is gone from the active range",
  (await status(detailPath)) === 404, "expected 404 for an archived product");

/* == Result ============================================================= */

head("Result");
const final = await q(
  `select (select count(*)::int from clients) as clients,
          (select count(*)::int from products) as products,
          (select count(*)::int from products where archived_at is null) as active`,
);
line(`  clients=${final[0].clients}  products=${final[0].products}  active=${final[0].active}`);

await page.close();
await db.end();
line(`  ${failures === 0 ? "\x1b[32mall checks passed\x1b[0m" : `\x1b[31m${failures} failed\x1b[0m`}`);
process.exit(failures ? 1 : 0);
