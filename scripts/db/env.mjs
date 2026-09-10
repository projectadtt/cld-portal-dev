/**
 * Environment and connection options for the database scripts.
 *
 * Two things the scripts need that the application already had:
 *
 *   1. `.env.local`. Next loads it automatically; a plain node script does
 *      not. Loading it here means the connection string never has to be
 *      typed on a command line, pasted into a terminal, or exported into a
 *      shell history — which is the whole reason it lives in a file.
 *
 *   2. TLS. `src/lib/db/pool.ts` already turns it on for any non-local host.
 *      The scripts connect with their own client, so they need the same rule,
 *      or every one of them fails against a hosted database.
 *
 * Nothing here prints or returns the connection string. `describe()` exists so
 * a report can say where it connected without saying what the password is.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

/**
 * Reads .env.local, then .env, into process.env.
 *
 * A variable already set in the real environment always wins, so a one-off
 * `DATABASE_URL=... npm run db:validate` still points where it says.
 */
export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;

    for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;

      const key = trimmed.slice(0, eq).trim();
      if (process.env[key] !== undefined) continue;

      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

const isLocal = (host) =>
  host === "127.0.0.1" || host === "localhost" || host === "::1";

/**
 * Options for a `pg` Client or Pool, matching what the application does.
 *
 * TLS for anything that is not on this machine. `rejectUnauthorized` is false
 * for the same reason it is false in the application: no CA bundle is
 * configured. Set PGSSLROOTCERT to a downloaded Supabase CA and the
 * certificate is verified properly.
 */
export function pgOptions() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set, and no .env.local supplied one. " +
        "The scripts read the same variable the application does.",
    );
  }

  const host = new URL(connectionString).hostname;
  if (isLocal(host)) return { connectionString };

  const ca = process.env.PGSSLROOTCERT;
  return {
    connectionString,
    ssl: ca
      ? { ca: fs.readFileSync(ca, "utf8") }
      : { rejectUnauthorized: false },
  };
}

/**
 * Where we are connected, with nothing secret in it.
 *
 * The host's first label carries the project reference, so it is masked. What
 * is left is enough to tell a Supabase session-mode pooler from a transaction
 * pooler from a direct connection, which is the distinction that matters.
 */
export function describe() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return "(no DATABASE_URL)";

  const url = new URL(raw);
  if (isLocal(url.hostname)) return `local postgres on ${url.hostname}:${url.port || 5432}`;

  const masked = url.hostname.replace(
    /^[^.]+/,
    (label) => label.slice(0, 3) + "*".repeat(Math.max(0, label.length - 3)),
  );
  const kind = url.hostname.includes("pooler.supabase.com")
    ? url.port === "6543"
      ? "supabase pooler, transaction mode"
      : "supabase pooler, session mode"
    : url.hostname.includes("supabase.co")
      ? "supabase direct connection"
      : "postgres";

  return `${kind} — ${masked}:${url.port || 5432}/${url.pathname.replace("/", "")}, TLS on`;
}
