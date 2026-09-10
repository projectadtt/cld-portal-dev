import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, sessionTokenIsValid } from "@/lib/auth/token";

/**
 * The perimeter.
 *
 * Next 16 calls this file `proxy.ts`; it was `middleware.ts` until the
 * convention was renamed, and the older name now warns on every build.
 *
 * Every request for anything the portal serves passes through here before a
 * page renders, a server action runs, or the database is touched. An
 * unauthenticated visitor never reaches application code at all, which is why
 * this is a redirect rather than a page that decides for itself whether to
 * draw its contents: a page that renders and then hides is a page that has
 * already run its queries.
 *
 * This is the perimeter and not the whole of the protection. Every mutation
 * checks for itself — see `requireSession` — so that the two would have to
 * fail together for anything to get through.
 */
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const signedIn = token ? await sessionTokenIsValid(token) : false;

  const { pathname, search } = request.nextUrl;
  const isSignIn = pathname === "/login";

  if (signedIn) {
    /* Nothing to sign in to; send them where they were going. */
    if (isSignIn) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (isSignIn) return NextResponse.next();

  /**
   * A server action carries this header and expects a response it can parse,
   * not a login page. Answering with 401 is both honest to the caller and the
   * reason a scripted POST straight at an action gets nowhere.
   */
  if (request.headers.get("next-action")) {
    return new NextResponse("Not signed in.", { status: 401 });
  }

  const destination = new URL("/login", request.url);
  const from = pathname + search;
  /* Only ever a path on this site. A value starting `//` or naming a scheme
     would be someone else's origin, and sending a signed-in visitor there
     after login is the open-redirect this refuses to be. */
  if (from !== "/" && /^\/(?!\/)/.test(from)) {
    destination.searchParams.set("next", from);
  }

  /* 303 turns a rejected POST into a GET of the sign-in page rather than
     re-posting the body to it. */
  return NextResponse.redirect(destination, request.method === "POST" ? 303 : 307);
}

export const config = {
  /**
   * Everything except the framework's own static output and the icon. Those
   * carry no data, and a sign-in redirect on a stylesheet would only break the
   * sign-in page's own appearance.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
