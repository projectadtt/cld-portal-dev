/**
 * Does a write show up on the screen straight away, on the real database?
 *
 *   node scripts/db/write/refresh-check.mjs
 *
 * The question this answers is narrow and was, until recently, answered "no":
 * after a save the database was right and the page was not, until the server
 * was restarted. The cause was a workspace snapshot held for the life of the
 * process, which every re-render read straight through. It is request-scoped
 * now, so this is the check that it stays that way.
 *
 * Safe to run against the working database. It creates one product of its own,
 * with a name nobody would mistake for business data, and removes it at the
 * end — including from Storage's point of view, since it never uploads. It
 * reads existing records but changes none of them.
 */
import { connect, ok, bad, dim, heading } from "../client.mjs";
import { fill, launch, signIn, submit, waitFor } from "./browser.mjs";

const APP = process.env.APP_URL ?? "http://127.0.0.1:3100";

/* Deliberately unmistakable, so a run that dies halfway leaves something
   obviously not real behind. */
const TEMP = {
  name: "ZZ Refresh Check",
  itemId: "ZZ-REFRESH-CHECK",
  category: "Temporary",
};

const db = await connect();
const q = async (sql, params) => db.query(sql, params);

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

/* Set once the browser has signed in. Every read below goes through it: the
   portal is closed, and a suite that read pages without a session would be
   checking the sign-in screen against itself. */
let cookie = "";
const as = () => ({ headers: cookie ? { cookie } : {} });
const html = async (p) => (await fetch(APP + p, as())).text();
const status = async (p) => (await fetch(APP + p, as())).status;

async function removeTemp() {
  const { length } = await q(`delete from products where item_id = $1 returning id`, [TEMP.itemId]);
  return length;
}

/* -- 0. Get through the door -------------------------------------------- */

heading("Signing in");

({ cookie } = await signIn(page, APP));
console.log("  signed in through the form at /login");

/* -- 0b. Leave everything that was already here alone ------------------- */

heading("What is already in this database");

const before = await q(
  `select id, item_id, name, archived_at from products order by id`,
);
const beforeClients = await q(`select id, name, workspace from clients`);
line(dim(`${beforeClients.length} client(s), ${before.length} product(s) — none of these are touched`));
for (const p of before) line(dim(`  ${p.item_id}  ${p.name}${p.archived_at ? "  (archived)" : ""}`));

/* Anything left by a previous interrupted run. */
const stale = await removeTemp();
if (stale) line(dim(`cleared ${stale} leftover row(s) from an earlier run`));

/* -- 1. The workspace ---------------------------------------------------- */

heading("Workspace");

check("a workspace exists in the database", beforeClients.length === 1, JSON.stringify(beforeClients));

const overview = await html("/");
check(
  "the Overview is the portal, not the first-run screen",
  !overview.includes("Set up the workspace"),
  "still showing the setup screen",
);
check(
  "and it names the workspace",
  Boolean(beforeClients[0]) && overview.includes(beforeClients[0].workspace),
);

/* A second, independent request: the refresh a person does to check. */
const refreshed = await html("/");
check(
  "a browser refresh still shows it",
  !refreshed.includes("Set up the workspace") && refreshed.includes(beforeClients[0].workspace),
);

/* -- 2. Create ----------------------------------------------------------- */

heading("Create — visible without a restart");

await page.goto(APP + "/products/new");
await waitFor(page, "#name");
await fill(page, "#name", TEMP.name);
await fill(page, "#itemId", TEMP.itemId);
await fill(page, "#category", TEMP.category);
line(await submit(page, 40000));

const created = (await q(`select id, name, item_id, category, archived_at from products where item_id = $1`, [TEMP.itemId]))[0];
check("the row is in Supabase", Boolean(created), "nothing was written");
if (!created) {
  await page.close();
  await db.close();
  console.log(bad("\n  Nothing was created, so there is nothing to check. Stopping.\n"));
  process.exit(1);
}

const detail = "/products/" + created.id;
check("the products list shows it immediately", (await html("/products")).includes(TEMP.name));
check("its own page opens immediately", (await status(detail)) === 200);
check("and shows the record", (await html(detail)).includes(TEMP.itemId));

/* -- 3. Edit ------------------------------------------------------------- */

heading("Edit — visible without a restart");

const EDITED = "Temporary, edited";
await page.goto(APP + detail + "/edit");
await waitFor(page, "#name");
await fill(page, "#category", EDITED);
line(await submit(page, 40000));

const edited = (await q(`select category from products where item_id = $1`, [TEMP.itemId]))[0];
check("Supabase holds the new value", edited?.category === EDITED, String(edited?.category));
check("the product page shows it immediately", (await html(detail)).includes(EDITED));
check("the list shows it immediately", (await html("/products")).includes(EDITED));

/* -- 4. Archive ---------------------------------------------------------- */

heading("Archive — visible without a restart");

await page.goto(APP + detail + "/edit");
await waitFor(page, "#name");
line(
  await page.evaluate(`
  const find = (text) => [...document.querySelectorAll('button')]
    .find((b) => b.textContent.trim().startsWith(text));

  const ready = Date.now() + 20000;
  let lastClick = 0;
  while (Date.now() < ready && !find('Yes, archive')) {
    if (Date.now() - lastClick > 1000) { find('Archive this product')?.click(); lastClick = Date.now(); }
    await new Promise((r) => setTimeout(r, 150));
  }
  if (!find('Yes, archive')) return "NO CONFIRM BUTTON";

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
`),
);

const archived = (await q(`select archived_at from products where item_id = $1`, [TEMP.itemId]))[0];
check("Supabase records it as archived, not deleted", archived?.archived_at !== null, String(archived?.archived_at));
check("the list drops it immediately", !(await html("/products")).includes(EDITED));
check("its page is gone from the active range immediately", (await status(detail)) === 404);

/* -- 5. Put the database back -------------------------------------------- */

heading("Cleaning up after this check");

const removed = await removeTemp();
line(`removed ${removed} temporary row(s)`);

const after = await q(`select id, item_id, name, archived_at from products order by id`);
check(
  "every record that was here before is still here, unchanged",
  after.length === before.length &&
    before.every((b) =>
      after.some((a) => a.id === b.id && a.item_id === b.item_id && a.name === b.name && String(a.archived_at) === String(b.archived_at)),
    ),
  JSON.stringify(after),
);
check("and nothing of this check's own is left", !after.some((p) => p.item_id === TEMP.itemId));

await page.close();
await db.close();
console.log(`\n  ${failures === 0 ? ok("A write is visible on the next render. No restart.") : bad(failures + " failed")}\n`);
process.exit(failures ? 1 : 0);
