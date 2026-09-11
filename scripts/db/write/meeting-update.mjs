/**
 * Writing up a meeting, and the Upcoming-to-Past move that follows.
 *
 *   node --import ./scripts/db/alias.mjs scripts/db/write/meeting-update.mjs
 *
 *   A. a throwaway database, migrated from supabase/migrations
 *   B. two accounts on this client, one on another, and meetings on each
 *   C. notes and decisions written up
 *   D. Scheduled -> Completed, and the move from Upcoming to Past
 *   E. Scheduled -> Cancelled
 *   F. emptying the fields again
 *   G. what the write layer refuses
 *   H. what updateMeeting cannot reach
 *   I. what updateMeeting did NOT touch
 *   J. the throwaway database, removed again
 *
 * Section H is the reason this suite matters more than most. updateMeeting is
 * the first edit path in the portal, and the interesting question about an
 * edit is never what it writes — it is what it leaves alone. The statement
 * names three columns; retailer_id, broker_id, scheduled_at, title and
 * location are absent from it, and that absence is asserted rather than
 * assumed, by reading every one of them back after every write.
 *
 * WHY PGLITE, AND NOT THE WORKING DATABASE
 * A real meeting now exists in production — SM Markets x Range View — and the
 * brief is explicit that it must not be touched. This suite mutates meetings,
 * so it builds its own Postgres, applies the real migrations, runs the real
 * mutation and the real selectors against it, and deletes the whole thing at
 * the end.
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
const SCRATCH = path.join(ROOT, ".db", "meeting-update");

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

/* Fail closed. This suite mutates meetings, and a real one exists in
   production; being pointed at it is not a degraded run, it is the thing that
   must not happen. */
