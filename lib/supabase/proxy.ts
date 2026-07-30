import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

// The proxy is the optimistic fast path only. The authoritative checks live in
// app/(protected)/layout.tsx for pages and requireApiUser() for route handlers.
const PROTECTED_PAGE_PREFIXES = ["/admin", "/analytics"] as const;

function isProtectedPage(pathname: string) {
  return PROTECTED_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Carries the auth cookies from the Supabase-managed response onto a different
 * response. Without this, a rotated refresh token is dropped while the old one
 * is already invalidated server-side, and users get logged out at random.
 */
function withCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) to.cookies.set(cookie);
  return to;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value)
        );
      },
    },
  });

  // Do not run any code between createServerClient and getClaims(). Anything
  // that touches cookies in between causes hard-to-debug random logouts.
  const { data } = await supabase.auth.getClaims();
  // getClaims() returns a three-way union — { data: null, error: null } is the
  // ordinary signed-out case, so this must not be destructured.
  const claims = data?.claims ?? null;

  const { pathname, search } = request.nextUrl;

  if (!claims && isProtectedPage(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = ""; // else /admin?foo=1 leaks foo onto /login's own params
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return withCookies(supabaseResponse, NextResponse.redirect(loginUrl));
  }

  // Must be returned as-is: setAll above reassigns it to carry rotated tokens.
  return supabaseResponse;
}
