import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate: no session cookie, no signed-in pages. It only checks that
 * the cookie exists; every page and action still validates the session itself.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  return NextResponse.redirect(new URL("/signin", request.url));
}

export const config = {
  matcher: [
    "/today/:path*",
    "/plan/:path*",
    "/timer/:path*",
    "/fuel/:path*",
    "/progress/:path*",
    "/settings/:path*",
    "/competitions/:path*",
    "/onboarding/:path*",
  ],
};
