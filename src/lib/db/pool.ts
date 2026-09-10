import "server-only";

import { Pool, type PoolClient } from "pg";

/**
 * The application's single database connection.
 *
 * `server-only` makes this a build error if anything in the client bundle
 * ever imports it, directly or transitively. The connection string is read
 * from the environment and never reaches the browser: no NEXT_PUBLIC_ prefix,
 * no value inlined into a component.
 *
 * The pool is cached on globalThis so Next's dev-mode module reloading does
 * not open a new pool on every edit.
 */

const globalForPool = globalThis as unknown as { cldPool?: Pool };

export function pool(): Pool {
  if (globalForPool.cldPool) return globalForPool.cldPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. The portal reads its data from Postgres; " +
        "there is no static fallback. For local work, run `npm run db:serve` " +
        "and set DATABASE_URL to the address it prints.",
    );
  }

  const created = new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    /* Supabase requires TLS; a local socket server does not offer it. */
    ssl: connectionString.includes("127.0.0.1") || connectionString.includes("localhost")
      ? undefined
      : { rejectUnauthorized: false },
  });

  globalForPool.cldPool = created;
  return created;
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool().query(sql, params);
  return result.rows as T[];
}

/**
 * Runs `work` inside a single transaction on one connection.
 *
 * Every write in the portal goes through here. A write path that touches
 * four tables — item, sample, action, feedback — has to commit as one thing
 * or not at all: a saved status with a lost feedback record would be worse
 * than a failed save, because nothing would say so.
 *
 * The connection is always released, and any failure rolls the whole
 * transaction back before the error is re-thrown to the caller.
 */
export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {
      /* The connection is already broken; the original error is the one
         that matters and is re-thrown below. */
    });
    throw error;
  } finally {
    client.release();
  }
}
