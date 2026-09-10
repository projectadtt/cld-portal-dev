/**
 * Apply pending migrations, in filename order, each in its own transaction.
 *
 *   node scripts/db/migrate.mjs          apply everything pending
 *   node scripts/db/migrate.mjs --down   roll back the most recent migration
 *   node scripts/db/migrate.mjs --down=3 roll back the last three
 *   node scripts/db/migrate.mjs --status list applied and pending
 *
 * A migration that throws is rolled back whole. There is no partial apply.
 */

import fs from "node:fs";
import path from "node:path";
import { connect, target, ROOT, ok, bad, dim, bold, heading } from "./client.mjs";

const UP = path.join(ROOT, "supabase", "migrations");
const DOWN = path.join(ROOT, "supabase", "down");

const files = () => fs.readdirSync(UP).filter((f) => f.endsWith(".sql")).sort();

async function applied(db) {
  await db.exec(`
    create table if not exists _cld_migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    );
  `);
  const rows = await db.query("select name from _cld_migrations order by name");
  return rows.map((r) => r.name);
}

async function up(db) {
  const done = new Set(await applied(db));
  const pending = files().filter((f) => !done.has(f));

  heading(`Migrate up  ${dim("->")}  ${target()}`);
  if (pending.length === 0) {
    console.log(dim("  nothing pending"));
    return 0;
  }

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(UP, file), "utf8");
    try {
      await db.exec("begin");
      await db.exec(sql);
      await db.query("insert into _cld_migrations (name) values ($1)", [file]);
      await db.exec("commit");
      console.log(`  ${ok("applied")}  ${file}`);
    } catch (err) {
      await db.exec("rollback");
      console.error(`  ${bad("FAILED")}   ${file}`);
      console.error(`           ${err.message}`);
      console.error(dim("\n  Transaction rolled back. No partial schema was left behind."));
      await db.close();
      process.exit(1);
    }
  }
  return pending.length;
}

async function down(db, count) {
  const done = await applied(db);
  const targets = done.slice(-count).reverse();

  heading(`Migrate down (${targets.length})  ${dim("->")}  ${target()}`);
  for (const file of targets) {
    const p = path.join(DOWN, file);
    if (!fs.existsSync(p)) throw new Error(`no down migration for ${file}`);
    try {
      await db.exec("begin");
      await db.exec(fs.readFileSync(p, "utf8"));
      await db.query("delete from _cld_migrations where name = $1", [file]);
      await db.exec("commit");
      console.log(`  ${ok("reverted")} ${file}`);
    } catch (err) {
      await db.exec("rollback");
      console.error(`  ${bad("FAILED")}   ${file}: ${err.message}`);
      throw err;
    }
  }
  return targets.length;
}

async function status(db) {
  const done = new Set(await applied(db));
  heading(`Migration status  ${dim("->")}  ${target()}`);
  for (const f of files()) {
    console.log(done.has(f) ? `  ${ok("applied")}  ${f}` : `  ${dim("pending")}  ${f}`);
  }
}

const db = await connect();
try {
  const arg = process.argv.find((a) => a.startsWith("--down"));
  if (process.argv.includes("--status")) await status(db);
  else if (arg) await down(db, Number(arg.split("=")[1] ?? 1));
  else {
    const n = await up(db);
    if (n) console.log(bold(`\n  ${n} migration${n === 1 ? "" : "s"} applied.`));
  }
} finally {
  await db.close();
}
