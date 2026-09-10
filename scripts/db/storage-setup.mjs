/**
 * The bucket CLD's images live in.
 *
 *   npm run db:storage            report what exists
 *   npm run db:storage -- --apply create or correct the bucket
 *
 * Why this is a script and not a migration: `storage.buckets` belongs to
 * Supabase's own schema, not to this application's. Putting it in
 * supabase/migrations would make the migrations unrunnable on a plain Postgres
 * — which is exactly where they get proven before they touch anything hosted.
 * So the bucket is set up separately, idempotently, against whichever database
 * actually has a storage schema.
 *
 * The bucket is declared with a size limit and a MIME allow-list. Those are
 * also enforced in the write layer, on purpose: this is the copy that holds
 * even if a request reaches Storage by some route the application did not
 * write. Neither one is trusted alone.
 *
 * Read-only unless --apply is passed. Prints nothing secret.
 */

import { connect, target, ok, bad, dim, bold, heading } from "./client.mjs";

export const BUCKET = "cld-assets";

/** 5 MB. Large enough for a product photograph, small enough to be a limit. */
export const MAX_BYTES = 5 * 1024 * 1024;

export const MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Public-read.
 *
 * A private bucket serves its files through signed URLs, which expire. The
 * portal's pages are rendered and cached; an expiring src turns into a broken
 * image on a page that was correct when it was built, and "refresh and the
 * picture is still there" stops being true. Public objects have stable URLs
 * and cache properly.
 *
 * What that costs: anyone holding the URL can fetch the file. Object names are
 * 32 random hex characters, so a URL cannot be guessed from a product name, but
 * this is not access control and is not described as any. Writes are a
 * different matter — they are server-mediated and need the service-role key,
 * which never leaves the server. See supabase/README.md.
 */
export const PUBLIC_READ = true;

const apply = process.argv.includes("--apply");

const db = await connect();

heading("Storage bucket");
console.log(`  ${target()}\n`);

const [{ present }] = await db.query(
  `select count(*)::int as present from information_schema.schemata where schema_name = 'storage'`,
);
if (!present) {
  console.log(`  ${bad("no storage schema")}  this database is not a Supabase project.`);
  console.log(dim("  Nothing to do. Supabase Storage exists only on Supabase.\n"));
  await db.close();
  process.exit(1);
}

const existing = await db.query(
  `select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = $1`,
  [BUCKET],
);

const want = {
  public: PUBLIC_READ,
  file_size_limit: String(MAX_BYTES),
  allowed_mime_types: MIME_TYPES.join(","),
};

const describeRow = (row) => ({
  public: row.public,
  file_size_limit: String(row.file_size_limit),
  allowed_mime_types: (row.allowed_mime_types ?? []).join(","),
});

if (!existing.length) {
  if (!apply) {
    console.log(`  ${bad("missing")}  bucket "${BUCKET}" does not exist.`);
    console.log(dim("  Run: npm run db:storage -- --apply\n"));
    await db.close();
    process.exit(1);
  }
  await db.query(
    `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
     values ($1, $1, $2, $3, $4)`,
    [BUCKET, PUBLIC_READ, MAX_BYTES, MIME_TYPES],
  );
  console.log(`  ${ok("created")}  bucket "${BUCKET}"`);
} else {
  const have = describeRow(existing[0]);
  const drifted = Object.keys(want).filter((k) => String(have[k]) !== String(want[k]));

  if (!drifted.length) {
    console.log(`  ${ok("exists")}   bucket "${BUCKET}", already as declared`);
  } else if (!apply) {
    console.log(`  ${bad("drifted")}  ${drifted.join(", ")}`);
    console.log(dim(`    declared: ${JSON.stringify(want)}`));
    console.log(dim(`    actual:   ${JSON.stringify(have)}`));
    console.log(dim("\n  Run: npm run db:storage -- --apply\n"));
    await db.close();
    process.exit(1);
  } else {
    await db.query(
      `update storage.buckets
          set public = $2, file_size_limit = $3, allowed_mime_types = $4
        where id = $1`,
      [BUCKET, PUBLIC_READ, MAX_BYTES, MIME_TYPES],
    );
    console.log(`  ${ok("corrected")} ${drifted.join(", ")}`);
  }
}

/* -- what it holds ------------------------------------------------------ */

const [{ n }] = await db.query(
  `select count(*)::int as n from storage.objects where bucket_id = $1`,
  [BUCKET],
);
console.log(`  visibility  ${PUBLIC_READ ? "public read, server-mediated writes" : "private"}`);
console.log(`  size limit  ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB per object`);
console.log(`  mime types  ${MIME_TYPES.join(", ")}`);
console.log(`  objects     ${bold(String(n))}`);

if (n) {
  const byPrefix = await db.query(
    `select split_part(name, '/', 1) as prefix, count(*)::int as n
       from storage.objects where bucket_id = $1 group by 1 order by 1`,
    [BUCKET],
  );
  for (const row of byPrefix) console.log(dim(`    ${String(row.n).padStart(4)}  ${row.prefix}/`));
}

/* Objects whose owning row has gone, or which no row points at. Worth being
   able to see: the portal deletes an object when its reference is cleared, but
   a delete that failed after the database committed would show up here. */
const orphans = await db.query(
  `select o.name from storage.objects o
    where o.bucket_id = $1
      and not exists (select 1 from products  p where p.image_path = o.name)
      and not exists (select 1 from brokers   b where b.image_path = o.name)
      and not exists (select 1 from retailers r where r.image_path = o.name)`,
  [BUCKET],
);
console.log(
  orphans.length
    ? `  ${bad("orphans")}     ${orphans.length} object(s) nothing references`
    : `  ${ok("orphans")}     none — every object is referenced by a row`,
);
for (const row of orphans.slice(0, 10)) console.log(dim(`    ${row.name}`));

await db.close();
console.log("");
