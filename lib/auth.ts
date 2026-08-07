import { cache } from "react";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Declared locally rather than imported: JwtPayload lives in @supabase/auth-js,
// a transitive dependency, and is not re-exported by @supabase/supabase-js.
export type AuthClaims = { sub: string; email?: string };

/**
 * Verified claims for the current request, or null when signed out.
 *
 * Uses getClaims() rather than getSession() (which decodes the cookie without
 * verifying its signature, so a forged cookie passes) or getUser() (which makes
 * a network round-trip on every call).
 *
 * Wrapped in React's cache() so the nav header and a protected layout rendering
 * in the same pass share a single verification.
 */
export const getClaims = cache(async (): Promise<AuthClaims | null> => {
  // NavHeader calls this on every route, including during prerender. Without
  // config there is no session to verify, so report signed out rather than
  // throwing: callers all fail closed from here (the protected layout redirects
  // to /login, requireApiUser answers 401), and the public call screen still works.
  if (!isSupabaseConfigured) {
    console.error(
      "[auth] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set; " +
        "treating every request as signed out. Auth is disabled until they are set and the app rebuilt."
    );
    return null;
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims as AuthClaims | undefined) ?? null;
});

/**
 * Route-handler guard. Returns a ready-made 401 when signed out, so callers can
 * `if (unauthorized) return unauthorized;` and have `claims` narrowed to non-null.
 *
 * Note: /api/route-call deliberately does NOT call this — it is public.
 */
export async function requireApiUser() {
  const claims = await getClaims();
  if (!claims) {
    return {
      claims: null,
      unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }
  return { claims, unauthorized: null } as const;
}

/**
 * Open-redirect guard for the `next` param. Only same-origin absolute paths survive.
 * Must be applied at every sink, including inside the server action — the hidden
 * form input is attacker-controlled.
 */
export function safeNextPath(next: unknown, fallback = "/admin"): string {
  if (typeof next !== "string" || next.length === 0) return fallback;
  if (!next.startsWith("/")) return fallback; // absolute URLs, javascript:, data:
  if (next.startsWith("//")) return fallback; // protocol-relative -> //evil.com
  // Browsers normalize backslashes to slashes, so /\evil.com escapes a naive check.
  if (
    next.startsWith("/\\") ||
    next.toLowerCase().startsWith("/%5c") ||
    next.toLowerCase().startsWith("/%2f")
  ) {
    return fallback;
  }
  return next;
}
