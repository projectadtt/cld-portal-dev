/**
 * Sizing an account: the three planning figures the opportunity map reads.
 *
 *   node --import ./scripts/db/alias.mjs scripts/db/write/retailer-sizing.mjs
 *
 *   A. a throwaway database, migrated from supabase/migrations
 *   B. two accounts and one product, sized by nobody yet
 *   C. sizing an account, and the mark it puts on the map
 *   D. a partial set is refused, and writes nothing
 *   E. figures the columns cannot hold, and figures that are not figures
 *   F. an account on another client's book, and an id that does not exist
 *   G. what sizing did NOT touch
 *   H. clearing all three takes the account back off the map
 *   I. the throwaway database, removed again
 *
 * Sections D and G are the reason this suite exists. `getOpportunityMap()`
 * excludes an account missing any one of the three figures, so a write that
 * accepted two of them would store work that changes nothing on any screen --
 * and the person who filled two boxes would be told it saved. And a sizing
 * write has no business touching a pipeline status, a broker or a meeting, so
 * every one of those is fingerprinted before the first write and compared
 * again after the last.
 *
 * WHY PGLITE, AND NOT THE WORKING DATABASE
 * This suite writes to `retailers`, which is where the working database keeps
 * the client's real accounts. It builds its own Postgres, applies the real
 * migrations, runs the real mutation and the real selectors against it, and
 * deletes the whole thing at the end.
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
const SCRATCH = path.join(ROOT, ".db", "retailer-sizing");

/* Local copies rather than an import from client.mjs, whose module body calls
   loadEnv() and would put the working database's credentials into this
   process. */
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

/* Fail closed. This suite UPDATEs retailers rows, which in the working
   database are the client's real accounts. Being pointed at one is not a
   degraded run, it is the thing that must not happen. */
if (process.env.DATABASE_URL) {
  console.log(
    bad("\n  DATABASE_URL is set in this shell.\n") +
      dim(
        "  This suite WRITES TO THE retailers TABLE. It builds its own\n" +
          "  throwaway Postgres and must never be pointed at a working\n" +
          "  database. Unset it and run again.\n",
      ),
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

fs.rmSync(SCRATCH, { recursive: true, force: true });
fs.mkdirSync(SCRATCH, { recursive: true });

const db = await PGlite.create(SCRATCH);
const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  await db.exec(fs.readFileSync(path.join(MIGRATIONS, file), "utf8"));
}
line(dim(`${files.length} migrations applied to ${path.relative(ROOT, SCRATCH)}`));

/* The three columns this whole exercise turns on, exactly as the real schema
   declares them. The bounds the mutation validates against are the columns'
   own ceilings, so if a type ever changes, this says so before the rest runs. */
const columns = await db.query(`
  select column_name, data_type, numeric_precision, numeric_scale
    from information_schema.columns
   where table_name = 'retailers'
     and column_name in ('approximate_doors', 'assumed_skus', 'units_per_store_week')
   order by column_name`);
const byName = Object.fromEntries(columns.rows.map((c) => [c.column_name, c]));
check(
  "approximate_doors is an integer",
  byName.approximate_doors?.data_type === "integer",
  byName.approximate_doors?.data_type,
);
check(
  "assumed_skus is an integer",
  byName.assumed_skus?.data_type === "integer",
  byName.assumed_skus?.data_type,
);
check(
  "units_per_store_week is numeric(6,2)",
  byName.units_per_store_week?.numeric_precision === 6 &&
    byName.units_per_store_week?.numeric_scale === 2,
  JSON.stringify(byName.units_per_store_week),
);

/* == B. Accounts to size =============================================== */

heading("B. Two accounts and one product, sized by nobody yet");

await db.exec(`
  insert into clients (id, name, workspace, is_demo) values
    ('client',          'ZZ Sizing Client', 'ZZ Workspace', true),
    ('zz-other-client', 'ZZ Other Client',  'ZZ Elsewhere', true);
  insert into brokers (id, client_id, name, short_name) values
    ('zz-broker', 'client', 'ZZ Broker Partners', 'ZZ Broker');
  insert into products (id, client_id, item_id, name, category) values
    ('zz-product', 'client', 'ZZ-1', 'ZZ Test Product', 'ZZ Category');
  insert into retailers
    (id, client_id, name, short_name, channel, assigned_broker_id, pipeline_status, fit) values
    ('zz-big',     'client',          'ZZ Big Account',     'ZZ Big',     'Supermarket', 'zz-broker', 'Samples sent',        'High'),
    ('zz-small',   'client',          'ZZ Small Account',   'ZZ Small',   'Club',        null,        'Not reached out yet', 'High'),
    ('zz-nofit',   'client',          'ZZ No Fit Account',  'ZZ NoFit',   'Supermarket', null,        'Not reached out yet', null),
    ('zz-gone',    'client',          'ZZ Archived',        'ZZ Gone',    'Supermarket', null,        'Not reached out yet', 'High'),
    ('zz-foreign', 'zz-other-client', 'ZZ Foreign Account', 'ZZ Foreign', 'Supermarket', null,        'Not reached out yet', 'High');
  update retailers set archived_at = now() where id = 'zz-gone';
  insert into workstream_items (id, retailer_id, product_id, broker_id) values
    ('zz-ws-01', 'zz-big', 'zz-product', 'zz-broker');
  insert into meetings (id, retailer_id, scheduled_at, title, status) values
    ('zz-mtg-01', 'zz-big', '2026-09-05 10:00:00+00', 'ZZ Range view', 'Scheduled');
`);
line(dim("one account in the workstream, one not, one with no fit, one archived, one elsewhere"));

/* Everything the sizing write must not be able to reach. */
const UNTOUCHABLE = `select id, name, short_name, channel, assigned_broker_id,
       pipeline_status, standing, current_target, tier, priority, fit,
       categories, last_contact::text as last_contact, attention_reason, notes
  from retailers order by id`;
const retailersBefore = JSON.stringify((await db.query(UNTOUCHABLE)).rows);

const port = await freePort();
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 10 });
await server.start();

