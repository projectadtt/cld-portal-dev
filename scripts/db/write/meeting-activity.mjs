/**
 * The first Activity write path: a meeting being held becomes account history.
 *
 *   node --import ./scripts/db/alias.mjs scripts/db/write/meeting-activity.mjs
 *
 *   A. a throwaway database, migrated from supabase/migrations
 *   B. three accounts, one of them with no broker, and a meeting on each
 *   C. Scheduled -> Completed files exactly one activity
 *   D. where that activity shows up, and where it deliberately does not
 *   E. what does NOT file an activity
 *   F. what the activity did NOT touch
 *   G. a meeting on an unassigned account
 *   H. transaction safety, in both directions
 *   I. the throwaway database, removed again
 *
 * Sections E and H are the reason this suite exists. A history spine that can
 * record the same meeting twice is worse than one that records nothing: the
 * account would read as though the buyer had been seen two or three times.
 * So every transition that must stay silent is exercised, and the two halves
 * of the transaction are each made to fail on purpose to prove the other half
 * is rolled back with it.
 *
 * WHY PGLITE, AND NOT THE WORKING DATABASE
 * A real meeting exists in production -- SM Markets x Range View, already
 * Completed -- and the brief is explicit that it must not be touched. This
 * suite completes meetings and writes to an append-only table, where a
 * mistake cannot be deleted afterwards. So it builds its own Postgres,
 * applies the real migrations, runs the real mutation and the real selectors
 * against it, and deletes the whole thing at the end.
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
const SCRATCH = path.join(ROOT, ".db", "meeting-activity");

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

/* Fail closed. This suite completes meetings and inserts into an append-only
   table; being pointed at a working database is not a degraded run, it is the
   thing that must not happen. An activity written there could not be removed
   afterwards -- the append-only trigger blocks DELETE. */
if (process.env.DATABASE_URL) {
  console.log(
    bad("\n  DATABASE_URL is set in this shell.\n") +
      dim("  This suite COMPLETES MEETINGS and WRITES ACTIVITY ROWS, which are\n" +
          "  append-only and cannot be deleted again. It builds its own\n" +
          "  throwaway Postgres and must never be pointed at a working\n" +
          "  database. Unset it and run again.\n"),
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

/* The escape hatch is never set by this suite, so the append-only rule is in
   force for every write below -- exactly as it is in production. */
const appendOnly = await db.query(`
  select count(*)::int as n from pg_trigger
   where tgrelid = 'activities'::regclass and not tgisinternal`);
check(
  "activities is append-only in this database too, as in production",
  appendOnly.rows[0].n === 2,
  `${appendOnly.rows[0].n} triggers`,
);

/* == B. Accounts and meetings ========================================== */

heading("B. Three accounts, one with no broker, and a meeting on each");

await db.exec(`
  insert into clients (id, name, workspace, is_demo) values
    ('client',          'ZZ Meeting Activity', 'ZZ Workspace', true),
    ('zz-other-client', 'ZZ Other Client',     'ZZ Elsewhere', true);
  insert into brokers (id, client_id, name, short_name) values
    ('zz-broker', 'client', 'ZZ Broker Partners', 'ZZ Broker');
  insert into retailers (id, client_id, name, short_name, channel, assigned_broker_id) values
    ('zz-account', 'client',          'ZZ Activity Account', 'ZZ Activity', 'Supermarket', 'zz-broker'),
    ('zz-bare',    'client',          'ZZ Bare Account',     'ZZ Bare',     'Supermarket', null),
    ('zz-foreign', 'zz-other-client', 'ZZ Foreign Account',  'ZZ Foreign',  'Supermarket', null);
  insert into meetings (id, retailer_id, scheduled_at, title, status, broker_id, location) values
    ('mtg-01', 'zz-account', '2026-09-05 10:00:00+00', 'ZZ Range view',    'Scheduled', 'zz-broker', 'ZZ Head office'),
    ('mtg-02', 'zz-account', '2026-09-07 09:00:00+00', 'ZZ Second call',   'Scheduled', 'zz-broker', null),
    ('mtg-03', 'zz-account', '2026-09-08 09:00:00+00', 'ZZ Stays on book', 'Scheduled', 'zz-broker', null),
    ('mtg-04', 'zz-bare',    '2026-09-06 09:00:00+00', 'ZZ Nobody is on it','Scheduled', null,       null),
    ('mtg-05', 'zz-account', '2026-09-04 09:00:00+00', 'ZZ Reopened',      'Scheduled', 'zz-broker', null),
    ('mtg-06', 'zz-account', '2026-09-03 09:00:00+00', 'ZZ Log will fail', 'Scheduled', 'zz-broker', null),
    ('mtg-07', 'zz-account', '2026-09-02 09:00:00+00', 'ZZ Save will fail','Scheduled', 'zz-broker', null),
    ('mtg-99', 'zz-foreign', '2026-09-05 10:00:00+00', 'ZZ Foreign talk',  'Scheduled', null,        null);
`);
line(dim("seven meetings on this client, one on another"));

/* Everything the activity write must not be able to reach, fingerprinted
   before the first write and compared again after the last. */
const RETAILER_STATE = `select id, name, short_name, channel, assigned_broker_id,
       pipeline_status, standing, current_target, next_meeting_status, next_meeting_at
  from retailers order by id`;
const retailersBefore = JSON.stringify((await db.query(RETAILER_STATE)).rows);

const port = await freePort();
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 10 });
await server.start();

