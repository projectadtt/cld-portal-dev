/**
 * Writing one piece of work onto the shared action list.
 *
 *   node --import ./scripts/db/alias.mjs scripts/db/write/action-create.mjs
 *
 *   A. a throwaway database, migrated from supabase/migrations
 *   B. a client with two accounts, two brokers, and one action already on it
 *   C. the four fields, each one required
 *   D. client scoping: an account and an owner from somewhere else
 *   E. one action created, and what it was given
 *   F. the act-NN series, allocated and not reused
 *   G. where it shows up without anything being told to show it
 *   H. what creating an action did NOT touch
 *   I. the throwaway database, removed again
 *
 * Sections D and H are the reason this suite exists. Both ids on this form come
 * from the browser, so either could name a record on another client's book --
 * and an action is read by nine screens, so a create that quietly disturbed an
 * existing one would surface in all of them.
 *
 * WHY PGLITE, AND NOT THE WORKING DATABASE
 * This suite INSERTs into `actions`, where the working database keeps the
 * client's real work. It builds its own Postgres, applies the real migrations,
 * runs the real mutation and the real selectors against it, and deletes the
 * whole thing at the end.
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
const SCRATCH = path.join(ROOT, ".db", "action-create");

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

/* Fail closed. This suite INSERTs action rows, which in the working database
   are the client's real work. Being pointed at one is not a degraded run, it is
   the thing that must not happen. */