process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${port}/postgres`;
line(dim(`the application's pg driver connected to 127.0.0.1:${port}`));

const load = (p) => import(pathToFileURL(path.join(ROOT, p)).href);

const { loadWorkspace, workspace, resetWorkspace } = await load("src/lib/db/workspace.ts");
const M = await load("src/lib/db/mutations.ts");
const S = await load("src/lib/selectors.ts");

/** The three columns, straight from the table. */
const sizing = async (id) =>
  (
    await db.query(
      `select approximate_doors as doors, assumed_skus as skus,
              units_per_store_week::text as units
         from retailers where id = $1`,
      [id],
    )
  ).rows[0];

/** Reload the snapshot the selectors read, the way a request would. */
const reread = async () => {
  resetWorkspace();
  await loadWorkspace();
  return workspace();
};

await reread();
check(
  "no account is on the map before anything is sized",
  S.getOpportunityMap().length === 0,
  JSON.stringify(S.getOpportunityMap()),
);
check(
  "every live account is named as unsized instead",
  S.getUnsizedRetailers().length === 3,
  String(S.getUnsizedRetailers().length),
);

/* == C. Sizing an account ============================================== */

heading("C. Sizing an account, and the mark it puts on the map");

const big = await M.updateRetailerSizing("zz-big", {
  approximateDoors: "300",
  assumedSkus: "3",
  unitsPerStoreWeek: "12",
});
check("the write reports success", big.ok === true, JSON.stringify(big));
check(
  "it names all three figures that moved",
  big.ok && big.changed.length === 3,
  JSON.stringify(big.changed),
);

const bigRow = await sizing("zz-big");
check("approximate_doors is 300", bigRow.doors === 300, String(bigRow.doors));
check("assumed_skus is 3", bigRow.skus === 3, String(bigRow.skus));
check("units_per_store_week is 12.00", Number(bigRow.units) === 12, bigRow.units);

