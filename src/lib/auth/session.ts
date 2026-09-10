import "server-only";

import { cookies } from "next/headers";

import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  issueSessionToken,
  sessionTokenIsValid,
} from "@/lib/auth/token";

/**
 * The session, as the server sees it.
 *
 * `server-only` is the guarantee that matters here: this module reads and
 * writes the cookie that stands between a visitor and a live database, and a
 * build fails rather than let any of it reach the browser bundle.
 *
 * The cookie is the whole session. There is no server-side store, so signing
 * out is a deletion and nothing else, and a restart does not sign anybody out.
 */

/** Whether this request carries a valid, unexpired session. */
export async function hasSession(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? sessionTokenIsValid(token) : false;
}

/**
 * The guard every mutation begins with.
 *
 * The proxy already turns unauthenticated requests away, but that is a
 * perimeter and this is the lock on the door. A server action is a POST
 * endpoint that exists whether or not a page linked to it, so each one
 * establishes for itself that somebody is signed in — the check that has to
 * hold even if the perimeter is ever misconfigured or bypassed.
 */
export async function requireSession(): Promise<void> {
  if (!(await hasSession())) {
    throw new Error("Not signed in.");
  }
}

/** Signs the visitor in for SESSION_TTL_MS. */
export async function startSession(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, await issueSessionToken(), {
    httpOnly: true,
    /* Script cannot read it, so an injected script cannot steal it. */
    sameSite: "lax",
    /* Sent over TLS only, once there is TLS to send it over. Development runs
       on plain http://localhost, where this would stop the cookie working at
       all — and there is nothing on that wire to protect. */
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

/** Signs the visitor out. */
export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
