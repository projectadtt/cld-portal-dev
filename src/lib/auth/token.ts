/**
 * The session token, and the two comparisons that must not leak timing.
 *
 * Deliberately free of `next/headers` and of `server-only`. The proxy runs in
 * its own runtime and needs to verify a token before any page or action is
 * reached, so the primitive lives here on its own and the cookie handling lives
 * next door in session.ts. Nothing in this file may ever be imported by a
 * client component — it reads server-side environment variables.
 *
 * Built on Web Crypto rather than `node:crypto` so one implementation serves
 * both the middleware runtime and the server runtime. There is no second copy
 * to drift.
 *
 * The token is stateless: an expiry, and an HMAC over that expiry. No session
 * table, nothing to clean up, and a stolen cookie stops working on its own.
 */

const ENCODER = new TextEncoder();

/** How long a sign-in lasts before the portal asks again. */
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export const SESSION_COOKIE = "cld_session";

/**
 * The signing secret, or nothing.
 *
 * A short secret is treated as no secret at all. Everything that depends on
 * this fails closed when it is absent, so a deployment that forgot to set it
 * refuses every visitor rather than admitting all of them — the failure worth
 * having, since the other direction is an open portal onto a live database.
 */
function signingSecret(): string | null {
  const secret = process.env.CLD_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

/** Whether the portal has been given what it needs to authenticate anyone. */
export function authIsConfigured(): boolean {
  return Boolean(signingSecret()) && Boolean(process.env.CLD_PORTAL_PASSWORD);
}

function hmacKey(material: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    ENCODER.encode(material),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** A fresh token, valid for SESSION_TTL_MS from now. */
export async function issueSessionToken(now: number = Date.now()): Promise<string> {
  const secret = signingSecret();
  if (!secret) {
    throw new Error(
      "CLD_SESSION_SECRET is not set, or is shorter than 32 characters. " +
        "The portal cannot issue a session without it.",
    );
  }

  const payload = String(now + SESSION_TTL_MS);
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    ENCODER.encode(payload),
  );
  return payload + "." + toBase64Url(signature);
}

/**
 * Whether a token was issued by this deployment and has not expired.
 *
 * `crypto.subtle.verify` is the comparison, not a string `===`: it is
 * constant-time, so a forged signature cannot be refined one byte at a time by
 * measuring how long the rejection took.
 */
export async function sessionTokenIsValid(
  token: string,
  now: number = Date.now(),
): Promise<boolean> {
  const secret = signingSecret();
  if (!secret) return false;

  const split = token.lastIndexOf(".");
  if (split < 1) return false;

  const payload = token.slice(0, split);
  let signature: Uint8Array;
  try {
    signature = fromBase64Url(token.slice(split + 1));
  } catch {
    return false;
  }

  const signed = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    signature as unknown as BufferSource,
    ENCODER.encode(payload),
  );
  if (!signed) return false;

  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

/**
 * Whether the supplied passphrase is the configured one.
 *
 * Both sides are run through an HMAC under a key generated for this call
 * alone, and the two fixed-length digests are compared with an accumulating
 * XOR. That makes the comparison independent of both the content and the
 * length of what was supplied — a plain `===` on the passphrase itself would
 * return early on the first wrong character and leak the prefix.
 */
export async function passphraseMatches(supplied: string): Promise<boolean> {
  const expected = process.env.CLD_PORTAL_PASSWORD;
  if (!expected) return false;

  const key = await hmacKey(crypto.randomUUID());
  const a = new Uint8Array(await crypto.subtle.sign("HMAC", key, ENCODER.encode(supplied)));
  const b = new Uint8Array(await crypto.subtle.sign("HMAC", key, ENCODER.encode(expected)));

  let difference = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