const small = await M.updateRetailerSizing("zz-small", {
  approximateDoors: "10",
  assumedSkus: "2",
  unitsPerStoreWeek: "8",
});
check("a second account can be sized too", small.ok === true, JSON.stringify(small));

await reread();
const map = S.getOpportunityMap();
check("both sized accounts are now on the map", map.length === 2, String(map.length));
check("the account with no fit is still not on it", !map.some((p) => p.id === "zz-nofit"));
check("the archived account is not on it", !map.some((p) => p.id === "zz-gone"));
check("nor is the account on another client's book", !map.some((p) => p.id === "zz-foreign"));

const plotted = Object.fromEntries(map.map((p) => [p.id, p]));

/* doors x SKUs x units x 52, log-scaled across the plotted set: the larger
   account takes the top of the axis, the smaller the bottom. With exactly two
   points that is 100 and 0 by construction, which is what the selector does. */
check(
  "the larger account sits at the top of the opportunity axis",
  plotted["zz-big"].marketOpportunity === 100,
  String(plotted["zz-big"].marketOpportunity),
);
check(
  "the smaller account sits at the bottom",
  plotted["zz-small"].marketOpportunity === 0,
  String(plotted["zz-small"].marketOpportunity),
);
check(
  "neither readiness coordinate came out NaN",
  Number.isFinite(plotted["zz-big"].brandReadiness) &&
    Number.isFinite(plotted["zz-small"].brandReadiness),
);

/* 0.6 x (pipeline rung / 10 x 100) + 0.4 x fit. Both are fit High, so the
   readiness gap here is the pipeline gap and nothing else. */
check(
  "readiness reads 76 for the account at 'Samples sent'",
  plotted["zz-big"].brandReadiness === 76,
  String(plotted["zz-big"].brandReadiness),
);
check(
  "readiness reads 34 for the one nobody has contacted",
  plotted["zz-small"].brandReadiness === 34,
  String(plotted["zz-small"].brandReadiness),
);

check("the account with a workstream item draws filled", plotted["zz-big"].inWorkstream === true);
check("the one without draws hollow", plotted["zz-small"].inWorkstream === false);

check(
  "only the account that is still unsized is listed as such",
  S.getUnsizedRetailers().length === 1,
  String(S.getUnsizedRetailers().length),
);

/* == D. A partial set ================================================== */

heading("D. A partial set is refused, and writes nothing");

const PARTIALS = [
  ["doors only", { approximateDoors: "50", assumedSkus: "", unitsPerStoreWeek: "" }],
  ["SKUs only", { approximateDoors: "", assumedSkus: "4", unitsPerStoreWeek: "" }],
  ["units only", { approximateDoors: "", assumedSkus: "", unitsPerStoreWeek: "9" }],
  ["two of three", { approximateDoors: "50", assumedSkus: "4", unitsPerStoreWeek: "" }],
];

for (const [label, edit] of PARTIALS) {
  const result = await M.updateRetailerSizing("zz-nofit", edit);
  check(`${label} is refused`, result.ok === false, JSON.stringify(result));
  check(
    `${label} says why`,
    result.ok === false && Boolean(result.errors.form),
    JSON.stringify(result.ok === false ? result.errors : {}),
  );
}

const untouched = await sizing("zz-nofit");
check(
  "the refused account still has all three columns null",
  untouched.doors === null && untouched.skus === null && untouched.units === null,
  JSON.stringify(untouched),
);

/* == E. Figures the columns cannot hold ================================ */

heading("E. Figures the columns cannot hold, and figures that are not figures");

