/**
 * A meeting nobody is recorded against, and a meeting nobody wrote up.
 *
 *   node --import ./scripts/db/alias.mjs scripts/db/write/meetings-nullable.mjs
 *
 *   A. a throwaway database, migrated from supabase/migrations
 *   B. two held meetings — one complete, one with broker and summary NULL
 *   C. the expression this fix replaced, proved fatal on the sparse row
 *   D. the read layer, honest about both
 *   E. every selector that resolves a meeting's broker or notes
 *   F. the complete meeting, unchanged
 *   G. the throwaway database, removed again
 *
 * meetings.broker_id is nullable and ON DELETE SET NULL, so a held meeting
 * outlives the broker who held it; meetings.summary is nullable, so a meeting
 * can be on the book before anyone writes it up. Both were typed as always
 * present, and MeetingDetail.broker was declared non-optional — so the detail
 * page did `broker.id` on a value the database is entitled to leave empty.
 * Section C is that crash, reproduced deliberately.
 *
 * WHY PGLITE, AND NOT THE WORKING DATABASE
 * The working database holds no meetings at all, so this case cannot be read
 * there without writing one — and the point of the suite is to prove the
 * sparse row is safe before any meeting record is allowed to exist. It builds
 * its own Postgres, applies the real migrations, and deletes the whole thing
 * at the end. Nothing is written to the working database.
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
const SCRATCH = path.join(ROOT, ".db", "meetings-nullable");

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

fs.rmSync(SCRATCH, { recursive: true, force: true });
fs.mkdirSync(SCRATCH, { recursive: true });

const db = await PGlite.create(SCRATCH);
const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  await db.exec(fs.readFileSync(path.join(MIGRATIONS, file), "utf8"));
}
line(dim(`${files.length} migrations applied to ${path.relative(ROOT, SCRATCH)}`));

/* The nullability under test is a property of the schema, so assert it rather
   than trusting the census: if either column were NOT NULL the fixture below
   could not be inserted and the whole suite would be meaningless. */
const cols = await db.query(
  `select column_name, is_nullable from information_schema.columns
    where table_name = 'meetings' and column_name in ('broker_id', 'summary')
    order by column_name`,
);
check(
  "meetings.broker_id and meetings.summary are both nullable",
  cols.rows.length === 2 && cols.rows.every((c) => c.is_nullable === "YES"),
  JSON.stringify(cols.rows),
);

/* == B. Two held meetings ============================================== */

heading("B. Two held meetings — one complete, one with broker and summary NULL");

const SUMMARY = "ZZ buyer walked the range and asked for a price list.";

await db.exec(`
  insert into clients (id, name, workspace, is_demo)
    values ('client', 'ZZ Meeting Check', 'ZZ Workspace', true);
  insert into brokers (id, client_id, name, short_name)
    values ('zz-broker', 'client', 'ZZ Broker Partners', 'ZZ Broker');
  insert into retailers (id, client_id, name, short_name, channel, assigned_broker_id)
    values ('zz-account', 'client', 'ZZ Meeting Account', 'ZZ Account',
            'Supermarket', 'zz-broker');
`);

/*
 * Both rows are 'Completed' because the read layer reads only completed
 * meetings. That filter is the status logic, which is out of scope here and
 * deliberately untouched — these two rows differ in exactly the two columns
 * under test and nothing else.
 */
await db.query(
  `insert into meetings (id, retailer_id, scheduled_at, title, status, broker_id, summary)
   values
     ('zz-meet-full', 'zz-account', '2026-09-02 09:00:00+00',
      'ZZ Range review', 'Completed', 'zz-broker', $1),
     ('zz-meet-bare', 'zz-account', '2026-09-03 09:00:00+00',
      'ZZ Introductory call', 'Completed', null, null)`,
  [SUMMARY],
);

const stored = await db.query(
  `select id, broker_id, summary from meetings order by id`,
);
check("two meetings are stored", stored.rows.length === 2, `${stored.rows.length} rows`);
check(
  "one of them has broker_id and summary NULL",
  stored.rows.some((m) => m.broker_id === null && m.summary === null),
  JSON.stringify(stored.rows),
);

/* == C. The expression this fix replaced =============================== */

heading("C. The expression this fix replaced, proved fatal on the sparse row");

const port = await freePort();
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 10 });
await server.start();

process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${port}/postgres`;
line(dim(`the application's pg driver connected to 127.0.0.1:${port}`));

const load = (p) => import(pathToFileURL(path.join(ROOT, p)).href);

const { loadWorkspace, workspace } = await load("src/lib/db/workspace.ts");
await loadWorkspace();
const S = await load("src/lib/selectors.ts");
const ws = workspace();

const bare = S.getMeetingDetail("zz-meet-bare");
const full = S.getMeetingDetail("zz-meet-full");

check("the sparse meeting resolves at all", bare !== null);

