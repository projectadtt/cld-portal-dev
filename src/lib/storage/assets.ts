import "server-only";

import { randomBytes } from "node:crypto";

/**
 * CLD's image files.
 *
 * The whole of the portal's contact with Supabase Storage lives here. Three
 * operations — put, remove, and the URL a browser can read — and one rule about
 * where a file is allowed to land.
 *
 * `server-only` makes it a build error for anything in the client bundle to
 * import this file, directly or transitively. That matters more here than
 * anywhere else in the codebase: `SUPABASE_SECRET_KEY` bypasses every row-level
 * policy in the project, and the browser must never be in a position to hold
 * it. Uploads are server-mediated for exactly that reason — the browser hands
 * bytes to a server action, and the server is what talks to Storage.
 *
 * Division of labour, which is the point of the whole exercise:
 *
 *     Storage   the bytes
 *     Postgres  the business record, and the path back to the bytes
 *
 * Nothing binary is ever written to Postgres, and no URL is ever stored.
 */

/** Declared in scripts/db/storage-setup.mjs, which creates the bucket. */
const BUCKET = "cld-assets";

/** 5 MB, the same figure the bucket itself is configured with. */
export const MAX_BYTES = 5 * 1024 * 1024;

export const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

/** What a person is told they may upload. */
export const ACCEPTED_LABEL = "JPG, PNG or WEBP, up to 5 MB";

/**
 * The three things that can carry a picture, and the folder each one owns.
 *
 * Keyed rather than free text so a caller cannot invent a prefix, and matching
 * the check constraint each table carries in migration 0011 — a product row
 * physically cannot hold a path under `brokers/`.
 */
export const ASSET_FOLDER = {
  product: "products",
  broker: "brokers",
  retailer: "retailers",
} as const;

export type AssetKind = keyof typeof ASSET_FOLDER;

/* ── Where the project is ───────────────────────────────────────────────── */

/**
 * The project's API origin.
 *
 * Derived from DATABASE_URL by default. The pooler username is
 * `postgres.<project-ref>`, and the ref is the whole of the project's API
 * hostname — so there is nothing for anyone to keep in step, and no second
 * place for the two to disagree about which project this is. SUPABASE_URL
 * overrides it for a self-hosted or proxied deployment.
 */
function projectUrl(): string {
  const explicit = process.env.SUPABASE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Neither SUPABASE_URL nor DATABASE_URL is set, so there is no way to " +
        "tell which Supabase project the images belong to.",
    );
  }

  const user = decodeURIComponent(new URL(connectionString).username);
  const ref = user.includes(".") ? user.split(".")[1] : null;
  if (!ref) {
    throw new Error(
      "DATABASE_URL does not name a Supabase project (its user is not " +
        "postgres.<project-ref>), and SUPABASE_URL is not set. Set " +
        "SUPABASE_URL to the project's API URL.",
    );
  }
  return `https://${ref}.supabase.co`;
}

/**
 * The credential Storage writes are made with.
 *
 * `SUPABASE_SECRET_KEY` — Supabase's current server-side key. The older
 * `SUPABASE_SERVICE_ROLE_KEY` is deliberately not read here: one name, one
 * credential, so there is never a question about which of two secrets a given
 * upload actually used.
 *
 * Read at call time rather than at module load, so that adding the key to
 * .env.local takes effect on a restart rather than needing a rebuild, and so
 * that importing this module never requires the secret to exist — the URL
 * builder below is used by every page and must work without it.
 */
function secretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not set. Uploading to Supabase Storage needs " +
        "it; reading public images does not. Add it to .env.local from the " +
        "Supabase dashboard under Project Settings → API keys. It is a " +
        "server-side credential: it must never be given a NEXT_PUBLIC_ prefix.",
    );
  }
  return key;
}

/**
 * How the credential is presented to Storage.
 *
 * `apikey`, not `Authorization: Bearer`. Supabase's current secret keys are
 * opaque `sb_secret_…` strings rather than JWTs, and the Storage API parses a
 * Bearer token as a JWT — so a Bearer header carrying one of these is refused
 * with "Invalid Compact JWS", which reads like a broken key and is really a
 * header in the wrong place. The `apikey` header is what the gateway resolves,
 * and it accepts both the current key format and the older JWT one.
 */
function authHeaders(): Record<string, string> {
  return { apikey: secretKey() };
}

/** Whether uploads are possible at all, without throwing to find out. */
export function canUpload(): boolean {
  return Boolean(process.env.SUPABASE_SECRET_KEY);
}

/* ── Reading ────────────────────────────────────────────────────────────── */

/**
 * The URL a browser loads, built from the stored path every time.
 *
 * Nothing derived from a host or a signature is kept in the database, so
 * moving the project or changing the bucket changes this function and nothing
 * else. The bucket is public-read, so the URL is stable and cacheable and
 * carries no credential.
 */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${projectUrl()}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** The API host, so next.config can be told to allow images from it. */
export function assetHostname(): string | null {
  try {
    return new URL(projectUrl()).hostname;
  } catch {
    return null;
  }
}

/* ── Validating ─────────────────────────────────────────────────────────── */

/**
 * What the file actually is, read from its first bytes.
 *
 * The browser's reported Content-Type is a claim, not evidence: it is chosen
 * by whatever sent the request. These signatures are the file itself saying
 * what it is. A .jpg renamed from a .svg fails here, which is the case worth
 * catching — an SVG is a document that can carry script, and it is the one
 * image format that should never reach a bucket that serves public URLs.
 */
