import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges the `token_hash` from the confirmation email for a session.
 *
 * Requires the Supabase "Confirm signup" email template to point here:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 * The default {{ .ConfirmationURL }} uses the implicit flow, which returns
 * tokens in a URL fragment that no server can read.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  // Lands on /login rather than the public call screen. Note that verifyOtp
  // establishes a session, so /login forwards straight on to /admin — to make
  // the user actually re-enter credentials, sign the new session out here first.
  const next = safeNextPath(searchParams.get("next"), "/login");

  const redirectTo = request.nextUrl.clone();
  // Cleared wholesale so token_hash never reaches browser history or a Referer.
  redirectTo.search = "";

  // Compared as a literal rather than cast to EmailOtpType: that type is not
  // exported by the installed @supabase/supabase-js, and it includes
  // `(string & {})` anyway, so the cast would provide no safety.
  if (tokenHash && type === "email") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: "email",
      token_hash: tokenHash,
    });
    if (!error) {
      redirectTo.pathname = next;
      return NextResponse.redirect(redirectTo);
    }
  }

  // Missing/blank token, wrong type, or an expired or already-used link.
  redirectTo.pathname = "/login";
  redirectTo.searchParams.set("error", "confirm");
  return NextResponse.redirect(redirectTo);
}
