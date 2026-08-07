// These two must be read as literal `process.env.NEXT_PUBLIC_*` expressions.
// Next inlines them by static text replacement at build time — a computed key
// like process.env[name] is never inlined and comes out `undefined` in the browser.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Whether browser-visible Supabase config is present.
 *
 * Checked rather than thrown on at module scope: `app/layout.tsx` renders
 * NavHeader on every route, so a top-level throw here failed `next build`
 * outright — including for /_not-found and the public call screen, neither of
 * which touches auth. Validation is deferred to the point a client is built.
 */
export const isSupabaseConfigured = Boolean(url && publishableKey);

const MISSING_ENV_MESSAGE =
  "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
  "Set both in the deployment environment (or .env.local locally). NEXT_PUBLIC_* " +
  "vars are inlined at build time, so adding them requires a rebuild — on Vercel, " +
  "redeploy rather than just restarting.";

/**
 * Config for the Supabase clients. Throws only when a client is actually
 * constructed, so a missing key breaks auth alone instead of the whole build.
 */
export function requireSupabaseEnv() {
  if (!url || !publishableKey) throw new Error(MISSING_ENV_MESSAGE);
  return { url, publishableKey };
}