process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${port}/postgres`;
line(dim(`the application's pg driver connected to 127.0.0.1:${port}`));

const load = (p) => import(pathToFileURL(path.join(ROOT, p)).href);

const { loadWorkspace, workspace, resetWorkspace } = await load("src/lib/db/workspace.ts");
const M = await load("src/lib/db/mutations.ts");
const S = await load("src/lib/selectors.ts");

const row = async (id) =>
  (
    await db.query(
      `select status, summary, decisions from meetings where id = $1`,
      [id],
    )
  ).rows[0];

/** Every activity row, in full, straight from the table. */
const logRows = async () =>
  (
    await db.query(`select id, retailer_id, type, description, person_id, product_id,
           workstream_item_id, meeting_id, is_system,
           to_char(occurred_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') as at
      from activities order by id`)
  ).rows;

const logCount = async () =>
  (await db.query(`select count(*)::int as n from activities`)).rows[0].n;

/** Reload the snapshot the selectors read, the way a request would. */
const reread = async () => {
  resetWorkspace();
  await loadWorkspace();
  return workspace();
};

const NOTES = "ZZ Buyer walked the range and asked for a price list.";
const DECISIONS = "ZZ Send the price list\nZZ Revisit in October";

check("no activity exists before anything is completed", (await logCount()) === 0);

/* == C. Scheduled -> Completed ========================================= */

heading("C. Scheduled -> Completed files exactly one activity");

const completed = await M.updateMeeting("mtg-01", {
  summary: NOTES,
  decisions: DECISIONS,
  status: "Completed",
});
check("the transition is accepted", completed.ok === true, JSON.stringify(completed.errors));
check(
  "the meeting itself is updated",
  (await row("mtg-01")).status === "Completed",
  (await row("mtg-01")).status,
);
check(
  "and the save reports the activity it filed, not only the status",
  completed.changed.some((c) => c === "Status -> Completed") &&
    completed.changed.some((c) => c.includes("activity")),
  JSON.stringify(completed.changed),
);

check("exactly one activity row now exists", (await logCount()) === 1, `${await logCount()}`);

