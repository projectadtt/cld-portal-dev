/**
 * Which thing the buyer said counts as the latest one.
 *
 *   node --import ./scripts/db/alias.mjs scripts/db/write/feedback-order.mjs
 *
 *   A. a throwaway database, migrated from supabase/migrations
 *   B. three quotes on one item, two of them said on the same day
 *   C. the old ordering, proved wrong on these rows
 *   D. the read layer, proved right on the same rows
 *   E. the history, still whole and still oldest-first
 *   F. the throwaway database, removed again
 *
 * Section C is the point. `buyer_feedback` is ordered once, in workspace.ts,
 * and `.at(-1)` of that list becomes `WorkstreamRecord.buyerFeedback` — the
 * single quote every summary screen shows. While the tiebreak after
 * occurred_at was `f.id`, two quotes recorded on the same day had their order
 * settled by a random uuid, so the portal would sometimes present the earlier
 * remark as the buyer's current position. Two quotes in one day is ordinary,
 * not an edge case.
 *
 * The fixture is built to defeat the old ordering every run rather than half
 * the time: the row inserted first is given the *highest* uuid, so sorting by
 * id puts it last and `.at(-1)` returns the stale quote. Under the ordering
 * this suite guards, created_at decides and the newest quote wins.
 *
 * WHY PGLITE, AND NOT THE WORKING DATABASE
 * buyer_feedback carries no_update and no_delete triggers (0007), and a
 * cascade delete from workstream_items fires them too — so feedback rows
 * written for a test cannot be taken back out again, and a suite like this
 * one would leave permanent junk in the buyer's history. There is a session
 * escape hatch (cld.allow_history_write) and this suite deliberately does not
 * use it. It builds its own Postgres instead, applies the real migrations to
 * it, and deletes the whole thing at the end.
 *
 * This file never reads .env and never imports scripts/db/client.mjs, which
 * would load it. No production credential enters this process: the only
 * DATABASE_URL it knows is the local socket it started itself.
 */

import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");
const SCRATCH = path.join(ROOT, ".db", "feedback-order");

/* Local copies rather than an import from client.mjs, whose module body calls
   loadEnv() and would put the working database's credentials into this
   process. Four escape codes are a cheap price for that guarantee. */
const ok = (s) => `\x1b[32m${s}\x1b[0m`;
const bad = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const heading = (text) => console.log(`\n${bold(text)}\n${dim("-".repeat(text.length))}`);
const line = (s) => console.log("  " + s);

let failures = 0;
const check = (label, condition, detail = "") => {
  if (condition) console.log(`  ${ok("pass")}  ${label}`);
  else {
    failures++;
    console.log(`  ${bad("FAIL")}  ${label}  ${dim(String(detail))}`);
  }
};

/* Refuse to start if anything points this process at a real database. The
   suite does not use DATABASE_URL from the environment, and saying so out
   loud is better than quietly overwriting it. */
if (process.env.DATABASE_URL) {
  console.log(
    bad("\n  DATABASE_URL is set in this shell.\n") +
      dim("  This suite builds its own throwaway Postgres and must not be\n" +
          "  pointed at a working database. Unset it and run again.\n"),
  );
  process.exit(1);
}

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

/* == A. A throwaway database =========================================== */

heading("A. A throwaway database, migrated from supabase/migrations");

/* A leftover directory from an interrupted run would be migrated twice. */
fs.rmSync(SCRATCH, { recursive: true, force: true });
fs.mkdirSync(SCRATCH, { recursive: true });

const db = await PGlite.create(SCRATCH);
const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  await db.exec(fs.readFileSync(path.join(MIGRATIONS, file), "utf8"));
}
line(dim(`${files.length} migrations applied to ${path.relative(ROOT, SCRATCH)}`));

const tables = await db.query(
  `select count(*)::int as n from information_schema.tables
    where table_schema = 'public'`,
);
check("the schema is present", tables.rows[0].n > 20, `${tables.rows[0].n} tables`);

const triggers = await db.query(
  `select trigger_name from information_schema.triggers
    where event_object_table = 'buyer_feedback' order by trigger_name`,
);
check(
  "buyer_feedback is append-only here too",
  triggers.rows.some((r) => r.trigger_name === "buyer_feedback_no_delete") &&
    triggers.rows.some((r) => r.trigger_name === "buyer_feedback_no_update"),
  triggers.rows.map((r) => r.trigger_name).join(", "),
);

/* == B. Three quotes on one item ======================================= */

heading("B. Three quotes on one item, two of them said on the same day");

/* The client id the application reads by default; everything else is ZZ so a
   stray row could never be mistaken for business data. */
await db.exec(`
  insert into clients (id, name, workspace, is_demo)
    values ('client', 'ZZ Ordering Check', 'ZZ Workspace', true);
  insert into brokers (id, client_id, name, short_name)
    values ('zz-broker', 'client', 'ZZ Broker Partners', 'ZZ Broker');
  insert into retailers (id, client_id, name, short_name, channel, assigned_broker_id)
    values ('zz-account', 'client', 'ZZ Ordering Account', 'ZZ Account',
            'Supermarket', 'zz-broker');
  insert into products (id, client_id, item_id, name, category)
    values ('zz-product', 'client', 'ZZ-001', 'ZZ Ordering Product', 'Preserves');
  insert into workstream_items (id, retailer_id, product_id, broker_id, owner_id, item_status)
    values ('zz-item', 'zz-account', 'zz-product', 'zz-broker', 'zz-broker', 'Pitched');
`);

const UNDATED = "00000000-0000-4000-8000-0000000000aa";
const EARLIER = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const LATER = "00000000-0000-4000-8000-000000000000";

