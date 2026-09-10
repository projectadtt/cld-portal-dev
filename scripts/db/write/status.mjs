/**
 * Moving an account along the pipeline, through the real form.
 *
 *   node scripts/db/write/status.mjs
 *
 *   A. what is already here, and must still be here at the end
 *   B. a test account to move
 *   C. the edit page offers what the portal can draw, and nothing more
 *   D. moving it — the column, the wording bridge, and every screen
 *   E. a tampered request carrying a status the portal cannot render
 *   F. unknown ids, and a caller with no session
 *   G. everything this check made is removed again
 *
 * Section E is the one that matters. lookup_pipeline_status holds sixteen
 * values; the portal knows how to render eleven. A row set to one of the other
 * five is refused by `must()` on the very next render and takes every screen
 * down — so the write layer has to refuse it first, whatever the browser sends.
 *
 * Safe to run against the working database. Every record it creates is named
 * so nobody could mistake it for business data, and all of them are taken back
 * out at the end. It reads existing records but changes none of them.
 */
import { connect, ok, bad, dim, heading } from "../client.mjs";
import { launch, signIn, submit, waitFor, fill } from "./browser.mjs";

const APP = process.env.APP_URL ?? "http://127.0.0.1:3100";

const ACCOUNT = "ZZ Status Check Account";

/** The eleven the portal can draw. */
const SUPPORTED = [
  "Not reached out yet", "Intro planned", "Reached out - waiting for response",
  "Asked for meeting", "Meeting scheduled", "Meeting completed",
  "Samples requested", "Samples sent", "Samples reviewed",
  "Pricing requested", "Pricing submitted",
];