let log = (await logRows())[0];
check("its id is in the readable evt-NN series", log.id === "evt-01", log.id);
check("its type is the existing 'Meeting completed' vocabulary", log.type === "Meeting completed", log.type);
check("it references the completed meeting", log.meeting_id === "mtg-01", log.meeting_id);
check("it references the right account", log.retailer_id === "zz-account", log.retailer_id);
check("it carries the broker who ran the meeting", log.person_id === "zz-broker", log.person_id);
check(
  "it is dated to when the meeting was held, not to when the form was submitted",
  log.at === "2026-09-05 10:00",
  log.at,
);
check("its description is the meeting's title", log.description === "ZZ Range view", log.description);
check("it is flagged as written by the system, not typed by a person", log.is_system === true, `${log.is_system}`);
check(
  "it claims no product and no workstream item, because the data records none",
  log.product_id === null && log.workstream_item_id === null,
  JSON.stringify([log.product_id, log.workstream_item_id]),
);

/* The type is a real lookup value, not a string this mutation invented. */
const vocab = await db.query(
  `select display_label from lookup_activity_type where value = $1`,
  ["Meeting completed"],
);
check(
  "'Meeting completed' was already in lookup_activity_type — no vocabulary was added",
  vocab.rows.length === 1 && vocab.rows[0].display_label === "Meeting completed",
);

/* == D. Where it shows up ============================================== */

heading("D. Where that activity shows up, and where it deliberately does not");

let ws = await reread();

check(
  "the read layer loads it",
  ws.activities.length === 1 && ws.activities[0].id === "evt-01",
  JSON.stringify(ws.activities),
);
check(
  "/activity shows it — getRecentActivity",
  S.getRecentActivity().some((a) => a.id === "evt-01"),
  JSON.stringify(S.getRecentActivity().map((a) => a.id)),
);
check(
  "the account's Activity panel shows it — getRetailerActivities",
  S.getRetailerActivities("zz-account").some((a) => a.id === "evt-01"),
);
check(
  "and it is the account's last logged activity",
  S.getLastActivity("zz-account")?.id === "evt-01",
  S.getLastActivity("zz-account")?.id,
);
check(
  "a meeting counts as an exchange, so it becomes the last conversation too",
  S.getRetailerDetail("zz-account")?.lastConversation?.id === "evt-01",
  S.getRetailerDetail("zz-account")?.lastConversation?.id,
);
check(
  "it reads with the broker's name rather than an unresolved id",
  S.getOwnerName(S.getRecentActivity()[0].personId) === "ZZ Broker",
  S.getOwnerName(S.getRecentActivity()[0].personId),
);
check(
  "the other account's log is untouched by it",
  S.getRetailerActivities("zz-bare").length === 0,
);

/* The one place it is deliberately absent, and the reason is pre-existing:
   SUPERSEDED_BY_MEETING drops a same-day "Meeting completed" entry from the
   merged views, because the meeting record itself is already sitting there
   carrying the summary and the decisions. Showing both would put the same
   encounter on the account twice. That filter was written before this write
   path existed and is left exactly as it was. */
const timelineIds = S.getRetailerTimeline("zz-account").map((e) => e.id);
check(
  "the account timeline still carries the encounter — as the meeting record",
  timelineIds.includes("mtg-01"),
  JSON.stringify(timelineIds),
);
check(
  "and not a second time as the activity, which would be the same meeting twice",
  !timelineIds.includes("evt-01"),
  JSON.stringify(timelineIds),
);
check(
  "the meeting's own Related activity likewise does not quote the meeting back",
  !S.getMeetingDetail("mtg-01").activities.some((a) => a.id === "evt-01"),
);
check(
  "but another meeting on the account does show it as related activity",
  S.getMeetingDetail("mtg-02").activities.some((a) => a.id === "evt-01"),
  JSON.stringify(S.getMeetingDetail("mtg-02").activities.map((a) => a.id)),
);

/* == E. What does NOT file an activity ================================= */

heading("E. What does NOT file an activity");

/* 1. Editing the write-up of a meeting that is already Completed. */
const editedNotes = await M.updateMeeting("mtg-01", {
  summary: NOTES + " ZZ And a second paragraph.",
  decisions: DECISIONS,
  status: "Completed",
});
check("editing the notes afterwards is accepted", editedNotes.ok === true);
check("but files no second activity", (await logCount()) === 1, `${await logCount()}`);
check(
  "and does not claim to have logged one",
  !editedNotes.changed.some((c) => c.includes("activity")),
  JSON.stringify(editedNotes.changed),
);

