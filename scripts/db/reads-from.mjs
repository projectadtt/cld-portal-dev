/**
 * Is the running application actually reading from the connected database?
 *
 *   node --import ./scripts/db/alias.mjs scripts/db/reads-from.mjs
 *
 * An empty portal proves nothing on its own: an empty screen looks the same
 * whether the database is empty or unreachable. So this puts one clearly
 * marked row into the database by hand, asks the application's own selectors
 * what they see, and then removes it again.
 *
 * The row is a probe, not a seed. It is deleted before the script exits, and
 * the final count is printed so the database can be seen to be empty again. It
 * carries an obviously non-business name so that if anything ever goes wrong
 * mid-run, what is left behind is unmistakable.
 *
 *   --keep   insert and check, but leave the probe in place, so a server can be
 *            started against it and the same row checked over HTTP. The read
 *            snapshot is loaded once per process, so the server has to start
 *            after the row exists.
 *   --clean  remove the probe and confirm the database is empty. Always run
 *            this after --keep.
 */

import { connect, target, ok, bad, dim, heading } from "./client.mjs";

/* The portal reads one client, under a fixed id. Importing the module is safe
   here — the snapshot is not read until loadWorkspace() is called, further
   down, after the probe row exists. */
const { DEFAULT_CLIENT_ID, loadWorkspace } = await import(
  "../../src/lib/db/workspace.ts"
);

const PROBE = {
  client: "ZZ Connection Probe",
  workspace: "Probe Workspace",
  product: "ZZ Probe Item",
};

const db = await connect();

heading("Where the application reads from");
console.log(`  ${target()}\n`);

let failures = 0;
const check = (label, condition, detail = "") => {
  if (condition) console.log(`  ${ok("pass")}  ${label}`);
  else {
    failures++;
    console.log(`  ${bad("FAIL")}  ${label}  ${dim(detail)}`);
  }
};

const count = async () => {
  const [{ c }] = await db.query(
    `select (select count(*) from clients) + (select count(*) from products) as c`,
  );
  return Number(c);
};

async function removeProbe() {
  /* By name as well as by id: anything called "ZZ …" is this script's, and
     removing it by name means a run that died halfway still gets cleaned up. */
  await db.exec(`
    delete from products where id = 'zz-probe-item' or name like 'ZZ %';
    delete from clients where name like 'ZZ %';
  `);
  const left = await count();
  check("the probe is gone and the database is empty again", left === 0, `${left} rows left`);
}

/* --clean does nothing but tidy up after a --keep run. */
if (process.argv.includes("--clean")) {
  await removeProbe();
  await db.close();
  process.exit(failures ? 1 : 0);
}

check("the database is empty before the probe", (await count()) === 0);

/* -- put the probe in -------------------------------------------------- */

await db.exec(`
  insert into clients (id, name, workspace, category, is_demo)
  values ('${DEFAULT_CLIENT_ID}', '${PROBE.client}', '${PROBE.workspace}',
          'Probe', false);
  insert into products (id, client_id, item_id, name, category, readiness)
  values ('zz-probe-item', '${DEFAULT_CLIENT_ID}', 'ZZ-000', '${PROBE.product}',
          'Probe', 'In preparation');
`);
console.log(dim(`\n  probe inserted — one client, one product, both named "ZZ …"\n`));

/* -- ask the application's own data layer ------------------------------ */

/* Called only now: the snapshot is read once per process, so reading it before
   the insert would cache an empty database and prove nothing. This is the same
   loadWorkspace() every route awaits — there is deliberately no static
   fallback, so a selector that answers at all has answered from the database. */
await loadWorkspace();
const selectors = await import("../../src/lib/selectors.ts");

const client = selectors.getClient();
check(
  "the application's selectors see the probe client",
  client?.name === PROBE.client,
  client ? `saw ${JSON.stringify(client.name)}` : "saw no client at all",
);
check(
  "and its workspace label",
  selectors.getWorkspaceLabel() === PROBE.workspace + " Workspace",
  String(selectors.getWorkspaceLabel()),
);

const products = selectors.getAllProducts();
check(
  "the product range reads back the probe item",
  products.length === 1 && products[0]?.name === PROBE.product,
  JSON.stringify(products.map((p) => p.name)),
);

/* -- take the probe out again ------------------------------------------ */

if (process.argv.includes("--keep")) {
  console.log(
    dim(`\n  --keep: the probe row is still there. Remove it with --clean.`),
  );
  await db.close();
  process.exit(failures ? 1 : 0);
}

console.log("");
await removeProbe();

await db.close();
console.log(
  `\n  ${failures === 0 ? ok("The application reads from this database.") : bad(failures + " failed")}\n`,
);
process.exit(failures ? 1 : 0);
