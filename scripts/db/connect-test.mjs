/**
 * A safe connectivity check.
 *
 *   npm run db:connect
 *
 * Answers: can we reach the database, is the connection encrypted, is it the
 * pooler or a direct connection, and what is already in there. Read-only —
 * it creates nothing and changes nothing.
 *
 * Nothing it prints is a secret. The host label carrying the project
 * reference is masked, and the connection string is never assembled into
 * output at all.
 */

import { connect, target, ok, bad, dim, bold, heading } from "./client.mjs";

heading("Connection");
console.log(`  target  ${target()}`);

let db;
const started = Date.now();
try {
  db = await connect();
} catch (error) {
  console.log(`  ${bad("FAILED")}  ${error.code ?? ""} ${error.message}`);
  console.log(dim("\n  Nothing was changed.\n"));
  process.exit(1);
}
console.log(`  ${ok("connected")}  in ${Date.now() - started}ms`);

const one = async (sql) => (await db.query(sql))[0];

/* -- who and where ------------------------------------------------------ */

const server = await one(
  `select current_database() as database,
          current_user      as role,
          split_part(version(), ' on ', 1) as version`,
);
console.log(`  database  ${server.database}`);
console.log(`  role      ${server.role}`);
console.log(`  server    ${server.version}`);

/* Encryption of the leg we own: this process to whatever it dialled.
   pg_stat_ssl is deliberately not used here — through a pooler it reports the
   pooler's own connection to Postgres, which is internal to the provider and
   is not the thing a client can do anything about. */
if (db.kind !== "postgres") {
  console.log(dim("  tls       not applicable — this database is a local file"));
} else {
  console.log(
    db.encrypted
      ? `  ${ok("tls")}       on${db.tlsProtocol ? " — " + db.tlsProtocol : ""}  ${dim("(this client to the host it dialled)")}`
      : `  ${bad("tls")}       OFF — this connection is not encrypted`,
  );

  const backend = await one(
    `select coalesce((select ssl from pg_stat_ssl where pid = pg_backend_pid()), false) as ssl`,
  ).catch(() => null);
  if (backend && !backend.ssl) {
    console.log(dim("  note      the server-side session reports no TLS of its own."));
    console.log(dim("            That is the pooler's link to Postgres, inside the"));
    console.log(dim("            provider's network, and not this connection."));
  }
}

/* -- what is already there --------------------------------------------- */

heading("What the database already holds");

const tables = await db.query(
  `select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name`,
);
console.log(`  ${bold(String(tables.length))} table(s) in the public schema`);
if (tables.length) {
  console.log(dim("    " + tables.map((t) => t.table_name).join(", ")));
}

const migrations = tables.some((t) => t.table_name === "_cld_migrations")
  ? await db.query(`select name from _cld_migrations order by name`)
  : [];
console.log(
  migrations.length
    ? `  ${bold(String(migrations.length))} migration(s) applied: ${migrations.map((m) => m.name).join(", ")}`
    : "  no migrations applied yet",
);

await db.close();
console.log(dim("\n  Read-only. Nothing was created, changed or dropped.\n"));