/* 2. Editing the decisions. */
const editedDecisions = await M.updateMeeting("mtg-01", {
  summary: NOTES + " ZZ And a second paragraph.",
  decisions: DECISIONS + "\nZZ One more thing",
  status: "Completed",
});
check("editing the decisions afterwards is accepted", editedDecisions.ok === true);
check("but files no second activity", (await logCount()) === 1, `${await logCount()}`);

/* 3. Completed -> Completed, changing nothing at all. */
const noop = await M.updateMeeting("mtg-01", {
  summary: NOTES + " ZZ And a second paragraph.",
  decisions: DECISIONS + "\nZZ One more thing",
  status: "Completed",
});
check(
  "re-saving an unchanged completed meeting reports Nothing changed",
  noop.changed.join() === "Nothing changed",
  JSON.stringify(noop.changed),
);
check("and files no second activity", (await logCount()) === 1, `${await logCount()}`);

/* 4. Scheduled -> Cancelled. A diary change, not an encounter. */
const cancelled = await M.updateMeeting("mtg-02", {
  summary: "",
  decisions: "",
  status: "Cancelled",
});
check("Scheduled -> Cancelled is accepted", cancelled.ok === true, JSON.stringify(cancelled.errors));
check("and files no activity at all", (await logCount()) === 1, `${await logCount()}`);
check(
  "in particular no 'Meeting completed' for a meeting that never happened",
  !(await logRows()).some((a) => a.meeting_id === "mtg-02"),
);

/* 5. Scheduled -> Scheduled. Writing up notes before the meeting happens. */
const stillScheduled = await M.updateMeeting("mtg-03", {
  summary: "ZZ Agenda agreed in advance.",
  decisions: "",
  status: "Scheduled",
});
check("Scheduled -> Scheduled is accepted", stillScheduled.ok === true);
check("and files no activity", (await logCount()) === 1, `${await logCount()}`);

/* 6. Cancelled -> Completed. Outside the one transition this phase writes
      for, so it stays silent even though the meeting ends up Completed. */
const fromCancelled = await M.updateMeeting("mtg-02", {
  summary: "ZZ It went ahead after all.",
  decisions: "",
  status: "Completed",
});
check("Cancelled -> Completed is accepted", fromCancelled.ok === true);
check(
  "and files no activity: only Scheduled -> Completed does, in this phase",
  (await logCount()) === 1,
  `${await logCount()}`,
);

/* 7. A meeting reopened and completed a second time. The transition gate
      alone would fire again here; the not-exists guard is what holds. */
const reopenedOnce = await M.updateMeeting("mtg-05", {
  summary: "ZZ Held.",
  decisions: "",
  status: "Completed",
});
check("mtg-05 completes and is logged", reopenedOnce.ok === true && (await logCount()) === 2);
const reopened = await M.updateMeeting("mtg-05", {
  summary: "ZZ Held.",
  decisions: "",
  status: "Scheduled",
});
check("putting it back on the book is accepted", reopened.ok === true);
const recompleted = await M.updateMeeting("mtg-05", {
  summary: "ZZ Held, again.",
  decisions: "",
  status: "Completed",
});
check("completing it a second time is accepted", recompleted.ok === true);
check(
  "but the account is not told the buyer was seen twice",
  (await logCount()) === 2,
  `${await logCount()}`,
);
check(
  "exactly one 'Meeting completed' exists for that meeting",
  (await logRows()).filter((a) => a.meeting_id === "mtg-05").length === 1,
);
check(
  "and the second save does not claim to have logged anything",
  !recompleted.changed.some((c) => c.includes("activity")),
  JSON.stringify(recompleted.changed),
);