if (process.env.DATABASE_URL) {
  console.log(
    bad("\n  DATABASE_URL is set in this shell.\n") +
      dim(
        "  This suite INSERTS INTO THE actions TABLE. It builds its own\n" +
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

/* The column this path must never leave null, and the default it relies on. */
const dueNullable = (
  await db.query(`select is_nullable, column_default from information_schema.columns
                   where table_name = 'actions' and column_name = 'due'`)
).rows[0];
check(
  "actions.due is nullable in the schema — which is why the write path requires it",
  dueNullable.is_nullable === "YES",
  JSON.stringify(dueNullable),
);
const statusDefault = (
  await db.query(`select column_default from information_schema.columns
                   where table_name = 'actions' and column_name = 'status'`)
).rows[0].column_default;
check(
  "actions.status defaults to 'Open', which is what a new action takes",
  String(statusDefault).includes("'Open'"),
  String(statusDefault),
);

/* == B. A client to write against ====================================== */

heading("B. Two accounts, two brokers, and one action already on the list");

await db.exec(`
  insert into clients (id, name, workspace, is_demo) values
    ('client',          'ZZ Action Client', 'ZZ Workspace', true),
    ('zz-other-client', 'ZZ Other Client',  'ZZ Elsewhere', true);
  insert into brokers (id, client_id, name, short_name, display_order) values
    ('zz-broker',   'client',          'ZZ Broker Partners', 'ZZ Broker', 1),
    ('zz-retired',  'client',          'ZZ Retired Broker',  'ZZ Retired', 2),
    ('zz-foreign-broker', 'zz-other-client', 'ZZ Foreign Broker', 'ZZ Foreign', 1);
  update brokers set archived_at = now() where id = 'zz-retired';
  insert into products (id, client_id, item_id, name, category) values
    ('zz-product', 'client', 'ZZ-1', 'ZZ Test Product', 'ZZ Category');
  insert into retailers
    (id, client_id, name, short_name, channel, assigned_broker_id, pipeline_status, display_order) values
    ('zz-account', 'client',          'ZZ Action Account',  'ZZ Account', 'Supermarket', 'zz-broker', 'Samples sent', 1),
    ('zz-second',  'client',          'ZZ Second Account',  'ZZ Second',  'Club',        null,        'Intro planned', 2),
    ('zz-gone',    'client',          'ZZ Archived',        'ZZ Gone',    'Supermarket', null,        'Intro planned', 3),
    ('zz-foreign', 'zz-other-client', 'ZZ Foreign Account', 'ZZ Foreign', 'Supermarket', null,        'Intro planned', 1);
  update retailers set archived_at = now() where id = 'zz-gone';
  insert into workstream_items (id, retailer_id, product_id, broker_id) values
    ('zz-ws-01', 'zz-account', 'zz-product', 'zz-broker');
  insert into actions (id, retailer_id, owner_id, label, status, due, workstream_item_id, display_order) values
    ('act-01', 'zz-account', 'zz-broker', 'ZZ Existing work', 'Open', '2026-09-20', 'zz-ws-01', 1);
  insert into meetings (id, retailer_id, scheduled_at, title, status) values
    ('zz-mtg-01', 'zz-account', '2026-09-05 10:00:00+00', 'ZZ Range view', 'Scheduled');
`);
line(dim("act-01 already on the list, one broker archived, one account archived, one of each elsewhere"));

/** act-01 exactly as it starts, so any disturbance to it is visible. */
const ACT_01 = `select * from actions where id = 'act-01'`;
const act01Before = JSON.stringify((await db.query(ACT_01)).rows);

const port = await freePort();
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 10 });
await server.start();

process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${port}/postgres`;
line(dim(`the application's pg driver connected to 127.0.0.1:${port}`));

const load = (p) => import(pathToFileURL(path.join(ROOT, p)).href);

const { loadWorkspace, workspace, resetWorkspace } = await load("src/lib/db/workspace.ts");
const M = await load("src/lib/db/mutations.ts");
const S = await load("src/lib/selectors.ts");

const rows = async () =>
  (
    await db.query(`select id, retailer_id, owner_id, label, status, due::text as due,
           product_id, workstream_item_id, meeting_id, description, completed_at, display_order
      from actions order by id`)
  ).rows;

const count = async () => (await db.query(`select count(*)::int as n from actions`)).rows[0].n;

/** Reload the snapshot the selectors read, the way a request would. */
const reread = async () => {
  resetWorkspace();
  await loadWorkspace();
  return workspace();
};

/** A draft that is valid in every respect, so each test can spoil one field. */
const GOOD = {
  retailerId: "zz-account",
  ownerId: "zz-broker",
  label: "ZZ Send the price list",
  due: "2026-09-15",
};

check("one action exists before anything is created", (await count()) === 1);

/* == C. Each field is required ========================================= */

heading("C. The four fields, each one required");

const REQUIRED = [
  ["no account", { ...GOOD, retailerId: "" }, "retailerId"],
  ["no owner", { ...GOOD, ownerId: "" }, "ownerId"],
  ["no wording", { ...GOOD, label: "" }, "label"],
  ["wording that is only spaces", { ...GOOD, label: "   " }, "label"],
  ["no due date", { ...GOOD, due: "" }, "due"],
  ["a due date that is not a date", { ...GOOD, due: "soon" }, "due"],
  ["a due date that does not exist", { ...GOOD, due: "2026-02-31" }, "due"],
  ["wording past 300 characters", { ...GOOD, label: "Z".repeat(301) }, "label"],
];

for (const [label, draft, field] of REQUIRED) {
  const result = await M.createAction(draft);
  check(`${label} is refused`, result.ok === false, JSON.stringify(result));
  check(
    `  and the error names ${field}`,
    result.ok === false && Boolean(result.errors[field]),
    JSON.stringify(result.errors),
  );
}

check("nothing was written by any of them", (await count()) === 1, String(await count()));

/* == D. Client scoping ================================================= */

heading("D. An account and an owner from somewhere else");

const SCOPED = [
  ["an account on another client's book", { ...GOOD, retailerId: "zz-foreign" }, "retailerId"],
  ["an archived account", { ...GOOD, retailerId: "zz-gone" }, "retailerId"],
  ["an account id that does not exist", { ...GOOD, retailerId: "zz-nothing" }, "retailerId"],
  ["a broker on another client's book", { ...GOOD, ownerId: "zz-foreign-broker" }, "ownerId"],
  ["an archived broker", { ...GOOD, ownerId: "zz-retired" }, "ownerId"],
  ["a broker id that does not exist", { ...GOOD, ownerId: "zz-nobody" }, "ownerId"],
];

for (const [label, draft, field] of SCOPED) {
  const result = await M.createAction(draft);
  check(`${label} is refused`, result.ok === false, JSON.stringify(result));
  check(
    `  and the error names ${field}`,
    result.ok === false && Boolean(result.errors[field]),
    JSON.stringify(result.errors),
  );
}

check("still nothing written", (await count()) === 1, String(await count()));

/* An action cannot be created into another client's workspace even by naming
   that client, because the caller's client id is not a form field. */
const crossClient = await M.createAction(
  { ...GOOD, retailerId: "zz-foreign", ownerId: "zz-foreign-broker" },
  "zz-other-client",
);
check(
  "the other client's own records are accepted when the call is scoped to them",
  crossClient.ok === true,
  JSON.stringify(crossClient),
);
check(
  "which proves the refusals above were about scoping, not about the records",
  (await count()) === 2,
  String(await count()),
);
await db.exec(`delete from actions where retailer_id = 'zz-foreign'`);
check("that probe row is removed again", (await count()) === 1, String(await count()));

/* == E. The action itself ============================================== */

heading("E. One action created, and what it was given");

const created = await M.createAction(GOOD);
check("the write reports success", created.ok === true, JSON.stringify(created));
check("it returns the new id", created.id === "act-02", String(created.id));
check(
  "and says what it filed, naming the account",
  created.ok === true && created.changed.join(" ").includes("ZZ Action Account"),
  JSON.stringify(created.changed),
);

const all = await rows();
const act02 = all.find((a) => a.id === "act-02");

check("the action exists", Boolean(act02));
check("its wording is as typed", act02.label === "ZZ Send the price list", act02.label);
check("its account is the one chosen", act02.retailer_id === "zz-account", act02.retailer_id);
check("its owner is the one chosen", act02.owner_id === "zz-broker", act02.owner_id);
check("its due date is the one chosen", act02.due === "2026-09-15", act02.due);
check("it starts Open", act02.status === "Open", act02.status);
check("completed_at is null — nothing was finished", act02.completed_at === null, String(act02.completed_at));

/* The fields the first version deliberately does not expose. Each one left
   unset rather than written as an empty value. */
check("no product was attached", act02.product_id === null, String(act02.product_id));
check("no workstream item was attached", act02.workstream_item_id === null, String(act02.workstream_item_id));
check("no meeting was attached", act02.meeting_id === null, String(act02.meeting_id));
check("no description was invented", act02.description === null, String(act02.description));

/* Whitespace is trimmed, not stored. */
const trimmedDraft = await M.createAction({
  ...GOOD,
  label: "  ZZ Chase the buyer  ",
  retailerId: "zz-second",
  due: "2026-09-12",
});
check("a second action can be created", trimmedDraft.ok === true, JSON.stringify(trimmedDraft));
const act03 = (await rows()).find((a) => a.id === "act-03");
check("its wording is trimmed", act03.label === "ZZ Chase the buyer", JSON.stringify(act03.label));

/* == F. The act-NN series ============================================== */

heading("F. The act-NN series, allocated and not reused");

check("ids run act-01, act-02, act-03", (await rows()).map((a) => a.id).join(",") === "act-01,act-02,act-03",
  (await rows()).map((a) => a.id).join(","));
check("every id matches the act-NN shape", (await rows()).every((a) => /^act-\d{2,}$/.test(a.id)),
  JSON.stringify((await rows()).map((a) => a.id)));
check("no id was handed out twice", new Set((await rows()).map((a) => a.id)).size === 3);

/* display_order continues the existing sequence rather than restarting. */
const orders = (await rows()).map((a) => a.display_order);
check("display_order runs 1, 2, 3", orders.join(",") === "1,2,3", JSON.stringify(orders));
check("every action has a display_order", orders.every((o) => typeof o === "number"), JSON.stringify(orders));

/* == G. Where it shows up ============================================== */

heading("G. Where it shows up without anything being told to show it");

await reread();

const upcoming = S.getUpcomingActions();
check("all three actions are on the shared open list", upcoming.length === 3, String(upcoming.length));
check(
  "the soonest due is first — act-03, 12 Sep",
  upcoming[0].id === "act-03",
  JSON.stringify(upcoming.map((a) => `${a.id} ${a.due}`)),
);

const next3 = S.getUpcomingActions(3);
check("the Overview's next three moves include both new actions",
  next3.some((a) => a.id === "act-02") && next3.some((a) => a.id === "act-03"),
  JSON.stringify(next3.map((a) => a.id)));

const onAccount = S.getRetailerActions("zz-account");
check("the account's next steps carry the new action",
  onAccount.some((a) => a.id === "act-02"),
  JSON.stringify(onAccount.map((a) => a.id)));
check("and still carry the one that was already there",
  onAccount.some((a) => a.id === "act-01"),
  JSON.stringify(onAccount.map((a) => a.id)));
check("the second account's next steps carry only its own",
  S.getRetailerActions("zz-second").map((a) => a.id).join(",") === "act-03",
  JSON.stringify(S.getRetailerActions("zz-second").map((a) => a.id)));

const detail = S.getRetailerDetail("zz-account");
check("the account detail's openActions include it", detail.openActions.some((a) => a.id === "act-02"));

/* The short name, which is what the lists actually print — a full broker name
   would wrap in the next-moves tile. */
check("the new action is owned by a broker the portal can name",
  S.getOwnerName(upcoming.find((a) => a.id === "act-02").ownerId) === "ZZ Broker",
  S.getOwnerName(upcoming.find((a) => a.id === "act-02").ownerId));

/* Every screen that counts actions sees it, because there is one list. */
check("the Actions screen's own count includes it", S.countActions() === 3, String(S.countActions()));
check("the broker's scorecard picks it up",
  S.getBrokerDetail("zz-broker").actions.some((a) => a.id === "act-02"),
  JSON.stringify(S.getBrokerDetail("zz-broker").actions.map((a) => a.id)));

/* == H. What it did NOT touch ========================================== */

heading("H. What creating an action did NOT touch");

check("act-01 is byte for byte unchanged", JSON.stringify((await db.query(ACT_01)).rows) === act01Before,
  "the existing action moved");

const others = (
  await db.query(`select
  (select count(*)::int from retailers) as retailers,
  (select count(*)::int from brokers) as brokers,
  (select count(*)::int from products) as products,
  (select count(*)::int from workstream_items) as workstream,
  (select count(*)::int from meetings) as meetings,
  (select count(*)::int from activities) as activities,
  (select count(*)::int from buyer_feedback) as feedback,
  (select count(*)::int from samples) as samples,
  (select count(*)::int from opportunities) as opportunities`)
).rows[0];
check("retailers still 4", others.retailers === 4, String(others.retailers));
check("brokers still 3", others.brokers === 3, String(others.brokers));
check("products still 1", others.products === 1, String(others.products));
check("workstream items still 1", others.workstream === 1, String(others.workstream));
check("meetings still 1", others.meetings === 1, String(others.meetings));
check("no activity row was written — a plan is not a thing that happened",
  others.activities === 0, String(others.activities));
check("no buyer feedback appeared", others.feedback === 0, String(others.feedback));
check("no sample appeared", others.samples === 0, String(others.samples));
check("no opportunities row appeared", others.opportunities === 0, String(others.opportunities));

const account = (
  await db.query(`select pipeline_status, standing, assigned_broker_id, attention_reason
                    from retailers where id = 'zz-account'`)
).rows[0];
check(
  "the account's own status, standing, broker and attention reason are untouched",
  account.pipeline_status === "Samples sent" &&
    account.standing === "Active" &&
    account.assigned_broker_id === "zz-broker" &&
    account.attention_reason === null,
  JSON.stringify(account),
);

const item = (
  await db.query(`select item_status, current_target, next_action, next_action_date
                    from workstream_items where id = 'zz-ws-01'`)
).rows[0];
check(
  "the workstream item's own next step is untouched — this action is the account's, not the item's",
  item.next_action === null && item.next_action_date === null,
  JSON.stringify(item),
);

/* == I. Removed again ================================================== */

heading("I. The throwaway database, removed again");

await server.stop();
await db.close();
fs.rmSync(SCRATCH, { recursive: true, force: true });
check("the scratch database is gone", !fs.existsSync(SCRATCH), SCRATCH);

heading("Result");
if (failures === 0) {
  line(ok("An action can be written down, and it reaches every screen that reads one."));
} else {
  line(bad(`${failures} check${failures === 1 ? "" : "s"} failed.`));
}
console.log("");
process.exit(failures === 0 ? 0 : 1);
