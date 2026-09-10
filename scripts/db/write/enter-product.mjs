/**
 * Enters one real product through the portal, by hand, in a browser.
 *
 *   node scripts/db/write/enter-product.mjs
 *
 * Not a fixture and not a seed: this fills in the form on /products/new and
 * presses the button, exactly as a person would. It exists so the first
 * record in the database can be demonstrated to have arrived that way.
 *
 * Every value comes from the archived product source kept outside this
 * repository. Nothing here is invented.
 */
import pg from "pg";

import { loadEnv, pgOptions } from "../env.mjs";
import { fill, launch, submit, waitFor } from "./browser.mjs";

loadEnv();

const APP = process.env.APP_URL ?? "http://127.0.0.1:3100";

const PRODUCT = {
  name: "Organic Edamame Protein Pasta",
  itemId: "7G-201",
  category: "LowCarb / Protein",
  packSize: "7.05 oz box",
  positioning:
    "Single-ingredient organic edamame. High protein, high fibre, naturally low carb.",
  upc: "860000000201",
  sourceNotes:
    "Strongest sample reaction to date. Protein claim needs front-of-pack work.",
  fobCost: "2.40",
  landedCost: "3.20",
  suggestedRetail: "7.99",
  moq: "600",
  casePack: "6",
  leadTimeDays: "70",
};

const db = new pg.Client(pgOptions());
await db.connect();

const [{ n: clients }] = (await db.query(`select count(*)::int as n from clients`)).rows;
if (clients === 0) {
  console.error("No workspace yet. Set one up on the portal's first screen.");
  process.exit(1);
}

const existing = await db.query(
  `select id from products where item_id = $1 and archived_at is null`,
  [PRODUCT.itemId],
);
if (existing.rowCount) {
  console.log(`${PRODUCT.itemId} is already on the range as ${existing.rows[0].id}.`);
  await db.end();
  process.exit(0);
}

const page = await launch();
await page.goto(APP + "/products/new");
await waitFor(page, "#name");

for (const [field, value] of Object.entries(PRODUCT)) {
  await fill(page, "#" + field, value);
}
await fill(page, "#readiness", "Retail ready");

const outcome = await submit(page, 25000);
console.log("  " + outcome);

const { rows } = await db.query(
  `select id, item_id, name, category, landed_cost, suggested_retail,
          round(((suggested_retail - landed_cost) / suggested_retail) * 100) as margin_pct
     from products where item_id = $1`,
  [PRODUCT.itemId],
);
console.log("  stored:", JSON.stringify(rows[0]));

await page.close();
await db.end();
process.exit(rows.length === 1 ? 0 : 1);
