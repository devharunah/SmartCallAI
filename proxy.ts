import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 renamed the `middleware` convention to `proxy`.
// Do not add a `runtime` config here — it throws; Node.js is already the default.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Deliberately broad: the proxy's job is session refresh on every renderable
  // request. The public/protected split lives in lib/supabase/proxy.ts, not here
  // — encoding it as a matcher lookahead breaks /_next/data, which Next always
  // routes through the proxy even when the pattern excludes it.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf)$).*)",
  ],
};
