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
 *   I. how the dates read
 *   J. the throwaway database, removed again
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

/* == I. How the dates read ============================================= */

heading("I. How the dates read");

/* An activity is dated to the event it records, and a meeting may be completed
   before its scheduled day -- so the history spine can legitimately hold a
   date that is still ahead of today. Nothing that reads an activity date may
   therefore say "In 3 days": the entry exists because something happened.
   The account timeline is the one list carrying both tenses, and it chooses by
   what became of the entry rather than by the date.

   Dates are anchored to DEMO_TODAY = 2026-09-09, which is fixed. */
const FUTURE = "2026-09-12"; /* +3 -- the production case: completed early */
const TODAY_ISO = "2026-09-09";
const YESTERDAY = "2026-09-08";
const FOUR_AGO = "2026-09-05";
const FAR_OFF = "2026-08-10"; /* -30, past the relative window */
const CANCELLED_AHEAD = "2026-09-14"; /* +5, and cancelled */

const { DEMO_TODAY } = await load("src/lib/demo.ts");
check("DEMO_TODAY is where these dates are measured from", DEMO_TODAY === TODAY_ISO, DEMO_TODAY);

/* A separate account, so none of the assertions above move. Its planning
   fields are set directly because they are the only source of the timeline's
   one forward-looking entry -- fixture data in a throwaway database, not a
   change to how anything writes them. */
await db.exec(`
  insert into retailers (id, client_id, name, short_name, channel, assigned_broker_id,
                         next_meeting_status, next_meeting_at) values
    ('zz-dates', 'client', 'ZZ Dates Account', 'ZZ Dates', 'Supermarket', 'zz-broker',
     'Scheduled', '${FUTURE}');
  insert into meetings (id, retailer_id, scheduled_at, title, status, broker_id) values
    ('mtg-20', 'zz-dates', '${FUTURE} 10:00:00+00',          'ZZ Held early',   'Scheduled', 'zz-broker'),
    ('mtg-21', 'zz-dates', '${TODAY_ISO} 10:00:00+00',       'ZZ Held today',   'Scheduled', 'zz-broker'),
    ('mtg-22', 'zz-dates', '${YESTERDAY} 10:00:00+00',       'ZZ Held late',    'Scheduled', 'zz-broker'),
    ('mtg-23', 'zz-dates', '${FOUR_AGO} 10:00:00+00',        'ZZ Held midweek', 'Scheduled', 'zz-broker'),
    ('mtg-24', 'zz-dates', '${FAR_OFF} 10:00:00+00',         'ZZ Held long ago','Scheduled', 'zz-broker'),
    ('mtg-25', 'zz-dates', '${CANCELLED_AHEAD} 10:00:00+00', 'ZZ Called off',   'Scheduled', 'zz-broker');
`);

for (const id of ["mtg-20", "mtg-21", "mtg-22", "mtg-23", "mtg-24"]) {
  const r = await M.updateMeeting(id, {
    summary: "ZZ It happened.", decisions: "", status: "Completed",
  });
  if (!r.ok) check(`${id} completes`, false, JSON.stringify(r.errors));
}
const calledOff = await M.updateMeeting("mtg-25", {
  summary: "", decisions: "", status: "Cancelled",
});
check("five are completed and one is cancelled", calledOff.ok === true);

ws = await reread();

/* -- the helper itself ------------------------------------------------- */

check(
  "formatPastDate says nothing forward-looking about a future date",
  S.formatPastDate(FUTURE) === "Sep 12",
  S.formatPastDate(FUTURE),
);
check(
  "and specifically never the words 'In 3 days'",
  !S.formatPastDate(FUTURE).includes("In "),
  S.formatPastDate(FUTURE),
);
check("today still reads Today", S.formatPastDate(TODAY_ISO) === "Today", S.formatPastDate(TODAY_ISO));
check("yesterday still reads Yesterday", S.formatPastDate(YESTERDAY) === "Yesterday", S.formatPastDate(YESTERDAY));
check("four days ago still reads 4 days ago", S.formatPastDate(FOUR_AGO) === "4 days ago", S.formatPastDate(FOUR_AGO));
check("a far-off date falls back to the short date", S.formatPastDate(FAR_OFF) === "Aug 10", S.formatPastDate(FAR_OFF));

/* The property that makes this safe to apply everywhere: for any date that is
   actually behind us, the new helper and the old one agree exactly, so no
   label that is currently right can have changed. They part only ahead of
   today, which is the whole of the defect. */
