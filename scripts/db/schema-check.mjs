/**
 * Does the connected database have the schema the migrations describe?
 *
 *   npm run db:schema                  census the connected database
 *   npm run db:schema -- --save=<file> write that census out
 *   npm run db:schema -- --diff=<file> compare this database to one
 *
 * Counting tables is not verification. This reads the catalogs for everything
 * the migrations actually declare — columns with their types, nullability,
 * defaults and generated expressions; primary keys; foreign keys with their
 * delete rules; unique and check constraints; indexes; triggers — and reduces
 * it to a canonical text form that can be compared line for line.
 *
 * The intended use: census a fresh local database built by the same ten
 * migration files, then diff the hosted one against it. That turns "the schema
 * looks right" into "the schema is identical to the one the tests ran on".
 *
 * Read-only. Nothing here prints the connection string.
 */

import fs from "node:fs";

import { connect, target, ok, bad, dim, bold, heading } from "./client.mjs";

const arg = (name) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith("--" + name + "="));
  return hit ? hit.slice(name.length + 3) : null;
};

const db = await connect();

/* -- the census --------------------------------------------------------- */

const tables = (
  await db.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name`,
  )
).map((r) => r.table_name);

const columns = await db.query(
  `select table_name, column_name, data_type, is_nullable,
          coalesce(column_default, '') as column_default,
          coalesce(is_generated, 'NEVER') as is_generated,
          coalesce(generation_expression, '') as generation_expression,
          coalesce(character_maximum_length::text, '') as len,
          coalesce(numeric_precision::text, '') as prec,
          coalesce(numeric_scale::text, '') as scale
     from information_schema.columns
    where table_schema = 'public'
    order by table_name, column_name`,
);

/* Straight from pg_constraint: conname can be server-generated, so what gets
   compared is the definition, never the name.
   Only the four kinds the migrations declare. Some Postgres builds also keep a
   pg_constraint row per NOT NULL column and some do not — that is a catalog
   representation difference, not a schema difference, and nullability is
   already carried on every column below. */
const constraints = await db.query(
  `select c.relname as table_name, con.contype,
          pg_get_constraintdef(con.oid) as definition
     from pg_constraint con
     join pg_class c on c.oid = con.conrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and con.contype in ('p', 'f', 'u', 'c')
    order by c.relname, con.contype, pg_get_constraintdef(con.oid)`,
);

const indexes = await db.query(
  `select tablename as table_name, indexdef
     from pg_indexes where schemaname = 'public'
    order by tablename, indexdef`,
);

const triggers = await db.query(
  `select c.relname as table_name, t.tgname,
          pg_get_triggerdef(t.oid) as definition
     from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal
    order by c.relname, t.tgname`,
);

const byTable = (rows) => {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.table_name)) map.set(r.table_name, []);
    map.get(r.table_name).push(r);
  }
  return map;
};
const cols = byTable(columns);
const cons = byTable(constraints);
const idx = byTable(indexes);
const trg = byTable(triggers);

/* Definitions carry the schema-qualified table name; dropping "public." keeps
   the census about shape rather than about where it happens to live. */
const clean = (s) => s.replace(/\bpublic\./g, "").replace(/\s+/g, " ").trim();

const lines = [];
const kind = { p: "primary key", f: "foreign key", u: "unique", c: "check" };

for (const table of tables) {
  if (table === "_cld_migrations") continue;
  lines.push("table " + table);
  for (const c of cols.get(table) ?? []) {
    const type =
      c.data_type +
      (c.len ? `(${c.len})` : c.prec && c.data_type === "numeric" ? `(${c.prec},${c.scale})` : "");
    lines.push(
      `  column ${c.column_name} ${type}` +
        (c.is_nullable === "NO" ? " not null" : "") +
        (c.column_default ? " default " + clean(c.column_default) : "") +
        (c.is_generated === "ALWAYS" ? " generated " + clean(c.generation_expression) : ""),
    );
  }
  for (const c of cons.get(table) ?? []) {
    lines.push(`  ${kind[c.contype] ?? c.contype} ${clean(c.definition)}`);
  }
  for (const i of idx.get(table) ?? []) lines.push("  index " + clean(i.indexdef));
  for (const t of trg.get(table) ?? []) lines.push("  trigger " + clean(t.definition));
}

const census = lines.join("\n") + "\n";

/* -- what it adds up to ------------------------------------------------- */

const n = (contype) => constraints.filter((c) => c.contype === contype).length;
const lookupTables = tables.filter((t) => t.startsWith("lookup_"));

heading("Schema");
console.log(`  ${target()}\n`);
console.log(
  `  tables        ${bold(String(tables.length))}  (${lookupTables.length} lookup, ` +
    `${tables.length - lookupTables.length - 1} operational, 1 migration ledger)`,
);
console.log(`  columns       ${bold(String(columns.length))}`);
console.log(`  primary keys  ${bold(String(n("p")))}`);
console.log(`  foreign keys  ${bold(String(n("f")))}`);
console.log(`  unique        ${bold(String(n("u")))}`);
console.log(`  checks        ${bold(String(n("c")))}`);
console.log(`  indexes       ${bold(String(indexes.length))}`);
console.log(`  triggers      ${bold(String(triggers.length))}`);

let referenceRows = 0;
const emptyLookups = [];
for (const t of lookupTables) {
  const [{ c }] = await db.query(`select count(*)::int as c from ${t}`);
  referenceRows += c;
  if (c === 0) emptyLookups.push(t);
}
console.log(
  `\n  lookups       ${bold(String(referenceRows))} reference rows across ${lookupTables.length} tables` +
    (emptyLookups.length
      ? "  " + bad("empty: " + emptyLookups.join(", "))
      : "  " + ok("all populated")),
);

/* Every foreign key pointing at a lookup table is a status column the database
   itself validates — the reason the write layer checks the lookups instead of
   a TypeScript union. */
const lookupFks = constraints.filter(
  (c) => c.contype === "f" && /references lookup_/i.test(c.definition),
);
console.log(`  guarded by FK ${bold(String(lookupFks.length))} columns reference a lookup table`);

/* -- save or diff ------------------------------------------------------- */

let failed = false;

const save = arg("save");
if (save) {
  fs.writeFileSync(save, census);
  console.log(`\n  ${ok("saved")}  a census of ${lines.length} lines`);
}

const against = arg("diff");
if (against) {
  const expected = fs.readFileSync(against, "utf8");
  heading("Compared to " + against);
  if (expected === census) {
    console.log(`  ${ok("identical")}  ${lines.length} lines, no differences`);
  } else {
    failed = true;
    const a = expected.split("\n");
    const b = census.split("\n");
    const missing = a.filter((l) => l.trim() && !b.includes(l));
    const extra = b.filter((l) => l.trim() && !a.includes(l));
    console.log(`  ${bad("DIFFERS")}  ${missing.length} missing, ${extra.length} unexpected`);
    for (const l of missing.slice(0, 40)) console.log(`    ${bad("-")} ${l.trim()}`);
    for (const l of extra.slice(0, 40)) console.log(`    ${ok("+")} ${l.trim()}`);
    if (missing.length > 40 || extra.length > 40) console.log(dim("    …"));
  }
}

await db.close();
console.log(dim("\n  Read-only. Nothing was created, changed or dropped.\n"));
process.exit(failed ? 1 : 0);
