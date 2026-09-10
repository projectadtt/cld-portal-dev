/**
 * Database connection for the migration scripts.
 *
 * Two backends, one interface:
 *
 *   DATABASE_URL set  -> a real Postgres / Supabase connection, via `pg`.
 *   DATABASE_URL unset -> PGlite, a full Postgres build running locally in
 *                         this process, persisted under .db/pglite.
 *
 * PGlite is real Postgres, so enums-as-lookups, foreign keys, generated
 * columns, partial unique indexes and plpgsql triggers all behave exactly as
 * they will on Supabase. It exists so the migrations, the seed and the
 * validation can be proven on this machine before any credentials exist. The
 * SQL is identical either way -- nothing in supabase/migrations is
 * PGlite-specific.
 *
 * Nothing in the application imports this file. It is used only by the
 * scripts in this directory.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, loadEnv, pgOptions } from "./env.mjs";

loadEnv();

export const ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
/* PGLITE_PATH exists so a throwaway local database can be built beside the
   working one — that is how the hosted schema gets something to be compared
   against. Unset, it is the usual development database. */
export const PGLITE_DIR = path.resolve(
  ROOT,
  process.env.PGLITE_PATH || path.join(".db", "pglite"),
);

/** Where the data actually is, for the report headers. */
export function target() {
  if (!process.env.DATABASE_URL) return `pglite (${path.relative(ROOT, PGLITE_DIR)})`;
  /* Never the connection string itself — only enough to say where it went. */
  return describe();
}

export async function connect() {
  if (process.env.DATABASE_URL) {
    const { default: pg } = await import("pg");
    /* A date is a calendar day, not an instant. The driver parses DATE into a
       JS Date at local midnight, which on a UTC+8 machine reads back a day
       early -- the exact off-by-one the application avoids by casting ::text
       in every query. The scripts read whole tables generically and cannot
       cast per column, so the parser is disabled instead. PGlite already
       returns these as strings, so both backends now agree. */
    pg.types.setTypeParser(1082, (value) => value);
    const client = new pg.Client(pgOptions());
    await client.connect();
    /* Whether our own socket is encrypted, asked of the socket rather than of
       the server. Through a pooler, pg_stat_ssl describes the pooler's link to
       Postgres, not ours to the pooler — so that is the wrong thing to ask. */
    const socket = client.connection?.stream;
    return {
      kind: "postgres",
      encrypted: Boolean(socket?.encrypted),
      tlsProtocol: socket?.getProtocol?.() ?? null,
      query: async (sql, params) => (await client.query(sql, params)).rows,
      exec: async (sql) => void (await client.query(sql)),
      close: () => client.end(),
    };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  fs.mkdirSync(PGLITE_DIR, { recursive: true });
  const db = await PGlite.create(PGLITE_DIR);
  return {
    kind: "pglite",
    query: async (sql, params) => (await db.query(sql, params)).rows,
    exec: async (sql) => void (await db.exec(sql)),
    close: () => db.close(),
  };
}

/* -- reporting helpers ------------------------------------------------ */

export const ok = (s) => `\x1b[32m${s}\x1b[0m`;
export const bad = (s) => `\x1b[31m${s}\x1b[0m`;
export const dim = (s) => `\x1b[2m${s}\x1b[0m`;
export const bold = (s) => `\x1b[1m${s}\x1b[0m`;

export function heading(text) {
  console.log(`\n${bold(text)}\n${dim("-".repeat(text.length))}`);
}