function sniff(bytes: Uint8Array): { mime: string; ext: string } | null {
  const startsWith = (...signature: number[]) =>
    signature.every((byte, i) => bytes[i] === byte);

  if (startsWith(0xff, 0xd8, 0xff)) return { mime: "image/jpeg", ext: "jpg" };

  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return { mime: "image/png", ext: "png" };
  }

  /* RIFF....WEBP — the four size bytes in between are not part of the mark. */
  const ascii = (offset: number, text: string) =>
    [...text].every((char, i) => bytes[offset + i] === char.charCodeAt(0));
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return { mime: "image/webp", ext: "webp" };

  return null;
}

export interface RejectedUpload {
  ok: false;
  error: string;
}

export interface AcceptedUpload {
  ok: true;
  bytes: Uint8Array;
  mime: string;
  ext: string;
}

/**
 * Server-side validation, run on every upload regardless of what the form did.
 *
 * The `accept` attribute and any client-side size check are conveniences for
 * the person uploading. They are not enforcement — a request does not have to
 * come from the form — so size and type are both established here, from the
 * bytes, before anything is sent anywhere.
 */
export async function readUpload(
  file: File,
): Promise<AcceptedUpload | RejectedUpload> {
  if (file.size === 0) return { ok: false, error: "That file is empty." };

  if (file.size > MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return {
      ok: false,
      error: `That image is ${mb} MB. The limit is 5 MB — try exporting it smaller.`,
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  /* Re-checked against the bytes read, not the size the request declared. */
  if (bytes.byteLength > MAX_BYTES) {
    return { ok: false, error: "That image is over the 5 MB limit." };
  }

  const kind = sniff(bytes);
  if (!kind) {
    return {
      ok: false,
      error: `That does not look like a JPG, PNG or WEBP. ${ACCEPTED_LABEL}.`,
    };
  }

  return { ok: true, bytes, mime: kind.mime, ext: kind.ext };
}

/* ── Writing ────────────────────────────────────────────────────────────── */

/**
 * The path a new object gets.
 *
 * The filename is 32 random hex characters and never the name of the file that
 * was uploaded. Three reasons, in order of how much they matter: an uploaded
 * filename is attacker-controlled text that would end up in a URL; a replaced
 * image gets a new name, so no cache anywhere serves the old picture for the
 * new one; and people's filenames carry things they did not mean to publish.
 *
 * The owner id is checked rather than escaped. The ids in this database are
 * slugs, and anything that is not one is refused outright — there is no
 * sanitising step whose correctness has to be argued about.
 */
function objectPath(kind: AssetKind, ownerId: string, ext: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(ownerId)) {
    throw new Error(`Not a usable record id for a storage path: ${JSON.stringify(ownerId)}`);
  }
  return `${ASSET_FOLDER[kind]}/${ownerId}/${randomBytes(16).toString("hex")}.${ext}`;
}

/**
 * Uploads one image and returns the path to store on the row.
 *
 * Deliberately does not touch the database. The caller writes the path inside
 * its own transaction, so a failed upload cannot leave a row pointing at
 * nothing — the ordering is always: put the bytes, then record where they are.
 */
export async function putAsset(
  kind: AssetKind,
  ownerId: string,
  upload: AcceptedUpload,
): Promise<string> {
  const path = objectPath(kind, ownerId, upload.ext);

  const response = await fetch(
    `${projectUrl()}/storage/v1/object/${BUCKET}/${path}`,
    {
      method: "POST",
      headers: {
        ...authHeaders(),
        "content-type": upload.mime,
        /* The object name is random, so this should never collide; saying so
           turns a collision into an error rather than a silent overwrite. */
        "x-upsert": "false",
        "cache-control": "public, max-age=31536000, immutable",
      },
      body: upload.bytes as unknown as BodyInit,
    },
  );

  if (!response.ok) {
    throw new Error(await storageError(response, "upload"));
  }

  return path;
}

/**
 * Removes one object.
 *
 * Called after the database has committed the row that stopped pointing at it,
 * never before. If this fails the row is already correct and the file is
 * simply left behind — `npm run db:storage` lists anything nothing references,
 * so an orphan is visible rather than silent. Losing a file that a row still
 * points at would be the worse failure, and this ordering makes it impossible.
 */
export async function removeAsset(path: string): Promise<void> {
  const response = await fetch(
    `${projectUrl()}/storage/v1/object/${BUCKET}/${path}`,
    { method: "DELETE", headers: authHeaders() },
  );

  /* Already gone is the outcome that was wanted. */
  if (response.ok || response.status === 404) return;

  throw new Error(await storageError(response, "delete"));
}

/**
 * A Storage failure, said in words, with nothing secret in it.
 *
 * The request carried the service-role key in a header; the response does not,
 * and nothing here echoes the request back. Only the status and Storage's own
 * message are surfaced.
 */
async function storageError(response: Response, action: string): Promise<string> {
  let detail = "";
  try {
    const body = await response.json();
    detail = typeof body?.message === "string" ? body.message : JSON.stringify(body);
  } catch {
    detail = response.statusText;
  }

  if (response.status === 400 && /bucket not found/i.test(detail)) {
    return `The "${BUCKET}" bucket does not exist yet. Run: npm run db:storage -- --apply`;
  }
  if (/compact jws|jwt/i.test(detail)) {
    return `Supabase Storage could not read the credential on this ${action}. SUPABASE_SECRET_KEY is being sent where a JWT is expected — see authHeaders().`;
  }
  if (response.status === 401 || response.status === 403) {
    return `Supabase Storage refused the ${action} (${response.status}). SUPABASE_SECRET_KEY is missing or not valid for this project.`;
  }

  return `Storage ${action} failed (${response.status}): ${detail}`;
}