/* 8. Another client's meeting. Refused before any write. */
const foreign = await M.updateMeeting("mtg-99", {
  summary: "ZZ Should never land.",
  decisions: "",
  status: "Completed",
});
check("another client's meeting is refused", foreign.ok === false);
check("and no activity was filed on their account", (await logCount()) === 2, `${await logCount()}`);
check(
  "nothing references the foreign account",
  !(await logRows()).some((a) => a.retailer_id === "zz-foreign"),
);

/* == F. What the activity did NOT touch ================================ */

heading("F. What the activity did NOT touch");

check(
  "the notes survived every edit intact",
  (await row("mtg-01")).summary === NOTES + " ZZ And a second paragraph.",
  (await row("mtg-01")).summary,
);
check(
  "so did the decisions",
  (await row("mtg-01")).decisions.length === 3,
  JSON.stringify((await row("mtg-01")).decisions),
);

const m1 = (
  await db.query(`select retailer_id, broker_id, title, location,
         to_char(scheduled_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') as at
    from meetings where id = 'mtg-01'`)
).rows[0];
check("the meeting still belongs to the same account", m1.retailer_id === "zz-account");
check("the broker relationship is intact", m1.broker_id === "zz-broker", m1.broker_id);
check("the title is intact", m1.title === "ZZ Range view", m1.title);
check("the scheduled time is intact", m1.at === "2026-09-05 10:00", m1.at);
check("the location is intact", m1.location === "ZZ Head office", m1.location);

const untouched = await db.query(`select
  (select count(*)::int from meeting_attendees) as attendees,
  (select count(*)::int from contacts) as contacts,
  (select count(*)::int from actions) as actions,
  (select count(*)::int from workstream_items) as items,
  (select count(*)::int from buyer_feedback) as feedback,
  (select count(*)::int from samples) as samples,
  (select count(*)::int from meetings) as meetings`);
const u = untouched.rows[0];
check("no attendee row was created", u.attendees === 0, `${u.attendees}`);
check("no contact row was created", u.contacts === 0, `${u.contacts}`);
check("no action row was created", u.actions === 0, `${u.actions}`);
check("no workstream item was created", u.items === 0, `${u.items}`);
check("no buyer feedback was invented", u.feedback === 0, `${u.feedback}`);
check("no sample row was created", u.samples === 0, `${u.samples}`);
check("no meeting was created or deleted", u.meetings === 8, `${u.meetings}`);

check(
  "every retailer column is exactly as it was before the first completion",
  JSON.stringify((await db.query(RETAILER_STATE)).rows) === retailersBefore,
);

ws = await reread();
const allText = JSON.stringify([ws.activities, S.getRecentActivity(), S.getRetailerTimeline("zz-account")]);
check(
  "no absence rendered as the string \"null\" or \"undefined\"",
  !allText.includes('"null"') && !allText.includes('"undefined"'),
);

/* == G. A meeting on an unassigned account ============================= */

heading("G. A meeting on an unassigned account");

/* meetings.broker_id is nullable, so the activity's person_id is too. This is
   the case that would have crashed the read layer before person_id was given
   its honest type. */
const bare = await M.updateMeeting("mtg-04", {
  summary: "ZZ Somebody held it, but nobody is recorded.",
  decisions: "",
  status: "Completed",
});
check("it completes like any other", bare.ok === true, JSON.stringify(bare.errors));
check("and is logged", (await logCount()) === 3, `${await logCount()}`);

const bareLog = (await logRows()).find((a) => a.meeting_id === "mtg-04");
check("its person_id is NULL, not an invented broker", bareLog.person_id === null, bareLog.person_id);
check("it still references the account", bareLog.retailer_id === "zz-bare", bareLog.retailer_id);

ws = await reread();
const bareRead = ws.activities.find((a) => a.id === bareLog.id);
check(
  "the read layer reports the absence as undefined, not as the string 'null'",
  bareRead.personId === undefined,
  JSON.stringify(bareRead.personId),
);
check(
  "and it renders as Unassigned rather than breaking the panel",
  S.getOwnerName(bareRead.personId) === "Unassigned",
  S.getOwnerName(bareRead.personId),
);
check(
  "the unassigned account's Activity panel shows it",
  S.getRetailerActivities("zz-bare").some((a) => a.id === bareLog.id),
);