const REJECTED = [
  ["a negative door count", { approximateDoors: "-1", assumedSkus: "3", unitsPerStoreWeek: "12" }, "approximateDoors"],
  ["a negative SKU count", { approximateDoors: "10", assumedSkus: "-3", unitsPerStoreWeek: "12" }, "assumedSkus"],
  ["a negative rate of sale", { approximateDoors: "10", assumedSkus: "3", unitsPerStoreWeek: "-12" }, "unitsPerStoreWeek"],
  ["a fractional door count", { approximateDoors: "10.5", assumedSkus: "3", unitsPerStoreWeek: "12" }, "approximateDoors"],
  ["a fractional SKU count", { approximateDoors: "10", assumedSkus: "3.5", unitsPerStoreWeek: "12" }, "assumedSkus"],
  ["a door count that is not a number", { approximateDoors: "lots", assumedSkus: "3", unitsPerStoreWeek: "12" }, "approximateDoors"],
  ["a rate of sale past numeric(6,2)", { approximateDoors: "10", assumedSkus: "3", unitsPerStoreWeek: "10000" }, "unitsPerStoreWeek"],
  ["an absurd door count", { approximateDoors: "999999", assumedSkus: "3", unitsPerStoreWeek: "12" }, "approximateDoors"],
];

for (const [label, edit, field] of REJECTED) {
  const result = await M.updateRetailerSizing("zz-nofit", edit);
  check(`${label} is refused`, result.ok === false, JSON.stringify(result));
  check(
    `  and the error names ${field}`,
    result.ok === false && Boolean(result.errors[field]),
    JSON.stringify(result.ok === false ? result.errors : {}),
  );
}

const stillNull = await sizing("zz-nofit");
check(
  "nothing was written by any of them",
  stillNull.doors === null && stillNull.skus === null && stillNull.units === null,
  JSON.stringify(stillNull),
);

/* A rate of sale at the very top of what the column holds is accepted, so the
   bound is a boundary rather than a fence standing in open ground. */
const atCeiling = await M.updateRetailerSizing("zz-nofit", {
  approximateDoors: "1",
  assumedSkus: "1",
  unitsPerStoreWeek: "9999.99",
});
check("9999.99 — the top of numeric(6,2) — is accepted", atCeiling.ok === true, JSON.stringify(atCeiling));
const ceilingRow = await sizing("zz-nofit");
check("and stored without loss", Number(ceilingRow.units) === 9999.99, ceilingRow.units);

/* == F. Scoping ======================================================== */

heading("F. An account on another client's book, and an id that does not exist");

const foreign = await M.updateRetailerSizing("zz-foreign", {
  approximateDoors: "99",
  assumedSkus: "9",
  unitsPerStoreWeek: "9",
});
check("another client's account is refused", foreign.ok === false, JSON.stringify(foreign));
const foreignRow = await sizing("zz-foreign");
check(
  "and its columns are untouched",
  foreignRow.doors === null && foreignRow.skus === null && foreignRow.units === null,
  JSON.stringify(foreignRow),
);

const archived = await M.updateRetailerSizing("zz-gone", {
  approximateDoors: "99",
  assumedSkus: "9",
  unitsPerStoreWeek: "9",
});
check("an archived account is refused", archived.ok === false, JSON.stringify(archived));

const missing = await M.updateRetailerSizing("zz-does-not-exist", {
  approximateDoors: "99",
  assumedSkus: "9",
  unitsPerStoreWeek: "9",
});
check("an id that does not exist is refused", missing.ok === false, JSON.stringify(missing));

/* Saving a form nobody changed says so, rather than claiming a save. */
const again = await M.updateRetailerSizing("zz-big", {
  approximateDoors: "300",
  assumedSkus: "3",
  unitsPerStoreWeek: "12",
});
check(
  "re-saving the same figures reports nothing changed",
  again.ok === true && again.changed.join() === "Nothing changed",
  JSON.stringify(again.ok === true ? again.changed : again),
);

/* == G. What sizing did NOT touch ====================================== */

heading("G. What sizing did NOT touch");

const afterRows = JSON.stringify((await db.query(UNTOUCHABLE)).rows);
check(
  "no name, channel, broker, status, standing, target, tier, priority, fit, category, last contact, attention reason or note moved on any account",
  afterRows === retailersBefore,
  "one of those columns changed",
);

