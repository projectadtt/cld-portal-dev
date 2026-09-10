/**
 * Putting a meeting on the book, and the Past/Upcoming split that follows.
 *
 *   node --import ./scripts/db/alias.mjs scripts/db/write/meeting-create.mjs
 *
 *   A. a throwaway database, migrated from supabase/migrations
 *   B. two accounts on this client, and one on another
 *   C. createMeeting, through the real mutation
 *   D. broker inheritance, both ways
 *   E. status read back as a field, not spent as a filter
 *   F. Upcoming and Past, from the meetings table
 *   G. what the write layer refuses
 *   H. what createMeeting did NOT touch
 *   I. Step 0's nullability behaviour, still intact
 *   J. the throwaway database, removed again
 *
 * This is the first write the meetings table has ever had, so the suite is as
 * much about what the mutation leaves alone as what it writes: no activity
 * row, no attendee row, no change to the account's own planning fields. Those
 * are three separate phases and each one would be easy to half-build here.
 *
 * WHY PGLITE, AND NOT THE WORKING DATABASE
 * createMeeting is a write. The brief is explicit that no meeting may be
 * created in production during implementation, and a meeting cannot be
 * un-created cleanly — its id is allocated from a series and activities and
 * attendees hang off it. So the suite builds its own Postgres, applies the
 * real migrations, and deletes the whole thing at the end.
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
const SCRATCH = path.join(ROOT, ".db", "meeting-create");

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

/* Fail closed. This suite writes, so being pointed at a real database is not
   a degraded run — it is the thing that must not happen. */