/* == H. Transaction safety ============================================= */

heading("H. Transaction safety, in both directions");

/* Both halves live in one withTransaction, so neither can survive the other's
   failure. Proved by making each half fail on purpose, with a constraint that
   is added and dropped again -- no junk row is left behind, which matters
   here because activities cannot be deleted. */

const beforeSafety = await logCount();

/* H1. The activity insert fails -> the status update must roll back. */
await db.exec(
  `alter table activities add constraint zz_block_log
     check (meeting_id is distinct from 'mtg-06')`,
);
let threw = false;
try {
  await M.updateMeeting("mtg-06", { summary: "ZZ Held.", decisions: "", status: "Completed" });
} catch {
  threw = true;
}
check("a failing activity insert surfaces as an error, not a quiet success", threw);
check(
  "the meeting is still Scheduled — the status update rolled back with it",
  (await row("mtg-06")).status === "Scheduled",
  (await row("mtg-06")).status,
);
check("its notes were not written either", (await row("mtg-06")).summary === null);
check("and no activity row survived", (await logCount()) === beforeSafety, `${await logCount()}`);

await db.exec(`alter table activities drop constraint zz_block_log`);
const recovered = await M.updateMeeting("mtg-06", {
  summary: "ZZ Held.", decisions: "", status: "Completed",
});
check(
  "with the obstacle gone the same transition succeeds and logs once",
  recovered.ok === true && (await logCount()) === beforeSafety + 1,
  `${await logCount()}`,
);

/* H2. The meeting update fails -> no activity may remain. */
const beforeSecond = await logCount();
await db.exec(
  `alter table meetings add constraint zz_block_save
     check (id <> 'mtg-07' or status <> 'Completed')`,
);
threw = false;
try {
  await M.updateMeeting("mtg-07", { summary: "ZZ Held.", decisions: "", status: "Completed" });
} catch {
  threw = true;
}
check("a failing meeting update surfaces as an error", threw);
check(
  "the meeting is still Scheduled",
  (await row("mtg-07")).status === "Scheduled",
  (await row("mtg-07")).status,
);
check(
  "and no activity was left behind for a completion that never happened",
  (await logCount()) === beforeSecond,
  `${await logCount()}`,
);
await db.exec(`alter table meetings drop constraint zz_block_save`);

/* Nothing above reached for the append-only escape hatch, so the rule that
   protects the history was in force throughout. */
const escapeHatch = await db.query(
  `select coalesce(current_setting('cld.allow_history_write', true), 'off') as v`,
);
check(
  "the append-only escape hatch was never switched on",
  escapeHatch.rows[0].v === "off",
  escapeHatch.rows[0].v,
);

ws = await reread();
check(
  "the final log reads as one entry per meeting actually held through the portal",
  ws.activities.length === 4 &&
    ws.activities.every((a) => a.type === "Meeting completed"),
  JSON.stringify(ws.activities.map((a) => [a.id, a.type])),
);
check(
  "each one points at a distinct meeting",
  new Set((await logRows()).map((a) => a.meeting_id)).size === 4,
  JSON.stringify((await logRows()).map((a) => a.meeting_id)),
);

/* == I. Removed again ================================================== */

heading("I. The throwaway database, removed again");

await server.stop();
await db.close();
fs.rmSync(SCRATCH, { recursive: true, force: true });
check("the scratch database is gone", !fs.existsSync(SCRATCH), SCRATCH);

heading("Result");
if (failures === 0) {
  line(ok("A meeting being held becomes account history, exactly once."));
} else {
  line(bad(`${failures} check${failures === 1 ? "" : "s"} failed.`));
}
console.log("");
process.exit(failures === 0 ? 0 : 1);