/** The five it cannot, which must never reach a retailers row. */
const UNSUPPORTED = [
  "Line review / category review", "Buyer evaluating",
  "Approved / onboarding", "Live - online", "Live - stores",
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

const removeTemp = () =>
  q(`delete from retailers where name = $1 returning id`, [ACCOUNT]);

/* == A. What is already here =========================================== */

heading("A. What is already in this database");

const beforeProducts = await q(`select id, item_id, name, image_path from products order by id`);
const beforeBrokers = await q(`select id, name from brokers order by id`);
const beforeRetailers = await q(
  `select id, name, current_target, pipeline_status, standing from retailers order by id`);

line(dim(`${beforeProducts.length} product(s), ${beforeBrokers.length} broker(s), ${beforeRetailers.length} account(s)`));
for (const r of beforeRetailers) line(dim(`  ${r.name} — ${r.pipeline_status}`));

const stale = await removeTemp();
if (stale.length) line(dim(`cleared ${stale.length} leftover row(s) from an earlier run`));

({ cookie } = await signIn(page, APP));
line("signed in through the form at /login");

/* == B. A test account to move ========================================= */

heading("B. A test account to move");

await page.goto(APP + "/retailers/new");
await waitFor(page, "#name");
await fill(page, "#name", ACCOUNT);
await fill(page, "#shortName", "ZZ Status");
await fill(page, "#channel", "Supermarket");
line(await submit(page, 40000));

const created = (await q(`select * from retailers where name = $1`, [ACCOUNT]))[0];
check("the account exists", Boolean(created), "nothing was written");
if (!created) {
  console.log(bad("\n  No account to move. Stopping.\n"));
  await removeTemp(); await page.close(); await db.close();
  process.exit(1);
}
check("it starts at 'Not reached out yet'", created.pipeline_status === "Not reached out yet", created.pipeline_status);
check("its standing starts Active", created.standing === "Active", created.standing);

const detail = "/retailers/" + created.id;
const edit = detail + "/edit";

/* == C. What the edit page offers ====================================== */

heading("C. What the edit page offers");

check("the account page links to it", (await html(detail)).includes(edit));
check("the edit page opens", (await status(edit)) === 200);

const editHtml = await html(edit);
for (const value of SUPPORTED) {
  check(`offers "${value}"`, editHtml.includes(`value="${value}"`), "missing from the form");
}
for (const value of UNSUPPORTED) {
  const shown = editHtml.includes(`value="${value.replace(/&/g, "&amp;")}"`) || editHtml.includes(`value="${value}"`);
  check(`does not offer "${value}"`, !shown, "the portal cannot render this");
}
check("no name field — this form cannot rename an account", !editHtml.includes('id="name"'));
check("no image field — this form cannot touch the logo", !editHtml.includes('id="image"'));
check("no broker field — this form cannot reassign the account", !editHtml.includes('id="assignedBrokerId"'));

/* == D. Moving it ====================================================== */

heading("D. Moving it along the pipeline");

/* The wording bridge in one move: the portal shows "waiting FOR response",
   the column stores "waiting ON response". */
await page.goto(APP + edit);
await waitFor(page, "#pipelineStatus");
await fill(page, "#pipelineStatus", "Reached out - waiting for response");
await fill(page, "#currentTarget", "Target");
await fill(page, "#standing", "Follow-up required");
line(await submit(page, 40000));

const moved = (await q(`select * from retailers where id = $1`, [created.id]))[0];
check(
  "the column holds the workbook's wording",
  moved.pipeline_status === "Reached out - waiting on response",
  moved.pipeline_status,
);
check("the standing changed too", moved.standing === "Follow-up required", moved.standing);
check("the current / target is unchanged", moved.current_target === "Target", moved.current_target);

/* Nothing outside the three fields may have moved. */
check("the name is untouched", moved.name === created.name);
check("the channel is untouched", moved.channel === created.channel);
check("the logo is untouched", moved.image_path === created.image_path);
check("the broker is untouched", moved.assigned_broker_id === created.assigned_broker_id);
check("the tier is untouched", moved.tier === created.tier);

/* The read layer has to accept what the write layer just stored. */
const movedHtml = await html(detail);
check("the account page renders after the move", (await status(detail)) === 200);
check(
  "and shows the portal's own wording",
  movedHtml.includes("Reached out - waiting for response"),
  "the read-side bridge did not translate it back",
);
check("the new standing is on the page", movedHtml.includes("Follow-up required"));

for (const screen of ["/", "/workstream", "/retailers", "/reports", "/brokers", "/actions"]) {
  check(`${screen} renders with the moved account`, (await status(screen)) === 200);
}

/* == E. A tampered request ============================================= */

heading("E. A request carrying a status the portal cannot render");

await page.goto(APP + edit);
await waitFor(page, "#pipelineStatus");

/* The form does not offer it, so the option is added to the DOM first — which
   is exactly what a tampered request looks like from the server's side. */
const injected = await page.evaluate(`
  const select = document.querySelector('#pipelineStatus');
  const option = document.createElement('option');
  option.value = 'Live - stores';
  option.textContent = 'Live - stores';
  select.appendChild(option);
  select.value = 'Live - stores';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return select.value;
`);
check("the browser now holds an unsupported status", injected === "Live - stores", String(injected));
line(await submit(page, 40000));

const afterTamper = (await q(`select pipeline_status from retailers where id = $1`, [created.id]))[0];
check(
  "the write layer refused it",
  afterTamper.pipeline_status === "Reached out - waiting on response",
  `the column now holds "${afterTamper.pipeline_status}" — every screen would 500`,
);
check("the account page still renders", (await status(detail)) === 200);
check("and the Overview still renders", (await status("/")) === 200);

/* == F. Unknown ids, and a caller with no session ====================== */

heading("F. Unknown ids, and a caller with no session");

check("an unknown account's edit page is 404, not 500", (await status("/retailers/no-such-account/edit")) === 404);
check("an unknown account is still 404", (await status("/retailers/no-such-account")) === 404);

const signedOut = await fetch(APP + edit, { redirect: "manual" });
check("the edit page turns a signed-out visitor away",
  signedOut.status === 307 || signedOut.status === 302, String(signedOut.status));

const action = await fetch(APP + detail + "/edit", {
  method: "POST",
  headers: { "next-action": "x", "content-type": "text/plain" },
  body: "",
  redirect: "manual",
});
check("the server action refuses a stranger", action.status === 401, String(action.status));

/* == G. Putting it back =============================================== */

heading("G. Putting it back");

const removed = await removeTemp();
line(`removed ${removed.length} account(s)`);

const afterProducts = await q(`select id, item_id, name, image_path from products order by id`);
const afterBrokers = await q(`select id, name from brokers order by id`);
const afterRetailers = await q(
  `select id, name, current_target, pipeline_status, standing from retailers order by id`);

check("the products are exactly as they were",
  JSON.stringify(afterProducts) === JSON.stringify(beforeProducts));
check("the brokers are exactly as they were",
  JSON.stringify(afterBrokers) === JSON.stringify(beforeBrokers));
check("every existing account is exactly as it was — status included",
  JSON.stringify(afterRetailers) === JSON.stringify(beforeRetailers),
  JSON.stringify(afterRetailers));

await page.close();
await db.close();

console.log(
  failures === 0
    ? `\n${ok("All checks passed.")} An account can be moved, and cannot be moved somewhere unrenderable.\n`
    : `\n${bad(failures + " check(s) failed.")}\n`,
);
process.exit(failures === 0 ? 0 : 1);