if (process.env.DATABASE_URL) {
  console.log(
    bad("\n  DATABASE_URL is set in this shell.\n") +
      dim("  This suite CREATES MEETINGS. It builds its own throwaway Postgres\n" +
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

const vocab = await db.query(
  `select value from lookup_meeting_status order by sort_order`,
);
check(
  "lookup_meeting_status is Scheduled / Completed / Cancelled",
  vocab.rows.map((r) => r.value).join(",") === "Scheduled,Completed,Cancelled",
  vocab.rows.map((r) => r.value).join(","),
);

/* == B. Two accounts here, one elsewhere =============================== */

heading("B. Two accounts on this client, and one on another");

/* 'client' is the id the application reads by default. 'zz-other-client' is a
   second tenant, and exists only so section G can try to reach across. */
await db.exec(`
  insert into clients (id, name, workspace, is_demo) values
    ('client',          'ZZ Meeting Create', 'ZZ Workspace', true),
    ('zz-other-client', 'ZZ Other Client',   'ZZ Elsewhere', true);
  insert into brokers (id, client_id, name, short_name) values
    ('zz-broker', 'client', 'ZZ Broker Partners', 'ZZ Broker');
  insert into retailers (id, client_id, name, short_name, channel, assigned_broker_id) values
    ('zz-covered',   'client',          'ZZ Covered Account',   'ZZ Covered',   'Supermarket', 'zz-broker'),
    ('zz-uncovered', 'client',          'ZZ Uncovered Account', 'ZZ Uncovered', 'Supermarket', null),
    ('zz-foreign',   'zz-other-client', 'ZZ Foreign Account',   'ZZ Foreign',   'Supermarket', null);
`);
line(dim("zz-covered has a broker; zz-uncovered has none; zz-foreign is another tenant's"));

/* == C. createMeeting, through the real mutation ======================= */

heading("C. createMeeting, through the real mutation");

const port = await freePort();
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 10 });
await server.start();

process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${port}/postgres`;
line(dim(`the application's pg driver connected to 127.0.0.1:${port}`));

const load = (p) => import(pathToFileURL(path.join(ROOT, p)).href);

const { loadWorkspace, workspace } = await load("src/lib/db/workspace.ts");
const M = await load("src/lib/db/mutations.ts");
const S = await load("src/lib/selectors.ts");

const scheduled = await M.createMeeting("zz-covered", {
  title: "ZZ Range review",
  scheduledOn: "2026-09-20",
  scheduledTime: "14:30",
  status: "Scheduled",
});
check("a Scheduled meeting is created", scheduled.ok === true, JSON.stringify(scheduled.errors));
check("its id is in the mtg-NN series", scheduled.id === "mtg-01", scheduled.id);

const completed = await M.createMeeting("zz-covered", {
  title: "ZZ Introductory call",
  scheduledOn: "2026-09-01",
  scheduledTime: "",
  status: "Completed",
});
check("a Completed meeting is created", completed.ok === true, JSON.stringify(completed.errors));
check("the series advances", completed.id === "mtg-02", completed.id);

const stored = await db.query(
  `select id, retailer_id, status, broker_id, summary, decisions, location,
          to_char(scheduled_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') as at
     from meetings order by id`,
);

check(
  "the day and time round-trip as entered, in UTC",
  stored.rows.find((m) => m.id === "mtg-01").at === "2026-09-20 14:30",
  stored.rows.find((m) => m.id === "mtg-01").at,
);
check(
  "an omitted time lands on midnight, not a plausible business hour",
  stored.rows.find((m) => m.id === "mtg-02").at === "2026-09-01 00:00",
  stored.rows.find((m) => m.id === "mtg-02").at,
);
check(
  "summary is NULL, not an empty string",
  stored.rows.every((m) => m.summary === null),
  JSON.stringify(stored.rows.map((m) => m.summary)),
);
check(
  "decisions is the empty array from the column default",
  stored.rows.every((m) => Array.isArray(m.decisions) && m.decisions.length === 0),
  JSON.stringify(stored.rows.map((m) => m.decisions)),
);
check(
  "location is left NULL — out of scope",
  stored.rows.every((m) => m.location === null),
);

/* == D. Broker inheritance ============================================= */

heading("D. Broker inheritance, both ways");

check(
  "a meeting on a covered account inherits that broker",
  stored.rows.every((m) => m.broker_id === "zz-broker"),
  JSON.stringify(stored.rows.map((m) => m.broker_id)),
);

const bare = await M.createMeeting("zz-uncovered", {
  title: "ZZ First approach",
  scheduledOn: "2026-09-25",
  scheduledTime: "",
  status: "Scheduled",
});
check("a meeting on an uncovered account is created", bare.ok === true, JSON.stringify(bare.errors));

const bareRow = (
  await db.query(`select broker_id from meetings where id = $1`, [bare.id])
).rows[0];
check("its broker_id is NULL, not a stand-in", bareRow.broker_id === null, String(bareRow.broker_id));

/* == E. Status read back as a field ==================================== */

heading("E. Status read back as a field, not spent as a filter");

await loadWorkspace();
const ws = workspace();

check(
  "all three meetings are in the read layer",
  ws.meetings.length === 3,
  `${ws.meetings.length}`,
);
check(
  "each carries its own status",
  ws.meetings.find((m) => m.id === "mtg-01")?.status === "Scheduled" &&
    ws.meetings.find((m) => m.id === "mtg-02")?.status === "Completed" &&
    ws.meetings.find((m) => m.id === "mtg-03")?.status === "Scheduled",
  JSON.stringify(ws.meetings.map((m) => [m.id, m.status])),
);
check(
  "a Scheduled meeting is readable at its own detail page",
  S.getMeetingDetail("mtg-01")?.meeting.status === "Scheduled",
);

/* == F. Upcoming and Past ============================================== */

heading("F. Upcoming and Past, from the meetings table");

const upcoming = S.getUpcomingMeetings();
const past = S.getMeetingSummaries();

check(
  "Upcoming carries both Scheduled meetings",
  upcoming.filter((u) => u.meeting).length === 2 &&
    upcoming.some((u) => u.meeting?.id === "mtg-01") &&
    upcoming.some((u) => u.meeting?.id === "mtg-03"),
  JSON.stringify(upcoming.map((u) => u.meeting?.id ?? "(planning)")),
);
check(
  "Upcoming does not carry the Completed one",
  !upcoming.some((u) => u.meeting?.id === "mtg-02"),
);
check("Upcoming is soonest first", upcoming[0].meeting?.id === "mtg-01", upcoming[0].meeting?.id);
check(
  "Past carries the Completed meeting",
  past.length === 1 && past[0].meeting.id === "mtg-02",
  JSON.stringify(past.map((p) => p.meeting.id)),
);
check(
  "Past does not carry either Scheduled one",
  !past.some((p) => p.meeting.status === "Scheduled"),
);

/* A scheduled meeting has said nothing, so it must not reach the places that
   read what was said. This is the regression the old WHERE clause used to
   prevent for free. */
check(
  "the account's held meetings are the Completed one only",
  S.getRetailerMeetings("zz-covered").map((m) => m.id).join() === "mtg-02",
  S.getRetailerMeetings("zz-covered").map((m) => m.id).join(),
);
check(
  "the notes panel shows only what was actually held",
  S.getRetailerNotes("zz-covered").map((n) => n.id).join() === "mtg-02",
);
check(
  "getLastMeeting does not return a meeting still to come",
  S.getLastMeeting("zz-covered")?.id === "mtg-02",
  S.getLastMeeting("zz-covered")?.id,
);
check(
  "the account's derived meeting status still reads Completed",
  S.getRetailer("zz-covered")?.meetingStatus === "Completed",
  S.getRetailer("zz-covered")?.meetingStatus,
);

/* == G. What the write layer refuses =================================== */

heading("G. What the write layer refuses");

const foreign = await M.createMeeting("zz-foreign", {
  title: "ZZ Cross-tenant attempt",
  scheduledOn: "2026-09-20",
  scheduledTime: "",
  status: "Scheduled",
});
check("a retailer on another client is refused", foreign.ok === false, JSON.stringify(foreign));
check("and named as not on this book", Boolean(foreign.errors.form), JSON.stringify(foreign.errors));

const noTitle = await M.createMeeting("zz-covered", {
  title: "   ",
  scheduledOn: "2026-09-20",
  scheduledTime: "",
  status: "Scheduled",
});
check("an empty title is refused", noTitle.ok === false && Boolean(noTitle.errors.title));

const badDay = await M.createMeeting("zz-covered", {
  title: "ZZ Impossible day",
  scheduledOn: "2026-02-31",
  scheduledTime: "",
  status: "Scheduled",
});
check("2026-02-31 is refused", badDay.ok === false && Boolean(badDay.errors.scheduledOn));

const badTime = await M.createMeeting("zz-covered", {
  title: "ZZ Bad time",
  scheduledOn: "2026-09-20",
  scheduledTime: "25:00",
  status: "Scheduled",
});
check("25:00 is refused", badTime.ok === false && Boolean(badTime.errors.scheduledTime));

const badStatus = await M.createMeeting("zz-covered", {
  title: "ZZ Bad status",
  scheduledOn: "2026-09-20",
  scheduledTime: "",
  status: "Postponed",
});
check(
  "a status outside the lookup is refused",
  badStatus.ok === false && Boolean(badStatus.errors.status),
  JSON.stringify(badStatus.errors),
);

const after = await db.query(`select count(*)::int as n from meetings`);
check("none of those five wrote a row", after.rows[0].n === 3, `${after.rows[0].n}`);

/* == H. What createMeeting did NOT touch =============================== */

heading("H. What createMeeting did NOT touch");

const untouched = await db.query(`select
  (select count(*)::int from activities) as activities,
  (select count(*)::int from meeting_attendees) as attendees,
  (select count(*)::int from contacts) as contacts,
  (select count(*)::int from actions) as actions,
  (select count(*)::int from retailers where next_meeting_status is not null) as planning_status,
  (select count(*)::int from retailers where next_meeting_at is not null) as planning_date`);
const u = untouched.rows[0];

check("no activity row was created", u.activities === 0, `${u.activities}`);
check("no attendee row was created", u.attendees === 0, `${u.attendees}`);
check("no contact row was created", u.contacts === 0, `${u.contacts}`);
check("no action row was created", u.actions === 0, `${u.actions}`);
check(
  "retailers.next_meeting_status was not written",
  u.planning_status === 0,
  `${u.planning_status}`,
);
check(
  "retailers.next_meeting_at was not written",
  u.planning_date === 0,
  `${u.planning_date}`,
);

/* == I. Step 0's nullability behaviour ================================= */

heading("I. Step 0's nullability behaviour, still intact");

const bareDetail = S.getMeetingDetail(bare.id);
check("the uncovered account's meeting resolves", bareDetail !== null);
check("with no broker rather than a stand-in", bareDetail.broker === undefined);
check(
  "named Unassigned by the portal's one word for it",
  S.getOwnerName(bareDetail.meeting.brokerId) === S.UNASSIGNED,
  S.getOwnerName(bareDetail.meeting.brokerId),
);
check("and no summary, since nothing was written up", bareDetail.meeting.summary === undefined);

let threw = false;
try {
  void ("/brokers/" + bareDetail.broker.id);
} catch {
  threw = true;
}
check("the pre-Step-0 `broker.id` access would still have thrown", threw);

const allText = JSON.stringify([ws.meetings, upcoming, past]);
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
  console.log(`  ${ok("A meeting can be put on the book, and lands where it belongs.")}\n`);
} else {
  console.log(`  ${bad(`${failures} check(s) failed.`)}\n`);
}

process.exit(failures ? 1 : 0);
