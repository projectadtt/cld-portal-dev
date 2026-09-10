/**
 * Serve the local PGlite database over the Postgres wire protocol.
 *
 *   node scripts/db/serve.mjs [--port 5433]
 *
 * Why this exists: the application connects with the real `pg` driver and a
 * real DATABASE_URL, exactly as it will to Supabase. Without a Postgres
 * server on this machine there would be nothing to point that at, and the
 * only alternative would be a PGlite-specific branch inside the app -- which
 * would mean the production code path was never actually exercised.
 *
 * With this, the application has one code path. Only the endpoint differs.
 */

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import fs from "node:fs";
import { PGLITE_DIR, ok, dim, bold } from "./client.mjs";

const portArg = process.argv.indexOf("--port");
const port = portArg > -1 ? Number(process.argv[portArg + 1]) : 5433;

fs.mkdirSync(PGLITE_DIR, { recursive: true });
const db = await PGlite.create(PGLITE_DIR);
/* The default is a single connection for the server's whole lifetime, which
   drops the next client the moment one disconnects. A dev server and a
   validation run both need more than that. */
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 60 });
await server.start();

console.log(bold("\n  PGlite listening on the Postgres wire protocol"));
console.log(`  ${ok("ready")}  postgresql://postgres@127.0.0.1:${port}/postgres`);
console.log(dim("  The application connects with the pg driver, as it would to Supabase.\n"));

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