const past = [TODAY_ISO, YESTERDAY, FOUR_AGO, FAR_OFF, "2026-09-04", "2026-09-03", "2026-07-01"];
check(
  "for every past date formatPastDate agrees with formatRelativeDate, character for character",
  past.every((iso) => S.formatPastDate(iso) === S.formatRelativeDate(iso)),
  JSON.stringify(past.map((iso) => [iso, S.formatPastDate(iso), S.formatRelativeDate(iso)])),
);
check(
  "and they part only ahead of today",
  S.formatPastDate(FUTURE) !== S.formatRelativeDate(FUTURE) &&
    S.formatRelativeDate(FUTURE) === "In 3 days",
  JSON.stringify([S.formatPastDate(FUTURE), S.formatRelativeDate(FUTURE)]),
);
check(
  "formatRelativeDate itself was not touched — it still reads forward when asked",
  S.formatRelativeDate(FUTURE) === "In 3 days" &&
    S.formatRelativeDate("2026-09-10") === "Tomorrow",
);
check(
  "relativeDateLabel was not touched either",
  S.relativeDateLabel(FUTURE) === "In 3 days" && S.relativeDateLabel(FAR_OFF) === undefined,
);
check(
  "pastDateLabel was not touched: it still omits rather than falls back",
  S.pastDateLabel(FUTURE) === undefined && S.pastDateLabel(FAR_OFF) === undefined &&
    S.pastDateLabel(YESTERDAY) === "Yesterday",
);

/* -- Activity: the day headings ---------------------------------------- */

/* What ActivityTimeline renders in its date column, on every surface that
   mounts it: /activity, the Overview, the account's Activity panel, the
   broker page, the product page and a meeting's Related activity. */
const dayLabel = (iso, list = S.getRetailerActivities("zz-dates")) =>
  S.groupActivityByDay(list).find((d) => d.date === iso)?.label;

check(
  "a future-dated activity shows its own date, not 'In 3 days'",
  dayLabel(FUTURE) === "Sep 12",
  dayLabel(FUTURE),
);
check("an activity dated today reads Today", dayLabel(TODAY_ISO) === "Today", dayLabel(TODAY_ISO));
check("yesterday reads Yesterday", dayLabel(YESTERDAY) === "Yesterday", dayLabel(YESTERDAY));
check("four days ago reads 4 days ago", dayLabel(FOUR_AGO) === "4 days ago", dayLabel(FOUR_AGO));
check("older than the window falls back to the short date", dayLabel(FAR_OFF) === "Aug 10", dayLabel(FAR_OFF));

const everyLabel = S.groupActivityByDay(S.getRecentActivity()).map((d) => d.label);
check(
  "no day heading anywhere in the whole log reads forward",
  everyLabel.every((l) => !l.includes("In ") && l !== "Tomorrow"),
  JSON.stringify(everyLabel),
);
check(
  "the global log reached by /activity is covered by the same change",
  S.groupActivityByDay(S.getRecentActivity()).find((d) => d.date === FUTURE)?.label === "Sep 12",
);

/* Ordering is untouched: grouping still runs newest first and the entries
   inside a day keep the order the read layer gave them. */
const groupedDates = S.groupActivityByDay(S.getRecentActivity()).map((d) => d.date);
check(
  "day groups are still newest first",
  groupedDates.join() === [...groupedDates].sort().reverse().join(),
  JSON.stringify(groupedDates),
);
check(
  "a future-dated entry still sorts to the top, because ordering was not changed",
  groupedDates[0] === FUTURE,
  JSON.stringify(groupedDates),
);
check(
  "getRecentActivity still returns every row, newest first",
  S.getRecentActivity().length === ws.activities.length &&
    S.getRecentActivity()[0].date === FUTURE,
);

/* -- the account timeline: the one list with two tenses ---------------- */

/* What RetailerTimeline renders, composed exactly as the component does. */
const timelineDate = (event) =>
  event.upcoming ? S.formatRelativeDate(event.date) : S.formatPastDate(event.date);

const timeline = S.getRetailerTimeline("zz-dates");
const ahead = timeline.find((e) => e.upcoming);
check("the account's scheduled meeting is on the timeline", ahead !== undefined);
check(
  "and still reads 'In 3 days', because it genuinely has not happened",
  timelineDate(ahead) === "In 3 days",
  timelineDate(ahead),
);