if (process.env.DATABASE_URL) {
  console.log(
    bad("\n  DATABASE_URL is set in this shell.\n") +
      dim("  This suite UPDATES MEETINGS. It builds its own throwaway Postgres\n" +
          "  and must never be pointed at a working database. Unset it and\n" +
          "  run again.\n"),
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

/* == B. Accounts and meetings ========================================== */

heading("B. Two accounts on this client, one on another, and meetings on each");

await db.exec(`
  insert into clients (id, name, workspace, is_demo) values
    ('client',          'ZZ Meeting Update', 'ZZ Workspace', true),
    ('zz-other-client', 'ZZ Other Client',   'ZZ Elsewhere', true);
  insert into brokers (id, client_id, name, short_name) values
    ('zz-broker', 'client', 'ZZ Broker Partners', 'ZZ Broker');
  insert into retailers (id, client_id, name, short_name, channel, assigned_broker_id) values
    ('zz-account', 'client',          'ZZ Update Account', 'ZZ Update',  'Supermarket', 'zz-broker'),
    ('zz-foreign', 'zz-other-client', 'ZZ Foreign Account', 'ZZ Foreign', 'Supermarket', null);
  insert into meetings (id, retailer_id, scheduled_at, title, status, broker_id, location) values
    ('mtg-01', 'zz-account', '2026-09-15 10:00:00+00', 'ZZ Range view',   'Scheduled', 'zz-broker', 'ZZ Head office'),
    ('mtg-02', 'zz-account', '2026-09-18 09:00:00+00', 'ZZ Second call',  'Scheduled', 'zz-broker', null),
    ('mtg-99', 'zz-foreign', '2026-09-15 10:00:00+00', 'ZZ Foreign talk', 'Scheduled', null,        null);
`);
line(dim("mtg-01 and mtg-02 belong to this client; mtg-99 belongs to another"));

/* The fingerprint of everything the edit must not be able to reach. Taken
   before the first write and compared again after every one. */
const LOCKED = `select id, retailer_id, broker_id, title, location,
       to_char(scheduled_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') as at
  from meetings order by id`;
const lockedBefore = JSON.stringify((await db.query(LOCKED)).rows);

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

/** Reload the snapshot the selectors read, the way a request would. */
const reread = async () => {
  resetWorkspace();
  await loadWorkspace();
  return workspace();
};

/* == C. Notes and decisions ============================================ */

heading("C. Notes and decisions written up");

const NOTES =
  "ZZ Buyer walked the range and asked for a price list.\n\nThey liked the puree.";

const wrote = await M.updateMeeting("mtg-01", {
  summary: NOTES,
  decisions: "ZZ Send the price list\nZZ Revisit in October",
  status: "Scheduled",
});
check("the write-up is accepted", wrote.ok === true, JSON.stringify(wrote.errors));
check(
  "and reports what moved, not a bare success",
  wrote.changed.some((c) => c.includes("Notes")) &&
    wrote.changed.some((c) => c.includes("decisions")),
  JSON.stringify(wrote.changed),
);

let stored = await row("mtg-01");
check("summary is stored verbatim, blank line and all", stored.summary === NOTES);
check(
  "decisions are stored as a two-element text[]",
  Array.isArray(stored.decisions) &&
    stored.decisions.length === 2 &&
    stored.decisions[0] === "ZZ Send the price list" &&
    stored.decisions[1] === "ZZ Revisit in October",
  JSON.stringify(stored.decisions),
);
check("the status was left where it was", stored.status === "Scheduled");

/* Blank lines between decisions are a person thinking, not decisions. */
const messy = await M.updateMeeting("mtg-02", {
  summary: "ZZ Short note.",
  decisions: "\n\nZZ One thing\n\n   \nZZ Another thing\n\n",
  status: "Scheduled",
});
check("a messy decision list is accepted", messy.ok === true, JSON.stringify(messy.errors));
stored = await row("mtg-02");
check(
  "blank and whitespace-only lines are dropped, not stored as empty decisions",
  stored.decisions.length === 2 &&
    stored.decisions.every((d) => d.trim().length > 0),
  JSON.stringify(stored.decisions),
);

let ws = await reread();
check(
  "the read layer shows the saved notes",
  ws.meetings.find((m) => m.id === "mtg-01")?.summary === NOTES,
);
check(
  "and the saved decisions",
  ws.meetings.find((m) => m.id === "mtg-01")?.decisions.length === 2,
);

/* == D. Scheduled -> Completed ========================================= */

heading("D. Scheduled -> Completed, and the move from Upcoming to Past");

check(
  "before: mtg-01 is in Upcoming",
  S.getUpcomingMeetings().some((u) => u.meeting?.id === "mtg-01"),
);
check(
  "before: mtg-01 is not in Past",
  !S.getMeetingSummaries().some((p) => p.meeting.id === "mtg-01"),
);

const completed = await M.updateMeeting("mtg-01", {
  summary: NOTES,
  decisions: "ZZ Send the price list\nZZ Revisit in October",
  status: "Completed",
});
check("the transition is accepted", completed.ok === true, JSON.stringify(completed.errors));
check(
  "and is reported as a status move",
  completed.changed.some((c) => c === "Status -> Completed"),
  JSON.stringify(completed.changed),
);
check("the column now reads Completed", (await row("mtg-01")).status === "Completed");

ws = await reread();
check(
  "after: mtg-01 is in Past",
  S.getMeetingSummaries().some((p) => p.meeting.id === "mtg-01"),
  JSON.stringify(S.getMeetingSummaries().map((p) => p.meeting.id)),
);
check(
  "after: mtg-01 is no longer in Upcoming",
  !S.getUpcomingMeetings().some((u) => u.meeting?.id === "mtg-01"),
  JSON.stringify(S.getUpcomingMeetings().map((u) => u.meeting?.id)),
);
check(
  "the detail page reads the new status",
  S.getMeetingDetail("mtg-01")?.meeting.status === "Completed",
);
check(
  "and now counts as held on the account",
  S.getRetailerMeetings("zz-account").map((m) => m.id).join() === "mtg-01",
  S.getRetailerMeetings("zz-account").map((m) => m.id).join(),
);
check(
  "the notes panel picks it up",
  S.getRetailerNotes("zz-account").find((n) => n.id === "mtg-01")?.body === NOTES,
);
check(
  "the broker's notes pick it up",
  S.getBrokerNotes("zz-broker").some((n) => n.id === "mtg-01"),
);
check(
  "broker inheritance is unchanged by the edit",
  S.getMeetingDetail("mtg-01")?.broker?.id === "zz-broker",
);
check(
  "mtg-02 is still Scheduled and still in Upcoming",
  S.getUpcomingMeetings().some((u) => u.meeting?.id === "mtg-02"),
);

/* == E. Scheduled -> Cancelled ========================================= */

heading("E. Scheduled -> Cancelled");

const cancelled = await M.updateMeeting("mtg-02", {
  summary: "ZZ Buyer moved it.",
  decisions: "",
  status: "Cancelled",
});
check("the transition is accepted", cancelled.ok === true, JSON.stringify(cancelled.errors));
check("the column reads Cancelled", (await row("mtg-02")).status === "Cancelled");

ws = await reread();
check(
  "a cancelled meeting leaves Upcoming",
  !S.getUpcomingMeetings().some((u) => u.meeting?.id === "mtg-02"),
  JSON.stringify(S.getUpcomingMeetings().map((u) => u.meeting?.id)),
);

/* The record must not vanish. A meeting on neither tab has been deleted by
   the interface, which is the one outcome worse than showing it in the
   slightly wrong place. */
const cancelledRow = S.getMeetingSummaries().find((p) => p.meeting.id === "mtg-02");
check(
  "but it IS on the Past list, not lost between the two",
  cancelledRow !== undefined,
  JSON.stringify(S.getMeetingSummaries().map((p) => p.meeting.id)),
);
check(
  "and the row carries Cancelled, so it cannot read as Completed",
  cancelledRow?.meeting.status === "Cancelled",
  cancelledRow?.meeting.status,
);
check(
  "the Past list now holds both, each with its own status",
  S.getMeetingSummaries().length === 2 &&
    S.getMeetingSummaries().filter((p) => p.meeting.status === "Completed").length === 1 &&
    S.getMeetingSummaries().filter((p) => p.meeting.status === "Cancelled").length === 1,
  JSON.stringify(S.getMeetingSummaries().map((p) => [p.meeting.id, p.meeting.status])),
);
check(
  "its own record still opens and reads Cancelled",
  S.getMeetingDetail("mtg-02")?.meeting.status === "Cancelled",
);

/* Past is wider than held, and that distinction has to hold: a cancelled
   meeting has nothing to quote, so nothing that reads what was said may pick
   it up. */
check(
  "a cancelled meeting does not count as held on the account",
  !S.getRetailerMeetings("zz-account").some((m) => m.id === "mtg-02"),
  S.getRetailerMeetings("zz-account").map((m) => m.id).join(),
);
check(
  "the account's notes panel does not quote it",
  !S.getRetailerNotes("zz-account").some((n) => n.id === "mtg-02"),
);
check(
  "getLastMeeting does not return it",
  S.getLastMeeting("zz-account")?.id !== "mtg-02",
  S.getLastMeeting("zz-account")?.id,
);
check(
  "the broker's notes do not quote it",
  !S.getBrokerNotes("zz-broker").some((n) => n.id === "mtg-02"),
);

/* And the Completed behaviour from section D is untouched by all of this. */
check(
  "the Completed meeting is still on Past",
  S.getMeetingSummaries().some((p) => p.meeting.id === "mtg-01"),
);
check(
  "still counts as held",
  S.getRetailerMeetings("zz-account").map((m) => m.id).join() === "mtg-01",
  S.getRetailerMeetings("zz-account").map((m) => m.id).join(),
);
check(
  "and is still absent from Upcoming",
  !S.getUpcomingMeetings().some((u) => u.meeting?.id === "mtg-01"),
);

/* == F. Emptying the fields again ====================================== */

heading("F. Emptying the fields again");

const cleared = await M.updateMeeting("mtg-01", {
  summary: "   \n  ",
  decisions: "\n  \n",
  status: "Completed",
});
check("clearing is accepted", cleared.ok === true, JSON.stringify(cleared.errors));

stored = await row("mtg-01");
check("an empty summary becomes NULL, not an empty string", stored.summary === null, JSON.stringify(stored.summary));
check(
  "empty decisions become an empty array, not [\"\"]",
  Array.isArray(stored.decisions) && stored.decisions.length === 0,
  JSON.stringify(stored.decisions),
);

ws = await reread();
check(
  "the read layer reports the summary as absent",
  ws.meetings.find((m) => m.id === "mtg-01")?.summary === undefined,
);

/* Saving a form nobody changed should say so. */
const noop = await M.updateMeeting("mtg-01", {
  summary: "",
  decisions: "",
  status: "Completed",
});
check(
  "re-saving an unchanged record reports Nothing changed",
  noop.ok === true && noop.changed.join() === "Nothing changed",
  JSON.stringify(noop.changed),
);

/* == G. What the write layer refuses =================================== */

heading("G. What the write layer refuses");

const badStatus = await M.updateMeeting("mtg-01", {
  summary: "",
  decisions: "",
  status: "Postponed",
});
check(
  "a status outside the lookup is refused",
  badStatus.ok === false && Boolean(badStatus.errors.status),
  JSON.stringify(badStatus.errors),
);

const foreign = await M.updateMeeting("mtg-99", {
  summary: "ZZ Should never land.",
  decisions: "ZZ Nor this",
  status: "Completed",
});
check("a meeting on another client is refused", foreign.ok === false, JSON.stringify(foreign));
check("and named as not on this book", Boolean(foreign.errors.form), JSON.stringify(foreign.errors));

const foreignRow = await row("mtg-99");
check(
  "the other client's meeting is untouched",
  foreignRow.status === "Scheduled" &&
    foreignRow.summary === null &&
    foreignRow.decisions.length === 0,
  JSON.stringify(foreignRow),
);

const unknown = await M.updateMeeting("mtg-does-not-exist", {
  summary: "",
  decisions: "",
  status: "Completed",
});
check("an unknown id is refused", unknown.ok === false && Boolean(unknown.errors.form));

const longDecision = await M.updateMeeting("mtg-01", {
  summary: "",
  decisions: "Z".repeat(501),
  status: "Completed",
});
check(
  "an over-long decision is refused",
  longDecision.ok === false && Boolean(longDecision.errors.decisions),
);

const tooMany = await M.updateMeeting("mtg-01", {
  summary: "",
  decisions: Array.from({ length: 21 }, (_, i) => "ZZ decision " + i).join("\n"),
  status: "Completed",
});
check(
  "twenty-one decisions is refused",
  tooMany.ok === false && Boolean(tooMany.errors.decisions),
);

const longNotes = await M.updateMeeting("mtg-01", {
  summary: "Z".repeat(4001),
  decisions: "",
  status: "Completed",
});
check(
  "an over-long write-up is refused",
  longNotes.ok === false && Boolean(longNotes.errors.summary),
);

stored = await row("mtg-01");
check(
  "none of those five refusals wrote anything",
  stored.status === "Completed" && stored.summary === null && stored.decisions.length === 0,
  JSON.stringify(stored),
);

/* == H. What updateMeeting cannot reach ================================ */

heading("H. What updateMeeting cannot reach");

const lockedAfter = JSON.stringify((await db.query(LOCKED)).rows);
check(
  "retailer_id, broker_id, title, location and scheduled_at are byte-identical after every write",
  lockedAfter === lockedBefore,
  lockedAfter,
);
line(dim("the update statement names three columns; these five are not among them"));

/* Each one asserted by name, so a future change that widens the statement
   fails on the specific field rather than on one opaque comparison. */
const m1 = (await db.query(LOCKED)).rows.find((m) => m.id === "mtg-01");
check("retailer_id is still zz-account", m1.retailer_id === "zz-account", m1.retailer_id);
check("broker_id is still zz-broker", m1.broker_id === "zz-broker", m1.broker_id);
check("title is still ZZ Range view", m1.title === "ZZ Range view", m1.title);
check("scheduled_at is still 2026-09-15 10:00", m1.at === "2026-09-15 10:00", m1.at);
check("location is still ZZ Head office", m1.location === "ZZ Head office", m1.location);

/* == I. What updateMeeting did NOT touch =============================== */

heading("I. What updateMeeting did NOT touch");

const untouched = await db.query(`select
  (select count(*)::int from activities) as activities,
  (select count(*)::int from meeting_attendees) as attendees,
  (select count(*)::int from contacts) as contacts,
  (select count(*)::int from actions) as actions,
  (select count(*)::int from workstream_items) as items,
  (select count(*)::int from retailers where next_meeting_status is not null) as planning_status,
  (select count(*)::int from retailers where next_meeting_at is not null) as planning_date,
  (select count(*)::int from meetings) as meetings`);
const u = untouched.rows[0];

check("no activity row was created", u.activities === 0, `${u.activities}`);
check("no attendee row was created", u.attendees === 0, `${u.attendees}`);
check("no contact row was created", u.contacts === 0, `${u.contacts}`);
check("no action row was created", u.actions === 0, `${u.actions}`);
check("no workstream item was touched", u.items === 0, `${u.items}`);
check("retailers.next_meeting_status was not written", u.planning_status === 0, `${u.planning_status}`);
check("retailers.next_meeting_at was not written", u.planning_date === 0, `${u.planning_date}`);
check("no meeting was created or deleted", u.meetings === 3, `${u.meetings}`);

const accountStill = await db.query(
  `select pipeline_status, standing, current_target from retailers where id = 'zz-account'`,
);
check(
  "the account's own status is unchanged by completing its meeting",
  accountStill.rows[0].pipeline_status === "Not reached out yet" &&
    accountStill.rows[0].standing === "Active" &&
    accountStill.rows[0].current_target === "Target",
  JSON.stringify(accountStill.rows[0]),
);

/* Reloaded first: the last successful write called resetWorkspace, which is
   exactly what it should do — the snapshot a selector reads is stale the
   moment a write commits, and the read layer says so rather than serving it. */
ws = await reread();
const allText = JSON.stringify([ws.meetings, S.getUpcomingMeetings(), S.getMeetingSummaries()]);
check(
  "no absence rendered as the string \"null\" or \"undefined\"",
  !allText.includes('"null"') && !allText.includes('"undefined"'),
);

/* == J. Removed again ================================================== */

heading("J. The throwaway database, removed again");

await server.stop();
await db.close();
fs.rmSync(SCRATCH, { recursive: true, force: true });

check("the scratch database is gone", !fs.existsSync(SCRATCH), SCRATCH);

heading("Result");
if (failures === 0) {
  console.log(`  ${ok("A meeting can be written up, completed, and nothing else moves.")}\n`);
} else {
  console.log(`  ${bad(`${failures} check(s) failed.`)}\n`);
}

process.exit(failures ? 1 : 0);
