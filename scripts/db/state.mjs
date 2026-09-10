/**
 * What is actually in the database.
 *
 *   npm run db:state
 *
 * Separates the two kinds of row that live in this schema:
 *
 *   reference — the lookup tables. Vocabulary the application needs to
 *               function at all, installed by the migrations.
 *   operational — the business records. In a database-first portal these
 *               arrive one at a time, through the dashboard.
 *
 * "Empty operational database" is a claim worth being able to check in one
 * command, so this is that command. Read-only.
 */

import { connect, target, ok, bad, dim, bold, heading } from "./client.mjs";

const OPERATIONAL = [
  "clients", "brokers", "retailers", "products", "contacts",
  "workstream_items", "meetings", "meeting_attendees", "samples",
  "buyer_feedback", "actions", "activities",
  "opportunities", "opportunity_products", "opportunity_retailers",
];

const db = await connect();
heading("Database state");
console.log(`  ${target()}\n`);

/* -- reference data ----------------------------------------------------- */

const lookups = await db.query(
  `select table_name from information_schema.tables
    where table_schema = 'public' and table_name like 'lookup\\_%'
    order by table_name`,
);

let referenceRows = 0;
const empty = [];
for (const { table_name: name } of lookups) {
  const [{ n }] = await db.query(`select count(*)::int as n from ${name}`);
  referenceRows += n;
  if (n === 0) empty.push(name);
}
console.log(
  `  reference    ${bold(String(lookups.length))} lookup tables, ${bold(String(referenceRows))} rows` +
    (empty.length ? `  ${bad("(" + empty.length + " empty: " + empty.join(", ") + ")")}` : ` ${ok("all populated")}`),
);

/* -- operational data --------------------------------------------------- */

const counts = await db.query(
  OPERATIONAL.map((t) => `select '${t}' as name, count(*)::int as n from ${t}`).join(" union all "),
);
const byName = new Map(counts.map((r) => [r.name, r.n]));
const total = counts.reduce((sum, r) => sum + r.n, 0);

console.log(
  `  operational  ${bold(String(total))} rows across ${OPERATIONAL.length} tables` +
    (total === 0 ? `  ${ok("empty — every record will be entered through the portal")}` : ""),
);

if (total > 0) {
  console.log("");
  for (const name of OPERATIONAL) {
    const n = byName.get(name) ?? 0;
    if (n > 0) console.log(`    ${String(n).padStart(5)}  ${name}`);
  }
}

/* -- migrations --------------------------------------------------------- */

const applied = await db.query(`select name from _cld_migrations order by name`).catch(() => []);
console.log(`\n  migrations   ${bold(String(applied.length))} applied`);
console.log(dim(`    ${applied.map((m) => m.name.replace(".sql", "")).join(", ")}`));

await db.close();
console.log(dim("\n  Read-only.\n"));
