import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_DURATION_SECONDS,
  cookieSecure,
  signSession,
  verifySessionToken,
} from "@/lib/auth/jwt";
import { isSmsLoginEnabled } from "@/lib/loginMode";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isAdminRoute = pathname.startsWith("/admin");
  const isAccountRoute = pathname.startsWith("/account");
  const isAuthRoute = ["/login", "/register"].includes(pathname);

  // SMS-login mode (docs/SMS-LOGIN.md): no registration / password-reset pages for customers.
  const isRetiredAuthRoute =
    isSmsLoginEnabled() && ["/register", "/forgot-password", "/reset-password"].includes(pathname);

  let response: NextResponse;

  if (isRetiredAuthRoute) {
    response = NextResponse.redirect(new URL("/login", request.url));
  } else if (isAdminRoute && !session) {
    // /login/admin (password form) works in both login modes; plain /login is the customer SMS form in SMS mode.
    response = NextResponse.redirect(new URL("/login/admin", request.url));
  } else if (isAdminRoute && session && session.role !== "administrator") {
    // A logged-in non-admin hitting /admin must not be redirected to
    // /login: the auth-route rule below would immediately bounce an
    // authenticated session back out again, causing a redirect loop.
    response = NextResponse.redirect(new URL("/account", request.url));
  } else if (isAccountRoute && !session) {
    response = NextResponse.redirect(new URL("/login", request.url));
  } else if (isAuthRoute && session) {
    response = NextResponse.redirect(
      new URL(session.role === "administrator" ? "/admin" : "/account", request.url),
    );
  } else {
    response = NextResponse.next();
  }

  // Sliding session: any request presenting a still-valid session cookie
  // gets a freshly re-signed token with a renewed 30-day window, so an
  // actively-returning customer/admin is never logged out by calendar time
  // alone — only by real inactivity beyond the window, or explicit logout.
  if (session) {
    const freshToken = await signSession(session);
    response.cookies.set(SESSION_COOKIE, freshToken, {
      httpOnly: true,
      secure: cookieSecure(),
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_SECONDS,
    });
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/login", "/register", "/forgot-password", "/reset-password"],
};