const counts = (
  await db.query(`select
  (select count(*)::int from meetings) as meetings,
  (select count(*)::int from activities) as activities,
  (select count(*)::int from buyer_feedback) as feedback,
  (select count(*)::int from samples) as samples,
  (select count(*)::int from workstream_items) as workstream,
  (select count(*)::int from actions) as actions,
  (select count(*)::int from opportunities) as opportunities,
  (select count(*)::int from products) as products`)
).rows[0];
check("meetings still 1", counts.meetings === 1, String(counts.meetings));
check("activities still 0", counts.activities === 0, String(counts.activities));
check("buyer feedback still 0", counts.feedback === 0, String(counts.feedback));
check("samples still 0", counts.samples === 0, String(counts.samples));
check("workstream items still 1", counts.workstream === 1, String(counts.workstream));
check("actions still 0", counts.actions === 0, String(counts.actions));
check("no opportunities row was created", counts.opportunities === 0, String(counts.opportunities));
check("products still 1", counts.products === 1, String(counts.products));

const meeting = (await db.query(`select status, title from meetings where id = 'zz-mtg-01'`)).rows[0];
check(
  "the meeting is still Scheduled and still itself",
  meeting.status === "Scheduled" && meeting.title === "ZZ Range view",
  JSON.stringify(meeting),
);

const item = (
  await db.query(`select item_status, current_target, broker_id, estimated_doors, units_per_store_week
     from workstream_items where id = 'zz-ws-01'`)
).rows[0];
check(
  "the workstream item's own sizing columns are untouched — a different table, a different question",
  item.estimated_doors === null && item.units_per_store_week === null,
  JSON.stringify(item),
);
check(
  "and so is where the item stands",
  item.item_status === "Not pitched" && item.current_target === "Target",
  JSON.stringify(item),
);

/* == H. Clearing ======================================================= */

heading("H. Clearing all three takes the account back off the map");

const cleared = await M.updateRetailerSizing("zz-small", {
  approximateDoors: "",
  assumedSkus: "",
  unitsPerStoreWeek: "",
});
check("all three blank is accepted", cleared.ok === true, JSON.stringify(cleared));
check(
  "and reported as three figures no longer recorded",
  cleared.ok === true &&
    cleared.changed.length === 3 &&
    cleared.changed.every((c) => c.endsWith("not recorded")),
  JSON.stringify(cleared.ok === true ? cleared.changed : {}),
);

const clearedRow = await sizing("zz-small");
check(
  "the columns are null again",
  clearedRow.doors === null && clearedRow.skus === null && clearedRow.units === null,
  JSON.stringify(clearedRow),
);

await reread();
check("the account is off the map", !S.getOpportunityMap().some((p) => p.id === "zz-small"));
check("and named as unsized again", S.getUnsizedRetailers().some((r) => r.id === "zz-small"));
/* One mark left, not two. Section E sized zz-nofit at the column ceiling, but
   it has no recorded fit -- so all three figures present is necessary and not
   sufficient, and readiness is the other half of the pair. */
const remaining = S.getOpportunityMap();
check("the one account that is sized AND has a fit stays on the map",
  remaining.length === 1 && remaining[0].id === "zz-big",
  JSON.stringify(remaining.map((p) => p.id)));
check("a fully sized account with no recorded fit is still not placed",
  !remaining.some((p) => p.id === "zz-nofit"));

/* Coordinates stay finite however few points there are -- with a single mark
   the log domain collapses and `span` falls back to 1, which is this branch. */
check(
  "every remaining point still has finite coordinates",
  S.getOpportunityMap().every(
    (p) => Number.isFinite(p.brandReadiness) && Number.isFinite(p.marketOpportunity),
  ),
  JSON.stringify(S.getOpportunityMap()),
);

/* == I. Removed again ================================================== */

heading("I. The throwaway database, removed again");

await server.stop();
await db.close();
fs.rmSync(SCRATCH, { recursive: true, force: true });
check("the scratch database is gone", !fs.existsSync(SCRATCH), SCRATCH);

heading("Result");
if (failures === 0) {
  line(ok("An account can be sized, all three figures or none, and nothing else moves."));
} else {
  line(bad(`${failures} check${failures === 1 ? "" : "s"} failed.`));
}
console.log("");
process.exit(failures === 0 ? 0 : 1);