const EARLIER_QUOTE = "ZZ earlier — wants to evaluate the flavour profile and retail price.";
const LATER_QUOTE = "ZZ later — asked for a lower retail price before moving forward.";
const UNDATED_QUOTE = "ZZ undated — no date recorded anywhere in the source.";

/*
 * created_at is written explicitly rather than left to now(). The column has
 * a default, not a trigger, so the insert may set it — which makes the
 * ordering under test deterministic instead of depending on how fast three
 * inserts run.
 *
 * Note the uuids: EARLIER sorts last alphabetically and LATER sorts first.
 * That inversion is what makes a pass meaningful. Under `order by
 * occurred_at, id` the list ends on the EARLIER row and the portal quotes a
 * superseded remark; the assertions in D would fail every time, not one run
 * in two.
 *
 * Themes differ as well, because buyerFeedback and feedbackTheme are read off
 * the same chosen row and a wrong choice has to be visible in both.
 */
await db.query(
  `insert into buyer_feedback
     (id, workstream_item_id, quote, theme, source, occurred_at, created_at)
   values
     ($1, 'zz-item', $4, 'ZZ Undated', 'Broker relay', null,         '2026-09-08 09:00:00+00'),
     ($2, 'zz-item', $5, 'ZZ Flavour', 'Broker relay', '2026-09-09', '2026-09-10 20:43:38+00'),
     ($3, 'zz-item', $6, 'ZZ Pricing', 'Broker relay', '2026-09-09', '2026-09-10 21:23:38+00')`,
  [UNDATED, EARLIER, LATER, UNDATED_QUOTE, EARLIER_QUOTE, LATER_QUOTE],
);

const stored = await db.query(`select count(*)::int as n from buyer_feedback`);
check("three quotes are stored", stored.rows[0].n === 3, `${stored.rows[0].n} rows`);
line(dim("the row inserted second carries the highest uuid, the row inserted third the lowest"));

/* == C. The old ordering, on these rows ================================ */

heading("C. The ordering this suite replaced, proved wrong on these rows");

/* Run verbatim, as a negative control. If this ever stops putting the stale
   quote last, the fixture has lost its teeth and section D proves nothing. */
const oldOrder = await db.query(
  `select id, quote from buyer_feedback
    where workstream_item_id = 'zz-item'
    order by occurred_at asc nulls first, id asc`,
);
check(
  "order by occurred_at, id ends on the EARLIER quote",
  oldOrder.rows.at(-1).id === EARLIER,
  oldOrder.rows.at(-1).quote,
);
line(dim("so the fixture genuinely defeats the old tiebreak, every run"));

/* == D. The read layer, on the same rows =============================== */

heading("D. The read layer, on the same rows");

const port = await freePort();
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 10 });
await server.start();

/* The only DATABASE_URL this process has ever held. Set before the
   application modules are imported, because pool() reads it on first use. */
process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${port}/postgres`;
line(dim(`the application's pg driver connected to 127.0.0.1:${port}`));

const load = (p) => import(pathToFileURL(path.join(ROOT, p)).href);

const { loadWorkspace, workspace } = await load("src/lib/db/workspace.ts");
await loadWorkspace();
const S = await load("src/lib/selectors.ts");
const ws = workspace();

const record = ws.workstream.find((w) => w.id === "zz-item");

check("the item was read back", record !== undefined);
check(
  "buyerFeedback is the LATER quote",
  record?.buyerFeedback === LATER_QUOTE,
  record?.buyerFeedback,
);
check(
  "feedbackTheme is the LATER row's theme",
  record?.feedbackTheme === "ZZ Pricing",
  record?.feedbackTheme,
);

/* The product and insights screens read the same decision through here. */
const signals = S.getBuyerSignals();
check(
  "getBuyerSignals quotes the LATER remark",
  signals.length === 1 && signals[0].quote === LATER_QUOTE,
  signals.map((s) => s.quote).join(" | "),
);

const themes = S.getFeedbackThemes();
check(
  "getFeedbackThemes rolls up the LATER theme only",
  themes.length === 1 && themes[0].theme === "ZZ Pricing",
  themes.map((t) => t.theme).join(", "),
);

/* == E. The history, still whole ======================================= */

heading("E. The history, still whole and still oldest-first");

const detail = S.getWorkstreamItem("zz-item");
const ids = detail.feedback.map((f) => f.id);

check("every quote is still readable", detail.feedback.length === 3, `${detail.feedback.length} rows`);
check(
  "the item workspace reads them oldest-first",
  ids[0] === UNDATED && ids[1] === EARLIER && ids[2] === LATER,
  ids.join(" -> "),
);
check(
  "an undated quote still sorts first",
  detail.feedback[0].occurredAt === null,
  String(detail.feedback[0].occurredAt),
);
/* Found by id, not by position: this asks whether the superseded remark
   survived, which is true or false regardless of how the list is sorted. */
check(
  "the earlier quote is intact, not overwritten",
  detail.feedback.find((f) => f.id === EARLIER)?.quote === EARLIER_QUOTE,
  detail.feedback.find((f) => f.id === EARLIER)?.quote,
);
check(
  "workspace.feedback and the item detail agree on order",
  ws.feedback.map((f) => f.id).join() === ids.join(),
  ws.feedback.map((f) => f.id).join(" -> "),
);

/* == F. Removed again ================================================== */

heading("F. The throwaway database, removed again");

await server.stop();
await db.close();
fs.rmSync(SCRATCH, { recursive: true, force: true });

check("the scratch database is gone", !fs.existsSync(SCRATCH), SCRATCH);

heading("Result");
if (failures === 0) {
  console.log(`  ${ok("Same-day feedback is ordered by when it was recorded.")}\n`);
} else {
  console.log(`  ${bad(`${failures} check(s) failed.`)}\n`);
}

process.exit(failures ? 1 : 0);