const held20 = timeline.find((e) => e.id === "mtg-20");
check("the meeting completed ahead of its day is on the timeline", held20 !== undefined);
check("it is not marked upcoming, because it is behind us", held20?.upcoming === false);
check(
  "so it reads 'Sep 12' rather than 'In 3 days'",
  timelineDate(held20) === "Sep 12",
  timelineDate(held20),
);
check(
  "no entry on the timeline reads forward except the one still on the book",
  timeline.every((e) => e.upcoming || !timelineDate(e).includes("In ")),
  JSON.stringify(timeline.map((e) => [e.id, e.upcoming, timelineDate(e)])),
);
check(
  "and the historical entries read exactly as they did before, where they were already right",
  timelineDate(timeline.find((e) => e.id === "mtg-22")) === "Yesterday" &&
    timelineDate(timeline.find((e) => e.id === "mtg-24")) === "Aug 10",
);

/* A cancelled meeting never reaches the timeline -- getRetailerMeetings asks
   what was held, not what is past -- so it cannot read forward there either.
   Where it IS shown, the Past meetings list, pastDateLabel already answers. */
check(
  "a cancelled future-dated meeting is absent from the timeline entirely",
  !timeline.some((e) => e.id === "mtg-25"),
  JSON.stringify(timeline.map((e) => e.id)),
);
check(
  "it is still on the Past meetings list, carrying Cancelled",
  S.getMeetingSummaries().find((p) => p.meeting.id === "mtg-25")?.meeting.status === "Cancelled",
);
check(
  "and that row prints no forward-looking label either",
  S.pastDateLabel("2026-09-14") === undefined,
);

/* Dedupe is untouched: every activity here shares its meeting's date, so all
   of them are superseded by the meeting record on the merged timeline. */
check(
  "SUPERSEDED_BY_MEETING still drops the same-day activity from the timeline",
  !timeline.some((e) => e.id.startsWith("evt-")),
  JSON.stringify(timeline.map((e) => e.id)),
);
check(
  "including the future-dated one, which is still reachable on the Activity panel",
  S.getRetailerActivities("zz-dates").some((a) => a.date === FUTURE),
);
/* Keyed on the date, which is what the filter actually compares: the read
   layer does not select meeting_id, so an Activity carries no meeting id to
   test against here. */
check(
  "and a meeting's own Related activity still does not quote itself back",
  !S.getMeetingDetail("mtg-20").activities.some((a) => a.date === FUTURE) &&
    S.getMeetingDetail("mtg-22").activities.some((a) => a.date === FUTURE),
  JSON.stringify(S.getMeetingDetail("mtg-20").activities.map((a) => [a.id, a.date])),
);

/* -- "Last activity" ---------------------------------------------------- */

/* Three components print this under a label that says "Last activity", so a
   forward reading is never right there. Asserted through the selectors that
   actually feed them, not through the helper alone. */
const lastOn = S.getLastActivity("zz-dates");
check("the account's last activity is the future-dated one", lastOn?.date === FUTURE, lastOn?.date);
check(
  "and it prints as 'Sep 12' rather than 'In 3 days'",
  S.formatPastDate(lastOn.date) === "Sep 12",
  S.formatPastDate(lastOn.date),
);

const wsRow = S.getWorkstreamRows().find((r) => r.retailer.id === "zz-dates");
check(
  "the workstream row reads it the same way",
  S.formatPastDate(wsRow.lastActivity.date) === "Sep 12",
  S.formatPastDate(wsRow.lastActivity.date),
);
const brokerDetail = S.getBrokerDetail("zz-broker");
const brokerAccount = brokerDetail.accounts.find((a) => a.retailer.id === "zz-dates");
check(
  "so does the broker's account row",
  S.formatPastDate(brokerAccount.lastActivity.date) === "Sep 12",
  S.formatPastDate(brokerAccount.lastActivity.date),
);
check(
  "and the broker portfolio card",
  S.formatPastDate(brokerDetail.portfolio.lastActivity.date) === "Sep 12",
  S.formatPastDate(brokerDetail.portfolio.lastActivity.date),
);

/* -- nothing else moved ------------------------------------------------ */

const stillUntouched = await db.query(`select
  (select count(*)::int from meeting_attendees) as attendees,
  (select count(*)::int from contacts) as contacts,
  (select count(*)::int from actions) as actions`);
check(
  "no attendee, contact or action row appeared while proving any of this",
  stillUntouched.rows[0].attendees === 0 &&
    stillUntouched.rows[0].contacts === 0 &&
    stillUntouched.rows[0].actions === 0,
  JSON.stringify(stillUntouched.rows[0]),
);
check(
  "every activity still carries occurred_at equal to its meeting's scheduled_at",
  (
    await db.query(`select count(*)::int as n from activities a
       join meetings m on m.id = a.meeting_id
      where a.occurred_at <> m.scheduled_at`)
  ).rows[0].n === 0,
);

/* == J. Removed again ================================================== */

heading("J. The throwaway database, removed again");

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
