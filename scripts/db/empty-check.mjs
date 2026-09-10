/**
 * Every selector, against an empty database.
 *
 *   node --import ./scripts/db/alias.mjs scripts/db/empty-check.mjs
 *
 * A database-first portal spends its first day with nothing in it, and every
 * screen has to render anyway. The failure mode is always the same shape:
 * something that took the first row of a list, or reduced without a starting
 * value, and never met a list with no rows in it.
 *
 * So this calls all of them — the ones that take no argument, and the ones
 * that take an id, with an id that cannot exist. Anything that throws, or
 * quietly hands back undefined where its return type promises a value, is
 * reported. Read-only: it creates nothing.
 */

import { pathToFileURL } from "node:url";
import path from "node:path";
import { ok, bad, dim, bold, heading } from "./client.mjs";

const load = (p) => import(pathToFileURL(path.join(process.cwd(), p)).href);

const { loadWorkspace, workspace } = await load("src/lib/db/workspace.ts");
await loadWorkspace();
const S = await load("src/lib/selectors.ts");
const ws = workspace();

const rows =
  ws.retailers.length + ws.products.length + ws.brokers.length + ws.workstream.length;

heading("Selectors against an empty database");
console.log(
  `  client: ${ws.client ? bold(ws.client.name) : dim("none")}   ` +
    `business rows: ${rows === 0 ? ok("0") : bad(String(rows))}\n`,
);
if (rows > 0) {
  console.log(bad("  This database is not empty. Run db:fresh first.\n"));
  process.exit(1);
}

/* Selectors that are meant to return nothing for an unknown id are called
   with one; the rest take no arguments. Neither may throw. */
const MISSING = "does-not-exist";
const NEEDS_ID = new Set(
  Object.keys(S).filter((k) => /^(get|count)/.test(k) && S[k].length > 0),
);

/* Formatters and predicates are not selectors and take real arguments. */
const SKIP = new Set([
  /* Takes a list of groups rather than an id — exercised through the
     selectors that build those groups. */
  "countBrokerRecords",
  "formatShortDate", "formatLongDate", "formatRelativeDate", "formatDueDate",
  "relativeDateLabel", "daysFromToday", "isActionOverdue", "resolveAction",
  "groupActivityByDay", "pageTitle",
]);

let called = 0;
const threw = [];
const undef = [];

for (const name of Object.keys(S).sort()) {
  if (typeof S[name] !== "function" || SKIP.has(name)) continue;
  if (!/^(get|count|group)/.test(name)) continue;

  const args = NEEDS_ID.has(name) ? [MISSING] : [];
  called++;
  try {
    const result = S[name](...args);
    /* undefined is a finding only where no argument was passed: a lookup by
       an id that does not exist is entitled to return nothing. */
    if (result === undefined && args.length === 0) undef.push(name);
  } catch (error) {
    threw.push(`${name}(${args.join(", ")}) — ${error.message.split("\n")[0]}`);
  }
}

console.log(`  ${bold(String(called))} selectors called.`);

if (threw.length) {
  heading(`Threw (${threw.length})`);
  for (const line of threw) console.log(`  ${bad("throws")}  ${line}`);
}
if (undef.length) {
  heading(`Returned undefined (${undef.length})`);
  console.log(dim("  Each of these promises a value in its return type.\n"));
  for (const name of undef) console.log(`  ${bad("undefined")}  ${name}()`);
}

if (!threw.length && !undef.length) {
  heading("Result");
  console.log(`  ${ok("Every selector returns cleanly with nothing in the database.")}\n`);
}

process.exit(threw.length + undef.length ? 1 : 0);
