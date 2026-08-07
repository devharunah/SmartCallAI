import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, requireSupabaseEnv } from "./env";

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

/** Signed-out redirect for a protected page, or pass-through for a public one. */
function redirectIfProtected(request: NextRequest, response: NextResponse) {
  const { pathname, search } = request.nextUrl;
  if (!isProtectedPage(pathname)) return response;

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = ""; // else /admin?foo=1 leaks foo onto /login's own params
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return withCookies(response, NextResponse.redirect(loginUrl));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // No config means no session can be verified. Fail closed — public routes stay
  // reachable, protected ones bounce to /login — instead of throwing a 500 on
  // every request, which the broad matcher above would apply to the whole site.
  if (!isSupabaseConfigured) {
    return redirectIfProtected(request, supabaseResponse);
  }

  const { url, publishableKey } = requireSupabaseEnv();

  const supabase = createServerClient(url, publishableKey, {
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

  // Must be returned as-is when signed in: setAll above reassigns
  // supabaseResponse to carry rotated tokens.
  if (claims) return supabaseResponse;

  return redirectIfProtected(request, supabaseResponse);
}