/* The detail page did exactly this, and `broker` is now legitimately
   undefined — so the old line is a TypeError. Reproducing it here is what
   makes the assertions in D and E mean something. */
let threw = false;
try {
  void ("/brokers/" + bare.broker.id);
} catch {
  threw = true;
}
check("the old `broker.id` access throws on this row", threw);
line(dim("that TypeError was a 500 on /meetings/[meetingId]"));

/* == D. The read layer ================================================= */

heading("D. The read layer, honest about both");

const bareRecord = ws.meetings.find((m) => m.id === "zz-meet-bare");
const fullRecord = ws.meetings.find((m) => m.id === "zz-meet-full");

check("both meetings were read back", ws.meetings.length === 2, `${ws.meetings.length}`);
check(
  "the sparse meeting's brokerId is absent, not null",
  bareRecord?.brokerId === undefined && !("null" === String(bareRecord?.brokerId)),
  String(bareRecord?.brokerId),
);
check(
  "the sparse meeting's summary is absent, not null",
  bareRecord?.summary === undefined,
  String(bareRecord?.summary),
);
check(
  "nothing was fabricated in its place",
  bareRecord?.title === "ZZ Introductory call" &&
    Array.isArray(bareRecord?.decisions) &&
    bareRecord.decisions.length === 0,
  JSON.stringify(bareRecord),
);

/* == E. Every selector that resolves a broker or notes ================= */

heading("E. Every selector that resolves a meeting's broker or notes");

check("getMeetingDetail gives no broker rather than a stand-in", bare.broker === undefined);
check(
  "getMeetingSummaries gives no broker for that row",
  S.getMeetingSummaries().find((s) => s.meeting.id === "zz-meet-bare")?.broker ===
    undefined,
);

/* What BrokerName and getOwnerName will be handed. The one word for the gap,
   defined once in the selector layer. */
check(
  "the portal's word for it is Unassigned",
  S.getOwnerName(bareRecord.brokerId) === S.UNASSIGNED &&
    S.UNASSIGNED === "Unassigned",
  S.getOwnerName(bareRecord.brokerId),
);

const notes = S.getRetailerNotes("zz-account");
const bareNote = notes.find((n) => n.id === "zz-meet-bare");
check("getRetailerNotes carries both meetings", notes.length === 2, `${notes.length}`);
check(
  "the sparse note has no author and no body",
  bareNote?.authorId === undefined && bareNote?.body === undefined,
  JSON.stringify(bareNote),
);

/* getBrokerNotes filters by broker, so the sparse meeting must simply not
   appear there — it belongs to nobody. */
const brokerNotes = S.getBrokerNotes("zz-broker");
check(
  "getBrokerNotes lists only the meeting that has a broker",
  brokerNotes.length === 1 && brokerNotes[0].id === "zz-meet-full",
  JSON.stringify(brokerNotes.map((n) => n.id)),
);
check(
  "and names its author",
  brokerNotes[0].authorId === "zz-broker" && brokerNotes[0].body === SUMMARY,
  JSON.stringify(brokerNotes[0]),
);

/* The account timeline already tolerated absence; this proves it still does
   now that the absence is real rather than theoretical. */
const timeline = S.getRetailerTimeline("zz-account");
const bareEvent = timeline.find((e) => e.id === "zz-meet-bare");
check("the account timeline carries the sparse meeting", bareEvent !== undefined);
check(
  "with no detail and no person, rather than literals",
  bareEvent?.detail === undefined && bareEvent?.personId === undefined,
  JSON.stringify(bareEvent),
);

/* Nothing anywhere should have turned an absence into a word. */
const allText = JSON.stringify([ws.meetings, notes, timeline, S.getMeetingSummaries()]);
check(
  "no absence rendered as the string \"null\" or \"undefined\"",
  !allText.includes('"null"') && !allText.includes('"undefined"'),
);

/* == F. The complete meeting, unchanged ================================ */

heading("F. The complete meeting, unchanged");

check("its broker still resolves", full.broker?.id === "zz-broker", full.broker?.id);
check("its broker is still named in full", full.broker?.name === "ZZ Broker Partners");
check("its summary is still the text that was stored", fullRecord?.summary === SUMMARY);
check(
  "getOwnerName still names it normally",
  S.getOwnerName(fullRecord.brokerId) === "ZZ Broker",
  S.getOwnerName(fullRecord.brokerId),
);

/* == G. Removed again ================================================== */

heading("G. The throwaway database, removed again");

await server.stop();
await db.close();
fs.rmSync(SCRATCH, { recursive: true, force: true });

check("the scratch database is gone", !fs.existsSync(SCRATCH), SCRATCH);

heading("Result");
if (failures === 0) {
  console.log(`  ${ok("A meeting with no broker and no notes reads safely.")}\n`);
} else {
  console.log(`  ${bad(`${failures} check(s) failed.`)}\n`);
}

process.exit(failures ? 1 : 0);
